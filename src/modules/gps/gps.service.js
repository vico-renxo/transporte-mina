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

// Info de la ejecucion usada en los eventos de socket (nombre de ruta,
// conductor y placa). Se pedia en CADA coordenada GPS, pero esos datos no
// cambian durante la ejecucion: cachearlos evita una query por ping y
// cuida las pocas conexiones que da Supabase free.
const CACHE_EJECUCION_MS = 5 * 60 * 1000;
const cacheEjecucion = new Map(); // rutaEjecucionId -> { valor, expira }

async function obtenerInfoEjecucion(rutaEjecucionId) {
  const ahora = Date.now();
  const guardado = cacheEjecucion.get(rutaEjecucionId);
  if (guardado && guardado.expira > ahora) return guardado.valor;

  const valor = await prisma.rutaEjecucion.findUnique({
    where: { id: rutaEjecucionId },
    include: {
      ruta:      { select: { nombre: true } },
      conductor: { include: { usuario: { select: { nombre: true } } } },
      vehiculo:  { select: { placa: true } }
    }
  });

  // Un null no se cachea: puede ser una ejecucion recien creada.
  if (valor) {
    if (cacheEjecucion.size > 500) {
      for (const [k, v] of cacheEjecucion) if (v.expira <= ahora) cacheEjecucion.delete(k);
    }
    cacheEjecucion.set(rutaEjecucionId, { valor, expira: ahora + CACHE_EJECUCION_MS });
  }
  return valor;
}

// Llamar al finalizar o editar una ejecucion para no servir datos viejos.
function olvidarEjecucion(rutaEjecucionId) {
  cacheEjecucion.delete(rutaEjecucionId);
}

module.exports = { guardarCoordenada, obtenerUltimaCoordenada, obtenerHistorial, obtenerInfoEjecucion, olvidarEjecucion };
