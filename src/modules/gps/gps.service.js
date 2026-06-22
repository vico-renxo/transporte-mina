const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function guardarCoordenada({ rutaEjecucionId, lat, lng, velocidad }) {
  return prisma.coordenada.create({
    data: { rutaEjecucionId, lat, lng, velocidad: velocidad || null }
  });
}

async function obtenerUltimaCoordenada(rutaEjecucionId) {
  return prisma.coordenada.findFirst({
    where: { rutaEjecucionId },
    orderBy: { timestamp: 'desc' }
  });
}

async function obtenerHistorial(rutaEjecucionId) {
  return prisma.coordenada.findMany({
    where: { rutaEjecucionId },
    orderBy: { timestamp: 'asc' },
    select: { lat: true, lng: true, velocidad: true, timestamp: true }
  });
}

module.exports = { guardarCoordenada, obtenerUltimaCoordenada, obtenerHistorial };
