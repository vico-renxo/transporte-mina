const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function declararEstado({ pasajeroId, rutaId, estado }) {
  const estadosValidos = ['NORMAL', 'POR_MIS_MEDIOS', 'AUSENTE'];
  if (!estadosValidos.includes(estado)) {
    throw { status: 400, message: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` };
  }

  // Verificar que la ruta existe
  const ruta = await prisma.ruta.findUnique({ where: { id: rutaId } });
  if (!ruta) throw { status: 404, message: 'Ruta no encontrada' };

  const hoy = startOfDay();
  const result = await prisma.estadoTurno.upsert({
    where: { pasajeroId_rutaId_fecha: { pasajeroId, rutaId, fecha: hoy } },
    create: { pasajeroId, rutaId, fecha: hoy, estado, declaradoEn: new Date() },
    update: { estado, declaradoEn: new Date() }
  });

  // Notificar al supervisor vía WebSocket
  const { getIo } = require('../../config/socket');
  getIo()?.to('supervisores').emit('pasajero:estado-cambiado', {
    pasajeroId, rutaId, estado, timestamp: new Date()
  });

  return result;
}

async function marcarEnParadero(pasajeroId) {
  // Buscar la ejecución activa del pasajero
  const pasajero = await prisma.pasajero.findUnique({
    where: { id: pasajeroId },
    include: {
      paradero: { include: { ruta: { include: { ejecuciones: { where: { estado: 'EN_RUTA' }, take: 1 } } } } },
      usuario: { select: { nombre: true } }
    }
  });

  if (!pasajero) throw { status: 404, message: 'Pasajero no encontrado' };

  const { getIo } = require('../../config/socket');
  const ejecucionActiva = pasajero.paradero?.ruta?.ejecuciones?.[0];

  if (ejecucionActiva) {
    getIo()?.to(`ruta:${ejecucionActiva.id}`).emit('pasajero:en-paradero', {
      pasajeroId,
      nombre: pasajero.usuario.nombre,
      paraderoId: pasajero.paraderoId,
      timestamp: new Date()
    });
  }

  return { ok: true, mensaje: 'Conductor notificado que estás esperando' };
}

async function listarPendientesAprobacion() {
  return prisma.pasajero.findMany({
    where: { aprobado: false },
    include: { usuario: { select: { nombre: true, email: true, telefono: true, creadoEn: true } } },
    orderBy: { usuario: { creadoEn: 'desc' } }
  });
}

async function aprobarPasajero(pasajeroId, paraderoId) {
  if (!paraderoId) throw { status: 400, message: 'paraderoId requerido para aprobar al pasajero' };
  const paradero = await prisma.paradero.findUnique({ where: { id: paraderoId } });
  if (!paradero) throw { status: 404, message: 'Paradero no encontrado' };

  // BUG FIX: también asignar rutaId desde el paradero para que mi-perfil y declararEstado funcionen
  return prisma.pasajero.update({
    where: { id: pasajeroId },
    data: { paraderoId, rutaId: paradero.rutaId, aprobado: true },
    include: { usuario: true, paradero: true, ruta: { select: { nombre: true } } }
  });
}

async function listarPasajeros({ rutaId, paraderoId, aprobado } = {}) {
  const where = {};
  if (aprobado !== undefined) where.aprobado = aprobado === 'true' || aprobado === true;
  if (paraderoId) where.paraderoId = paraderoId;
  if (rutaId) where.paradero = { rutaId };

  return prisma.pasajero.findMany({
    where,
    include: {
      usuario: { select: { nombre: true, email: true, telefono: true } },
      paradero: { select: { nombre: true, orden: true } },
      ruta:     { select: { nombre: true } }
    },
    orderBy: { creadoEn: 'desc' }
  });
}

async function obtenerEstadosHoy(rutaId) {
  const hoy = startOfDay();
  const paraderos = await prisma.paradero.findMany({
    where: { rutaId },
    orderBy: { orden: 'asc' },
    include: {
      pasajeros: {
        where: { aprobado: true },
        include: {
          usuario: { select: { nombre: true } },
          estados: { where: { fecha: { gte: hoy }, rutaId }, take: 1 }
        }
      }
    }
  });

  return paraderos.map(p => ({
    paraderoId: p.id,
    nombre: p.nombre,
    orden: p.orden,
    pasajeros: p.pasajeros.map(pas => ({
      id: pas.id,
      nombre: pas.usuario.nombre,
      estado: pas.estados[0]?.estado ?? 'NORMAL',
      declaradoEn: pas.estados[0]?.declaradoEn ?? null
    }))
  }));
}

async function calificarServicio({ pasajeroId, rutaEjecucionId, estrellas, comentario }) {
  if (estrellas < 1 || estrellas > 5) throw { status: 400, message: 'Estrellas debe ser entre 1 y 5' };
  return prisma.calificacion.create({
    data: { pasajeroId, rutaEjecucionId, estrellas: Number(estrellas), comentario }
  });
}

module.exports = {
  declararEstado, marcarEnParadero, listarPendientesAprobacion,
  aprobarPasajero, listarPasajeros, obtenerEstadosHoy, calificarServicio
};
