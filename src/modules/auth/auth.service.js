const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function login(email, password) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
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
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, email: usuario.email, telefono: usuario.telefono }
  };
}

async function registrarPasajero({ nombre, email, telefono, password }) {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw { status: 409, message: 'Este email ya está registrado' };

  const hash = await bcrypt.hash(password, 12);
  const usuario = await prisma.usuario.create({
    data: { nombre, email, telefono, password: hash, rol: 'PASAJERO' }
  });

  await prisma.pasajero.create({
    data: { usuarioId: usuario.id, aprobado: false }
  });

  return { mensaje: 'Registro enviado. El supervisor revisará y aprobará tu cuenta pronto.' };
}

async function actualizarFcmToken(usuarioId, fcmToken) {
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { fcmToken }
  });
}

async function cambiarPassword(usuarioId, passwordActual, passwordNueva) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  const valido = await bcrypt.compare(passwordActual, usuario.password);
  if (!valido) throw { status: 400, message: 'Contraseña actual incorrecta' };

  const hash = await bcrypt.hash(passwordNueva, 12);
  return prisma.usuario.update({ where: { id: usuarioId }, data: { password: hash } });
}

module.exports = { login, registrarPasajero, actualizarFcmToken, cambiarPassword};

