// ════════════════════════════════════════════════════════════════
// PROXY DE API EN CLOUDFLARE  —  viczul.com/api/*  ->  Render
//
// Por que existe:
// Hasta ahora el navegador llamaba a transporte-mina.onrender.com
// DIRECTO. Verificado con headers: la web pasa por Cloudflare (cf-ray
// presente) y la API no (sin cf-ray). O sea que el WAF, el rate
// limiting del borde, el cache y las analiticas se aplicaban solo a
// HTML y JS estatico, y nada de eso protegia los logins ni los datos.
//
// Que arregla ademas — BUG 14 del HANDOFF:
// el Worker anterior NO reenviaba el body en POST. Por eso la app no
// lo usaba y llamaba a Render directo. Aca el body se reenvia siempre
// (ver reenviar()), y hay un test que lo comprueba:
//   node worker/probar.mjs
//
// Por que vive en el repo y no en el dashboard:
// la regla 4 dice NUNCA editar el Worker desde el dashboard de
// Cloudflare. Editandolo ahi no queda historial, no hay revision y no
// se puede volver atras. Aca es codigo: se despliega con
//   npx wrangler deploy
//
// Lo que NO pasa por aca: el WebSocket de Socket.io, que sigue yendo
// directo a Render. Socket.io hace polling + upgrade y meterlo detras
// del proxy es un riesgo que no hace falta correr hoy.
// ════════════════════════════════════════════════════════════════

const ORIGEN_POR_DEFECTO = 'https://transporte-mina.onrender.com';

// Cabeceras que NO se reenvian: las pone Cloudflare o son del hop.
const NO_REENVIAR = new Set([
  'host', 'cf-ray', 'cf-visitor', 'cf-ipcountry', 'cf-worker',
  'x-forwarded-host', 'connection', 'keep-alive', 'transfer-encoding',
]);

function cabecerasSalida(req) {
  const h = new Headers();
  for (const [k, v] of req.headers) {
    if (!NO_REENVIAR.has(k.toLowerCase())) h.set(k, v);
  }
  // La IP real del cliente, para que el rate limit del backend cuente
  // personas y no cuente a todo Cloudflare como un solo visitante.
  const ip = req.headers.get('cf-connecting-ip');
  if (ip) {
    h.set('cf-connecting-ip', ip);
    h.set('x-forwarded-for', ip);
  }
  return h;
}

async function reenviar(req, origen) {
  const url = new URL(req.url);
  const destino = new URL(url.pathname + url.search, origen);

  // ── EL ARREGLO DEL BUG 14 ──
  // GET y HEAD no pueden llevar body; todo lo demas SI, y el Worker
  // viejo lo perdia. `duplex: 'half'` hace falta para reenviar el
  // stream del cuerpo sin bufferearlo entero.
  const llevaCuerpo = !['GET', 'HEAD'].includes(req.method);

  const salida = new Request(destino.toString(), {
    method: req.method,
    headers: cabecerasSalida(req),
    body: llevaCuerpo ? req.body : undefined,
    ...(llevaCuerpo ? { duplex: 'half' } : {}),
    redirect: 'manual',
  });

  const resp = await fetch(salida);

  // Respuesta tal cual, pero sin que nadie cachee datos de la API.
  const h = new Headers(resp.headers);
  h.set('cache-control', 'no-store');
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

export default {
  async fetch(req, env) {
    const origen = (env && env.ORIGEN) || ORIGEN_POR_DEFECTO;

    // Preflight: se responde en el borde, sin molestar a Render (que
    // ademas puede estar dormido y tardar un minuto en despertar).
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin':  req.headers.get('origin') || '*',
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': req.headers.get('access-control-request-headers') || 'authorization,content-type',
          'access-control-max-age':       '86400',
        },
      });
    }

    try {
      return await reenviar(req, origen);
    } catch (err) {
      // Render dormido o caido: un error claro, no un 1101 de Cloudflare.
      return new Response(
        JSON.stringify({ error: 'El backend no responde. Si estuvo inactivo, puede tardar ~1 minuto en despertar.' }),
        { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
      );
    }
  },
};

export { reenviar, cabecerasSalida };
