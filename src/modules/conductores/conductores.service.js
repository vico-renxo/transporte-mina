const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function listarConductores() {
  const conductores = await prisma.conductor.findMany({
    include: {
      usuario: { select: { id: true, nombre: true, email: true, activo: true } },
      _count:  { select: { ejecuciones: true } },
    },
    orderBy: { usuario: { nombre: 'asc' } },
  });
  return { conductores };
}

async function obtenerConductor(id) {
  const c = await prisma.conductor.findUnique({
    where: { id },
    include: {
      usuario: { select: { id: true, nombre: true, email: true } },
      ejecuciones: {
        orderBy: { fechaInicio: 'desc' },
        take: 10,
        include: { ruta: { select: { nombre: true } } },
      },
    },
  });
  if (!c) throw Object.assign(new Error('Conductor no encontrado'), { status: 404 });
  return c;
}

async function crearConductor({ nombre, email, password, licencia, telefono }) {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw Object.assign(new Error('El email ya está registrado'), { status: 409 });

  const hash = await bcrypt.hash(password, 12);
  const usuario = await prisma.usuario.create({
    data: { nombre, email, password: hash, rol: 'CONDUCTOR' },
  });
  const conductor = await prisma.conductor.create({
    data: { usuarioId: usuario.id, licencia, telefono: telefono || null },
  });
  return { conductor: { ...conductor, usuario } };
}

async function actualizarConductor(id, { nombre, email, password, licencia, telefono, estado }) {
  const c = await prisma.conductor.findUnique({ where: { id }, include: { usuario: true } });
  if (!c) throw Object.assign(new Error('Conductor no encontrado'), { status: 404 });

  const userUpdate = {};
  if (nombre)   userUpdate.nombre = nombre;
  if (email)    userUpdate.email  = email;
  if (password) userUpdate.password = await bcrypt.hash(password, 12);
  if (estado !== undefined) userUpdate.activo = estado === 'ACTIVO';

  const [usuario, conductor] = await prisma.$transaction([
    prisma.usuario.update({ where: { id: c.usuarioId }, data: userUpdate }),
    prisma.conductor.update({ where: { id }, data: { licencia: licencia || c.licencia, telefono: telefono ?? c.telefono } }),
  ]);
  return { conductor: { ...conductor, usuario } };
}

module.exports = { listarConductores, obtenerConductor, crearConductor, actualizarConductor };
