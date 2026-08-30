const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

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
    email: usuario.email
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
  return prisma.usuario.update({ where: { id: usuarioId }, data: { password: hash } });
}

module.exports = { login, registrarPasajero, actualizarFcmToken, cambiarPassword };
