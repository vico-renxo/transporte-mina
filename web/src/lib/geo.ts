// ════════════════════════════════════════════════════════════════
// GEOMETRIA COMPARTIDA
//
// Antes habia dos Haversine con la misma formula y firmas distintas:
// una en (app)/pasajeros/page.tsx tomando objetos, otra en
// pasajero/page.tsx tomando cuatro numeros sueltos.
//
// No es un detalle de estilo: con esta cuenta el admin decide que
// paradero le queda mas cerca al domicilio de un pasajero. Si un dia
// una de las dos cambia (el radio, un redondeo) y la otra no, la app
// asigna paraderos con un criterio y los muestra con otro, y nadie se
// entera hasta que alguien camina veinte cuadras de mas.
//
// Una sola formula, una sola firma.
// ════════════════════════════════════════════════════════════════

export interface Punto { lat: number; lng: number }

const RADIO_TIERRA_KM = 6371;
const aRadianes = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en kilometros entre dos puntos, sobre la superficie terrestre. */
export function distKm(a: Punto, b: Punto): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;
  return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

