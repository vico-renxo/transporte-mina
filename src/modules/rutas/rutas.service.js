const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { alertasService } = require('../alertas/alertas.service');

async function listarRutas() {
  const rutas = await prisma.ruta.findMany({
    where: { activa: true },
    include: {
      paraderos: {
        orderBy: { orden: 'asc' },
        include: { pasajeros: { where: { aprobado: true }, select: { id: true } } }
      },
      _count: { select: { paraderos: true } },
      ejecuciones: {
        where: { estado: 'EN_RUTA' },
        take: 1,
        select: { id: true, estado: true }
      }
    },
    orderBy: { horaInicio: 'asc' }
  });

  return rutas.map(r => ({
    ...r,
    ejecucionActiva: r.ejecuciones?.[0] || null,
    _count: {
      ...r._count,
      pasajeros: r.paraderos.reduce((sum, p) => sum + p.pasajeros.length, 0)
    }
  }));
}

async function obtenerRuta(id) {
  const ruta = await prisma.ruta.findUnique({
    where: { id },
    include: { paraderos: { orderBy: { orden: 'asc' }, include: { pasajeros: { include: { usuario: true } } } } }
  });
  if (!ruta) throw { status: 404, message: 'Ruta no encontrada' };
  return ruta;
}

async function crearRuta({ nombre, origen, destino, horaInicio, dias, paraderos }) {
  if (!nombre || !horaInicio) {
    throw { status: 400, message: 'nombre y horaInicio son requeridos' };
  }
  return prisma.ruta.create({
    data: {
      nombre,
      origen:  origen  || '',
      destino: destino || '',
      horaInicio,
      dias:    dias    || [],
      paraderos: paraderos?.length ? {
        create: paraderos.map((p, i) => ({
          nombre:    p.nombre,
          direccion: p.direccion || p.nombre,
          lat:       p.lat  || 0,
          lng:       p.lng  || 0,
          orden:     i + 1
        }))
      } : undefined
    },
    include: { paraderos: { orderBy: { orden: 'asc' } } }
  });
}

async function actualizarRuta(id, datos) {
  const { paraderos, ...rutaData } = datos;
  return prisma.ruta.update({ where: { id }, data: rutaData });
}

async function iniciarRuta({ rutaId, conductorId, vehiculoId }) {
  if (!rutaId || !conductorId || !vehiculoId) {
    throw { status: 400, message: 'rutaId, conductorId y vehiculoId requeridos' };
  }

  // Verificar que no haya una ejecución activa para esta ruta hoy
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const activa = await prisma.rutaEjecucion.findFirst({
    where: { rutaId, estado: 'EN_RUTA', fecha: { gte: hoy } }
  });
  if (activa) throw { status: 409, message: 'Esta ruta ya tiene una ejecución activa hoy' };

  const ejecucion = await prisma.rutaEjecucion.create({
    data: {
      rutaId, conductorId, vehiculoId,
      estado: 'EN_RUTA',
      iniciadaEn: new Date()
    }
  });

  // Enviar Alerta Tipo 1 a todos los pasajeros (async, no bloquea)
  alertasService.enviarAlertaInicioRuta(ejecucion.id).catch(err =>
    console.error('Error enviando alerta inicio ruta:', err.message)
  );

  return ejecucion;
}

async function finalizarRuta(rutaEjecucionId) {
  const ejecucion = await prisma.rutaEjecucion.update({
    where: { id: rutaEjecucionId },
    data: { estado: 'COMPLETADA', finalizadaEn: new Date() }
  });

  // Generar resumen para el supervisor
  const checkins = await prisma.checkin.findMany({ where: { rutaEjecucionId } });
  const recogidos = checkins.filter(c => c.subio).length;
  const ausentes = checkins.filter(c => !c.subio).length;
  const duracionMin = ejecucion.finalizadaEn && ejecucion.iniciadaEn
    ? Math.round((ejecucion.finalizadaEn - ejecucion.iniciadaEn) / 60000) : null;

  const { getIo } = require('../../config/socket');
  getIo()?.to('supervisores').emit('ruta:finalizada', {
    rutaEjecucionId,
    recogidos,
    ausentes,
    duracionMin,
    puntualidad: recogidos + ausentes > 0
      ? Math.round((recogidos / (recogidos + ausentes)) * 100) : 100
  });

  return { ...ejecucion, resumen: { recogidos, ausentes, duracionMin } };
}

async function reportarIncidencia(rutaEjecucionId, mensaje) {
  await prisma.rutaEjecucion.update({
    where: { id: rutaEjecucionId },
    data: { estado: 'SUSPENDIDA', finalizadaEn: new Date() }
  });
  await alertasService.enviarAlertaEmergencia(rutaEjecucionId, mensaje);
  return { ok: true, mensaje: 'Incidencia reportada. Pasajeros y supervisor notificados.' };
}

async function obtenerEjecucionesActivas() {
  const rows = await prisma.rutaEjecucion.findMany({
    where: { estado: 'EN_RUTA' },
    include: {
      ruta: { include: { paraderos: { orderBy: { orden: 'asc' } } } },
      conductor: { include: { usuario: { select: { nombre: true, telefono: true } } } },
      vehiculo: true,
      coordenadas: { orderBy: { timestamp: 'desc' }, take: 1 },
      checkins: { select: { subio: true } }
    },
    orderBy: { iniciadaEn: 'desc' }
  });

  // Haversine para calcular distancia entre dos puntos GPS (en km)
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  const ejecuciones = rows.map(e => {
    const lat = e.coordenadas?.[0]?.lat ?? null;
    const lng = e.coordenadas?.[0]?.lng ?? null;

    // Calcular paradero actual: el más cercano al bus con coordenadas GPS
    let paraderoActual = 0;
    if (lat !== null && lng !== null && e.ruta?.paraderos?.length) {
      let minDist = Infinity;
      e.ruta.paraderos.forEach((p, idx) => {
        if (p.lat && p.lng) {
          const d = haversine(lat, lng, p.lat, p.lng);
          if (d < minDist) { minDist = d; paraderoActual = p.orden; }
        }
      });
    }

    return {
      id: e.id,
      conductorId:      e.conductorId,
      rutaNombre:       e.ruta?.nombre                    || '—',
      conductorNombre:  e.conductor?.usuario?.nombre      || '—',
      vehiculoPlaca:    e.vehiculo?.placa                 || '—',
      paraderoActual,
      totalParaderos:   e.ruta?.paraderos?.length         || 0,
      pasajerosAbordo:  (e.checkins || []).filter(c => c.subio).length,
      ultimaActualizacion: e.coordenadas?.[0]?.timestamp || e.iniciadaEn,
      ultimaLat: lat,
      ultimaLng: lng,
      estado: e.estado,
    };
  });

  return { ejecuciones };
}

async function historialEjecuciones({ fecha, rutaId, conductorId, limite = 50 }) {
  const where = {};
  if (fecha) {
    // BUG FIX: usar setUTCHours para evitar desfase por zona horaria local de Windows
    const d = new Date(fecha);
    d.setUTCHours(0, 0, 0, 0);
    const fin = new Date(fecha);
    fin.setUTCHours(23, 59, 59, 999);
    where.fecha = { gte: d, lte: fin };
  }
  if (rutaId) where.rutaId = rutaId;
  if (conductorId) where.conductorId = conductorId;

  return prisma.rutaEjecucion.findMany({
    where,
    include: {
      ruta: { select: { nombre: true, horaInicio: true } },
      conductor: { include: { usuario: { select: { nombre: true } } } },
      vehiculo: { select: { placa: true } }
    },
    orderBy: { fecha: 'desc' },
    take: Number(limite)
  });
}

module.exports = {
  listarRutas, obtenerRuta, crearRuta, actualizarRuta,
  iniciarRuta, finalizarRuta, reportarIncidencia,
  obtenerEjecucionesActivas, historialEjecuciones
};
