const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function registrarCheckin({ rutaEjecucionId, paraderoId, pasajeroId, subio }) {
  if (!rutaEjecucionId || !paraderoId || !pasajeroId || subio === undefined) {
    throw { status: 400, message: 'rutaEjecucionId, paraderoId, pasajeroId y subio son requeridos' };
  }

  // Evitar duplicados
  const existe = await prisma.checkin.findFirst({
    where: { rutaEjecucionId, paraderoId, pasajeroId }
  });
  if (existe) {
    return prisma.checkin.update({
      where: { id: existe.id },
      data: { subio, timestamp: new Date() }
    });
  }

  const checkin = await prisma.checkin.create({
    data: { rutaEjecucionId, paraderoId, pasajeroId, subio }
  });

  // Si no subió → notificar al supervisor SOLO si no declaró POR_MIS_MEDIOS ni AUSENTE
  if (!subio) {
    const { getIo } = require('../../config/socket');
    const pasajero = await prisma.pasajero.findUnique({
      where: { id: pasajeroId },
      include: { usuario: { select: { nombre: true } }, paradero: { select: { nombre: true } } }
    });

    // BUG FIX: verificar estado del turno — no alertar si ya avisó
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const estadoHoy = await prisma.estadoTurno.findFirst({
      where: {
        pasajeroId,
        fecha: { gte: hoy }
      }
    });
    const yaAviso = estadoHoy && estadoHoy.estado !== 'NORMAL';

    if (!yaAviso) {
      getIo()?.to('supervisores').emit('alerta:ausente-sin-aviso', {
        rutaEjecucionId,
        paraderoId,
        pasajeroId,
        nombrePasajero: pasajero?.usuario?.nombre,
        nombreParadero: pasajero?.paradero?.nombre,
        estadoDeclarado: estadoHoy?.estado ?? 'SIN_DECLARAR',
        timestamp: new Date()
      });
    }
  }

  return checkin;
}

async function registrarCheckinsParadero(rutaEjecucionId, paraderoId, checkins) {
  // checkins: [{ pasajeroId, subio }]
  const resultados = await Promise.allSettled(
    checkins.map(c => registrarCheckin({ rutaEjecucionId, paraderoId, ...c }))
  );
  return resultados.map((r, i) => ({
    pasajeroId: checkins[i].pasajeroId,
    ok: r.status === 'fulfilled',
    error: r.reason?.message
  }));
}

async function obtenerCheckinsPorRuta(rutaEjecucionId) {
  return prisma.checkin.findMany({
    where: { rutaEjecucionId },
    include: {
      pasajero: { include: { usuario: { select: { nombre: true } } } },
      paradero: { select: { nombre: true, orden: true } }
    },
    orderBy: [{ paradero: { orden: 'asc' } }, { timestamp: 'asc' }]
  });
}

async function resumenCheckins(rutaEjecucionId) {
  const checkins = await prisma.checkin.findMany({ where: { rutaEjecucionId } });
  const recogidos = checkins.filter(c => c.subio).length;
  const ausentes = checkins.filter(c => !c.subio).length;
  return {
    recogidos,
    ausentes,
    total: checkins.length,
    puntualidad: checkins.length > 0 ? Math.round((recogidos / checkins.length) * 100) : 100
  };
}

module.exports = {
  registrarCheckin, registrarCheckinsParadero,
  obtenerCheckinsPorRuta, resumenCheckins
};
