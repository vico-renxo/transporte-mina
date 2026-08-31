const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

// ════════════════════════════════════════════════════════════════
// REVOCAR SESIONES AL CAMBIAR LA CONTRASENA — sin tocar la base
//
// El problema: los JWT duran 7 dias y no habia forma de invalidarlos.
// Cambiar la contrasena no echaba a una sesion abierta en otro telefono,
// que es justo el caso 'me entraron a la cuenta'.
//
// La solucion obvia era una columna tokenVersion, pero eso obliga a correr
// una migracion a mano en Supabase (regla 6) y a desplegar en un orden
// exacto. Se puede sin nada de eso: el hash bcrypt de la contrasena YA
// cambia cuando la contrasena cambia. Metemos una huella corta de ese hash
// en el token y la comparamos contra la actual. Cambia la contrasena ->
// cambia el hash -> todos los tokens viejos dejan de coincidir.
//
// Costo: una lectura por usuario cada 60 segundos (no por request: hay
// cache). Antes authMiddleware no tocaba la base en absoluto.
//
// Decision consciente — FALLA ABIERTA: si la consulta a la base falla, el
// request pasa. Fallar cerrada convertiria cualquier hipo de Supabase en
// 'nadie puede usar la app'. Para este sistema, un hueco de segundos en la
// revocacion es mejor que dejar a los conductores sin panel a mitad de ruta.
// ════════════════════════════════════════════════════════════════

const CACHE_HUELLA_MS = 60 * 1000;
const cacheHuella = new Map(); // usuarioId -> { huella, expira }

/** Huella corta del hash. No es el hash: no sirve para adivinar nada. */
function huellaDe(hashPassword) {
  return String(hashPassword || '').slice(-12);
}

/** Olvida la huella cacheada de un usuario, para que el cambio pegue ya. */
function olvidarHuella(usuarioId) {
  cacheHuella.delete(usuarioId);
}

/**
 * true si la huella del token sigue siendo la actual.
 * Un token sin huella (emitido antes de este cambio) se acepta: si no, el
 * deploy echaria a todo el mundo de una.
 */
async function huellaSigueValida(usuarioId, huellaDelToken) {
  if (!huellaDelToken) return true;

  const ahora = Date.now();
  const guardada = cacheHuella.get(usuarioId);
  if (guardada && guardada.expira > ahora) return guardada.huella === huellaDelToken;

  try {
    const u = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { password: true, activo: true },
    });
    if (!u || !u.activo) return false;
    const actual = huellaDe(u.password);
    cacheHuella.set(usuarioId, { huella: actual, expira: ahora + CACHE_HUELLA_MS });
    return actual === huellaDelToken;
  } catch (err) {
    console.error('huellaSigueValida: no se pudo leer el usuario, se deja pasar:', err.message);
    return true; // falla abierta, a proposito (ver arriba)
  }
}

async function login(email, password) {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      conductor: { select: { id: true } },
      pasajero:  { select: { id: true } }
    }
  });
  if (!usuario || !usuario.activo) {
    throw { status: 401, message: 'Credenciales inválidas' };
  }

  const valido = await bcrypt.compare(password, usuario.password);
  if (!valido) throw { status: 401, message: 'Credenciales inválidas' };

  const payload = {
    id: usuario.id,
    rol: usuario.rol,
    nombre: usuario.nombre,
    email: usuario.email,
    // Huella del hash de la contrasena. Si la contrasena cambia, este valor
    // deja de coincidir y el token muere, aunque le queden dias de vida.
    pv: huellaDe(usuario.password)
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      email: usuario.email,
      telefono: usuario.telefono,
      // FIX: el panel conductor filtra ejecuciones por conductorId.
      // Antes el login no lo devolvía y usuario.conductorId era siempre undefined.
      conductorId: usuario.conductor?.id ?? null,
      pasajeroId:  usuario.pasajero?.id ?? null
    }
  };
}

async function registrarPasajero({ nombre, email, telefono, password, domicilioLat, domicilioLng, direccion, paraderoId }) {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw { status: 409, message: 'Este email ya está registrado' };

  // NUEVO: si eligió "recojo en paradero", validamos y lo guardamos como preferencia.
  // El supervisor lo verá preseleccionado al aprobar (aprobado sigue en false).
  let paraderoPref = null;
  if (paraderoId) {
    paraderoPref = await prisma.paradero.findUnique({ where: { id: paraderoId } });
    if (!paraderoPref) throw { status: 404, message: 'El paradero elegido no existe' };
  }

  const hash = await bcrypt.hash(password, 12);
  const usuario = await prisma.usuario.create({
    data: { nombre, email, telefono, password: hash, rol: 'PASAJERO' }
  });

  // NUEVO: el pasajero declara su domicilio (GPS) al registrarse.
  // El supervisor lo valida y usa para asignar el paradero más cercano.
  await prisma.pasajero.create({
    data: {
      usuarioId: usuario.id,
      aprobado: false,
      domicilioLat: typeof domicilioLat === 'number' ? domicilioLat : null,
      domicilioLng: typeof domicilioLng === 'number' ? domicilioLng : null,
      direccion: direccion || '',
      paraderoId: paraderoPref?.id ?? null,
      rutaId: paraderoPref?.rutaId ?? null
    }
  });

  return { mensaje: 'Registro enviado. El supervisor revisará y aprobará tu cuenta pronto.' };
}

async function actualizarFcmToken(usuarioId, fcmToken) {
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { fcmToken }
  });
}

// Largo minimo de una contrasena. Vive aca, del lado del servidor: la
// pantalla tambien lo valida, pero esa validacion es una comodidad para el
// usuario, no una defensa — cualquiera puede llamar al endpoint sin pasar
// por la pantalla.
const MIN_LARGO_PASSWORD = 8;

async function cambiarPassword(usuarioId, passwordActual, passwordNueva) {
  if (!passwordActual || !passwordNueva) {
    throw { status: 400, message: 'Contrasena actual y nueva son requeridas' };
  }
  // typeof antes que .length: un JSON con `"passwordNueva": 12345678` (numero,
  // sin comillas) pasaba los chequeos con undefined y reventaba adentro de
  // bcrypt con un 500 y stack en los logs.
  if (typeof passwordActual !== 'string' || typeof passwordNueva !== 'string') {
    throw { status: 400, message: 'Las contrasenas tienen que ser texto' };
  }
  if (passwordNueva.length < MIN_LARGO_PASSWORD) {
    throw { status: 400, message: `La contrasena nueva necesita al menos ${MIN_LARGO_PASSWORD} caracteres` };
  }
  if (passwordNueva === passwordActual) {
    throw { status: 400, message: 'La contrasena nueva tiene que ser distinta de la actual' };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };
  const valido = await bcrypt.compare(passwordActual, usuario.password);
  if (!valido) throw { status: 400, message: 'Contraseña actual incorrecta' };

  const hash = await bcrypt.hash(passwordNueva, 12);
  // Sin esto, la sesion vieja seguiria valida hasta 60s por el cache.
  olvidarHuella(usuarioId);
  return prisma.usuario.update({ where: { id: usuarioId }, data: { password: hash } });
}

module.exports = { login, registrarPasajero, actualizarFcmToken, cambiarPassword, huellaSigueValida, huellaDe, olvidarHuella };
