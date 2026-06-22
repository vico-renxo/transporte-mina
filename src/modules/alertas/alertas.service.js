const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calcularETA, calcularETAMultiples } = require('./google-maps.service');
const { enviarPush, enviarPushMultiple } = require('./fcm.service');
const { enviarSMS } = require('./sms.service');

// Cache para evitar enviar la misma alerta de proximidad dos veces
// Key: "rutaEjecucionId:paraderoId" → true
const alertasProximidadEnviadas = new Set();

// -------------------------------------------------------
// ALERTA TIPO 2: Proximidad — se llama con cada coordenada
// -------------------------------------------------------
async function verificarProximidad(rutaEjecucionId, lat, lng) {
  const ejecucion = await prisma.rutaEjecucion.findUnique({
    where: { id: rutaEjecucionId },
    include: {
      ruta: {
        include: {
          paraderos: {
            orderBy: { orden: 'asc' },
            include: {
              pasajeros: {
                where: { aprobado: true },
                include: {
                  usuario: { select: { nombre: true, telefono: true, fcmToken: true } },
                  estados: {
                    where: { fecha: { gte: startOfDay() } },
                    take: 1
                  }
                }
              }
            }
          }
        }
      },
      vehiculo: { select: { placa: true, modelo: true } },
      conductor: { include: { usuario: { select: { nombre: true } } } }
    }
  });

  if (!ejecucion || ejecucion.estado !== 'EN_RUTA') return;

  for (const paradero of ejecucion.ruta.paraderos) {
    const cacheKey = `${rutaEjecucionId}:${paradero.id}`;
    if (alertasProximidadEnviadas.has(cacheKey)) continue;

    // Solo pasajeros en estado NORMAL
    const pasajerosActivos = paradero.pasajeros.filter(p => {
      const estado = p.estados[0]?.estado ?? 'NORMAL';
      return estado === 'NORMAL';
    });
    if (!pasajerosActivos.length) continue;

    const eta = await calcularETA(lat, lng, paradero.lat, paradero.lng);
    if (!eta) continue;

    const minutos = Math.ceil(eta.duracionSegundos / 60);
    const umbralMax = Math.max(...pasajerosActivos.map(p => p.tiempoAlertaMin ?? 5));

    if (minutos <= umbralMax) {
      alertasProximidadEnviadas.add(cacheKey); // marcar ANTES de enviar para no duplicar
      await enviarAlertasProximidadParadero(pasajerosActivos, paradero, minutos, ejecucion);
    }
  }
}

async function enviarAlertasProximidadParadero(pasajeros, paradero, minutos, ejecucion) {
  for (const pasajero of pasajeros) {
    const umbral = pasajero.tiempoAlertaMin ?? 5;
    // Solo alertar si el ETA es ≤ umbral de ESTE pasajero específico
    if (minutos > umbral) continue;

    const titulo = `⚡ ¡Tu transporte llega en ${minutos} min!`;
    const cuerpo = `${ejecucion.vehiculo.placa} · ${ejecucion.conductor.usuario.nombre} · Paradero: ${paradero.nombre}`;

    await Promise.allSettled([
      enviarPush(pasajero.usuario.fcmToken, titulo, cuerpo, {
        tipo: 'PROXIMIDAD',
        rutaEjecucionId: ejecucion.id,
        paraderoId: paradero.id,
        minutos: String(minutos)
      }),
      enviarSMS(pasajero.usuario.telefono,
        `[TransporteMina] ⚡ Tu transporte llega en ${minutos} min. Unidad: ${ejecucion.vehiculo.placa}. Paradero: ${paradero.nombre}`)
    ]);
  }
}

// -------------------------------------------------------
// ALERTA TIPO 1: Inicio de ruta — broadcast masivo con ETA personal
// -------------------------------------------------------
async function enviarAlertaInicioRuta(rutaEjecucionId) {
  const ejecucion = await prisma.rutaEjecucion.findUnique({
    where: { id: rutaEjecucionId },
    include: {
      ruta: {
        include: {
          paraderos: {
            orderBy: { orden: 'asc' },
            include: {
              pasajeros: {
                where: { aprobado: true },
                include: {
                  usuario: { select: { nombre: true, telefono: true, fcmToken: true } },
                  estados: {
                    where: { fecha: { gte: startOfDay() } },
                    take: 1
                  }
                }
              }
            }
          }
        }
      },
      conductor: { include: { usuario: { select: { nombre: true } } } },
      vehiculo: { select: { placa: true, modelo: true } }
    }
  });

  if (!ejecucion) return;

  const paraderos = ejecucion.ruta.paraderos;
  const primerParadero = paraderos[0];
  if (!primerParadero) return;

  // Calcular ETA desde primer paradero a todos los demás
  const etas = await calcularETAMultiples(
    primerParadero.lat, primerParadero.lng,
    paraderos.slice(1)
  );
  const etaMap = Object.fromEntries(etas.map(e => [e.paraderoId, e]));

  // Enviar alerta personalizada a cada pasajero
  for (const paradero of paraderos) {
    const etaParadero = etaMap[paradero.id];
    const horaEstimada = etaParadero
      ? horaLlegadaTexto(etaParadero.duracionSegundos)
      : 'en camino';

    for (const pasajero of paradero.pasajeros) {
      const estado = pasajero.estados[0]?.estado ?? 'NORMAL';
      if (estado !== 'NORMAL') continue;

      const titulo = `🚌 Ruta ${ejecucion.ruta.nombre} iniciada`;
      const cuerpo =
        `Conductor: ${ejecucion.conductor.usuario.nombre} · Placa: ${ejecucion.vehiculo.placa}` +
        ` · Tu recojo est. ${horaEstimada} · ${paradero.nombre}`;

      await Promise.allSettled([
        enviarPush(pasajero.usuario.fcmToken, titulo, cuerpo, {
          tipo: 'INICIO_RUTA',
          rutaEjecucionId: ejecucion.id,
          horaEstimada,
          paraderoNombre: paradero.nombre,
          conductorNombre: ejecucion.conductor.usuario.nombre,
          vehiculoPlaca: ejecucion.vehiculo.placa
        }),
        enviarSMS(pasajero.usuario.telefono,
          `[TransporteMina] Ruta ${ejecucion.ruta.nombre} iniciada. ` +
          `${ejecucion.conductor.usuario.nombre} - ${ejecucion.vehiculo.placa}. ` +
          `Tu recojo est. ${horaEstimada}. Paradero: ${paradero.nombre}`)
      ]);
    }
  }

  // Limpiar cache de proximidad para esta ejecución (nueva ruta = nuevas alertas)
  alertasProximidadEnviadas.forEach(key => {
    if (key.startsWith(rutaEjecucionId)) alertasProximidadEnviadas.delete(key);
  });
}

// -------------------------------------------------------
// ALERTA DE EMERGENCIA: avería, accidente, desvío
// -------------------------------------------------------
async function enviarAlertaEmergencia(rutaEjecucionId, mensaje) {
  const ejecucion = await prisma.rutaEjecucion.findUnique({
    where: { id: rutaEjecucionId },
    include: {
      ruta: {
        include: {
          paraderos: {
            include: {
              pasajeros: {
                where: { aprobado: true },
                include: { usuario: { select: { fcmToken: true, telefono: true } } }
              }
            }
          }
        }
      },
      conductor: { include: { usuario: { select: { nombre: true, telefono: true } } } },
      vehiculo: { select: { placa: true } }
    }
  });

  if (!ejecucion) return;

  const tokens = [];
  const telefonos = [];

  for (const paradero of ejecucion.ruta.paraderos) {
    for (const pasajero of paradero.pasajeros) {
      if (pasajero.usuario.fcmToken) tokens.push(pasajero.usuario.fcmToken);
      if (pasajero.usuario.telefono) telefonos.push(pasajero.usuario.telefono);
    }
  }

  const titulo = '🚨 Servicio suspendido';
  const cuerpo = mensaje || 'Tu transporte reportó una incidencia. Busca transporte alternativo.';

  await Promise.allSettled([
    enviarPushMultiple(tokens, titulo, cuerpo, {
      tipo: 'EMERGENCIA',
      rutaEjecucionId,
      conductorNombre: ejecucion.conductor.usuario.nombre,
      vehiculoPlaca: ejecucion.vehiculo.placa
    }),
    ...telefonos.map(t => enviarSMS(t,
      `[TransporteMina] 🚨 SERVICIO SUSPENDIDO - ${ejecucion.vehiculo.placa}: ${cuerpo}`))
  ]);
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function horaLlegadaTexto(duracionSegundos) {
  const llegada = new Date(Date.now() + duracionSegundos * 1000);
  return llegada.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

const alertasService = {
  verificarProximidad,
  enviarAlertaInicioRuta,
  enviarAlertaEmergencia
};

module.exports = { alertasService };
