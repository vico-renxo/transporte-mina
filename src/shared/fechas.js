// ════════════════════════════════════════════════════════════════
// FECHAS COMPARTIDAS
//
// Antes estas funciones estaban copiadas en CINCO lugares (alertas,
// pasajeros, rutas y dos veces en reportes). Una sola definicion.
// ════════════════════════════════════════════════════════════════

// ── HUSO HORARIO ──
// Corregido el 2026-08-30. Antes esto devolvia la medianoche del
// SERVIDOR: Render corre en UTC, asi que el "dia" arrancaba a las
// 19:00 hora de Lima del dia anterior.
//
// Consecuencia real: un viaje de vuelta de la mina a las 19:30 se
// guardaba con fecha de HOY, pero al consultarlo caia en la ventana
// de MANANA. El reporte del dia no lo mostraba y el estado del
// pasajero para ese turno tampoco. Silencioso: nada falla, solo
// faltan filas.
//
// Peru (America/Lima) es UTC-5 todo el ano: no tiene horario de
// verano desde 1994. Por eso alcanza con el offset fijo y no hace
// falta ninguna dependencia ni Intl.
const OFFSET_PERU_MS = 5 * 60 * 60 * 1000;

/** Medianoche en Lima del dia indicado (por defecto, hoy), como instante UTC. */
function startOfDay(fecha = new Date()) {
  const d = new Date(fecha);
  // Corro el reloj a "hora Lima", trunco el dia ahi, y vuelvo a UTC.
  const enLima = new Date(d.getTime() - OFFSET_PERU_MS);
  enLima.setUTCHours(0, 0, 0, 0);
  return new Date(enLima.getTime() + OFFSET_PERU_MS);
}

/** El ultimo milisegundo del dia en Lima (por defecto, hoy), como instante UTC. */
function endOfDay(fecha = new Date()) {
  const d = new Date(fecha);
  const enLima = new Date(d.getTime() - OFFSET_PERU_MS);
  enLima.setUTCHours(23, 59, 59, 999);
  return new Date(enLima.getTime() + OFFSET_PERU_MS);
}

module.exports = { startOfDay, endOfDay, OFFSET_PERU_MS };
