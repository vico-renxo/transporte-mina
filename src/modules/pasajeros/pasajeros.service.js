const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// FIX: antes esta lógica vivía en pasajeros.routes.js y creaba un
// `new PrismaClient()` POR CADA REQUEST → fuga de conexiones con pgBouncer.
// Ahora usa el singleton del módulo.
async function obtenerPasajeroPorUsuario(usuarioId) {
  const pasajero = await prisma.pasajero.findFirst({ where: { usuarioId } });
  if (!pasajero) throw { status: 404, message: 'Perfil de pasajero no encontrado' };
  return pasajero;
}

async function obtenerMiPerfil(usuarioId) {
  const pasajero = await prisma.pasajero.findFirst({
    where: { usuarioId },
    include: {
      usuario:  { select: { nombre: true, email: true } },
      ruta:     { select: { id: true, nombre: true, horaInicio: true, origen: true, destino: true } },
      paradero: { select: { id: true, nombre: true, lat: true, lng: true, orden: true } },
    }
  });
  if (!pasajero) throw { status: 404, message: 'Perfil de pasajero no encontrado' };

  const ejecucion = pasajero.rutaId ? await prisma.rutaEjecucion.findFirst({
    where: { rutaId: pasajero.rutaId, estado: 'EN_RUTA' },
    include: {
      coordenadas: { orderBy: { timestamp: 'desc' }, take: 1 },
      conductor:   { include: { usuario: { select: { nombre: true } } } },
      vehiculo:    { select: { placa: true, modelo: true, marca: true } },
    }
  }) : null;

  return {
    pasajero,
    ejecucionActiva: ejecucion ? {
      id: ejecucion.id,
      estado: ejecucion.estado,
      conductorNombre: ejecucion.conductor?.usuario?.nombre || '—',
      vehiculo: ejecucion.vehiculo
        ? `${ejecucion.vehiculo.marca} ${ejecucion.vehiculo.modelo} - ${ejecucion.vehiculo.placa}`
        : '—',
      ultimaLat: ejecucion.coordenadas?.[0]?.lat ?? null,
      ultimaLng: ejecucion.coordenadas?.[0]?.lng ?? null,
      ultimaActualizacion: ejecucion.coordenadas?.[0]?.timestamp || ejecucion.iniciadaEn,
    } : null
  };
}

async function declararEstado({ pasajeroId, rutaId, estado }) {
  const estadosValidos = ['NORMAL', 'POR_MIS_MEDIOS', 'AUSENTE'];
  if (!estadosValidos.includes(estado)) {
    throw { status: 400, message: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` };
  }

  const ruta = await prisma.ruta.findUnique({ where: { id: rutaId } });
  if (!ruta) throw { status: 404, message: 'Ruta no encontrada' };

  const hoy = startOfDay();
  const result = await prisma.estadoTurno.upsert({
    where: { pasajeroId_rutaId_fecha: { pasajeroId, rutaId, fecha: hoy } },
    create: { pasajeroId, rutaId, fecha: hoy, estado, declaradoEn: new Date() },
    update: { estado, declaradoEn: new Date() }
  });

  const { getIo } = require('../../config/socket');
  getIo()?.to('supervisores').emit('pasajero:estado-cambiado', {
    pasajeroId, rutaId, estado, timestamp: new Date()
  });

  return result;
}

async function marcarEnParadero(pasajeroId) {
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
  aprobarPasajero, listarPasajeros, obtenerEstadosHoy, calificarServicio,
  obtenerMiPerfil, obtenerPasajeroPorUsuario
};
