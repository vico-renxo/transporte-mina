const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});

async function calcularETA(origenLat, origenLng, destinoLat, destinoLng) {
  if (!process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY === 'tu_api_key_aqui') {
    // Modo demo: distancia euclidiana aproximada
    const dist = Math.sqrt(Math.pow(destinoLat - origenLat, 2) + Math.pow(destinoLng - origenLng, 2));
    const minutos = Math.round(dist * 111 / 0.5); // ~30 km/h
    return {
      duracionSegundos: minutos * 60,
      duracionTexto: `${minutos} min`,
      distanciaMetros: Math.round(dist * 111000),
      distanciaTexto: `${(dist * 111).toFixed(1)} km`
    };
  }

  const response = await client.directions({
    params: {
      origin: `${origenLat},${origenLng}`,
      destination: `${destinoLat},${destinoLng}`,
      mode: 'driving',
      departure_time: 'now',
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });

  const ruta = response.data.routes[0];
  if (!ruta) return null;
  const leg = ruta.legs[0];

  return {
    duracionSegundos: leg.duration_in_traffic?.value || leg.duration.value,
    duracionTexto: leg.duration_in_traffic?.text || leg.duration.text,
    distanciaMetros: leg.distance.value,
    distanciaTexto: leg.distance.text
  };
}

async function calcularETAMultiples(origenLat, origenLng, paraderos) {
  const resultados = await Promise.allSettled(
    paraderos.map(async (p) => {
      const eta = await calcularETA(origenLat, origenLng, p.lat, p.lng);
      return { paraderoId: p.id, nombre: p.nombre, ...eta };
    })
  );
  return resultados
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

module.exports = { calcularETA, calcularETAMultiples };
