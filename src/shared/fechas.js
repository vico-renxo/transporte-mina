// ════════════════════════════════════════════════════════════════
// FECHAS COMPARTIDAS
//
// Antes esta funcion estaba copiada en alertas.service.js y en
// pasajeros.service.js. Identicas, pero nada garantizaba que
// siguieran siendolo: si una empezaba a considerar el huso de Peru
// y la otra no, los estados del dia y las alertas iban a discrepar
// sin que nadie lo notara. Una sola definicion, un solo lugar.
// ════════════════════════════════════════════════════════════════

// OJO — HUSO HORARIO. Esto devuelve la medianoche segun el reloj del
// SERVIDOR, no el de Peru. Render corre en UTC, asi que hoy el "dia"
// arranca a las 19:00 hora de Lima del dia anterior.
//
// En la practica no molesta porque las rutas arrancan de madrugada y
// terminan de tarde, bien dentro de la ventana. Pero es una bomba de
// tiempo: el dia que se consulte "lo de hoy" entre las 19:00 y las
// 00:00 de Lima, va a contestar con el dia siguiente.
//
// NO se cambio junto con la unificacion a proposito: mover la ventana
// 5 horas altera que registros de EstadoTurno matchean, y eso es un
// cambio de comportamiento en produccion que merece su propia decision
// y su propia prueba. Esta anotado en HANDOFF.md como pendiente.
/** Medianoche del dia indicado (por defecto, hoy). */
function startOfDay(fecha = new Date()) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** El ultimo milisegundo del dia indicado (por defecto, hoy). */
function endOfDay(fecha = new Date()) {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

module.exports = { startOfDay, endOfDay };
