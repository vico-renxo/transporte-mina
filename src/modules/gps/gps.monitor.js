const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LIMITE_SIN_SEÑAL_MS = 10 * 60 * 1000; // 10 minutos
const INTERVALO_CHECK_MS = 60 * 1000; // cada 1 minuto

async function monitorearGPS(io) {
  try {
    const activas = await prisma.rutaEjecucion.findMany({
      where: { estado: 'EN_RUTA' },
      include: {
        coordenadas: { orderBy: { timestamp: 'desc' }, take: 1 },
        conductor: { include: { usuario: { select: { nombre: true, telefono: true } } } },
        ruta: { select: { nombre: true } }
      }
    });

    for (const ejecucion of activas) {
      const ultima = ejecucion.coordenadas[0];
      if (!ultima) continue;

      const hace = Date.now() - new Date(ultima.timestamp).getTime();

      if (hace > LIMITE_SIN_SEÑAL_MS) {
        io.to('supervisores').emit('alerta:gps-perdido', {
          rutaEjecucionId: ejecucion.id,
          rutaNombre: ejecucion.ruta.nombre,
          conductor: ejecucion.conductor.usuario.nombre,
          telefonoConductor: ejecucion.conductor.usuario.telefono,
          ultimaUbicacion: { lat: ultima.lat, lng: ultima.lng, timestamp: ultima.timestamp },
          minutosDesconectado: Math.round(hace / 60000)
        });
      }
    }
  } catch (err) {
    console.error('Monitor GPS error:', err.message);
  }
}

function iniciarMonitor(io) {
  const intervalo = setInterval(() => monitorearGPS(io), INTERVALO_CHECK_MS);
  console.log('📡 Monitor GPS iniciado (verifica cada 60s)');
  return intervalo;
}

module.exports = { iniciarMonitor };
