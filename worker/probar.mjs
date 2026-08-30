// Test del Worker sin desplegarlo. Corre con: node worker/probar.mjs
// Node 22 trae Request/Response/fetch nativos, asi que el handler se
// puede ejecutar tal cual y espiar lo que le manda al origen.
import worker from './index.js';

let ok = 0, mal = 0;
const check = (n, cond, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${n}`); }
  else      { mal++; console.log(`  ❌ ${n} ${extra}`); }
};

const fetchReal = globalThis.fetch;
let capturada = null;
globalThis.fetch = async (req) => {
  capturada = req;
  const cuerpo = await req.clone().text().catch(() => '');
  return new Response(JSON.stringify({ recibido: cuerpo }), {
    status: 200, headers: { 'content-type': 'application/json', 'set-cookie': 'a=b' },
  });
};

const env = { ORIGEN: 'https://backend.ejemplo' };

console.log('\n── BUG 14: el body en POST tiene que llegar ──');
const cuerpo = JSON.stringify({ email: 'x@y.z', password: 'secreto' });
let r = await worker.fetch(new Request('https://viczul.com/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '200.1.2.3' }, body: cuerpo,
}), env);
const visto = await capturada.clone().text();
check('el body llega entero al origen', visto === cuerpo, `-> recibio: ${JSON.stringify(visto)}`);
check('conserva el metodo POST', capturada.method === 'POST');
check('reescribe el host al origen', capturada.url === 'https://backend.ejemplo/api/auth/login', capturada.url);
check('reenvia cf-connecting-ip (para el rate limit)', capturada.headers.get('cf-connecting-ip') === '200.1.2.3');
check('reenvia x-forwarded-for con la IP real', capturada.headers.get('x-forwarded-for') === '200.1.2.3');
check('no reenvia el host de Cloudflare', !capturada.headers.get('host')?.includes('viczul'));

console.log('\n── PATCH tambien lleva body (mi-domicilio) ──');
const patch = JSON.stringify({ lat: -16.4, lng: -71.5 });
await worker.fetch(new Request('https://viczul.com/api/pasajeros/mi-domicilio', {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: patch,
}), env);
check('el body del PATCH llega', (await capturada.clone().text()) === patch);

console.log('\n── GET no lleva body y conserva la query ──');
await worker.fetch(new Request('https://viczul.com/api/rutas?activas=1', { method: 'GET' }), env);
check('GET pasa sin body', capturada.body === null || capturada.body === undefined);
check('conserva el query string', capturada.url.endsWith('/api/rutas?activas=1'), capturada.url);

console.log('\n── la respuesta vuelve intacta y sin cache ──');
check('status del origen', r.status === 200);
check('no-store en la respuesta', r.headers.get('cache-control') === 'no-store');
check('conserva cabeceras del origen', r.headers.get('set-cookie') === 'a=b');

console.log('\n── OPTIONS se responde en el borde (no despierta a Render) ──');
capturada = null;
const pre = await worker.fetch(new Request('https://viczul.com/api/auth/login', {
  method: 'OPTIONS', headers: { origin: 'https://viczul.com', 'access-control-request-headers': 'authorization' },
}), env);
check('204 sin tocar el origen', pre.status === 204 && capturada === null);
check('devuelve el origin pedido', pre.headers.get('access-control-allow-origin') === 'https://viczul.com');
check('permite authorization', (pre.headers.get('access-control-allow-headers') || '').includes('authorization'));

console.log('\n── si el origen falla, error claro y no un 1101 ──');
globalThis.fetch = async () => { throw new Error('backend dormido'); };
const err = await worker.fetch(new Request('https://viczul.com/api/rutas'), env);
check('502 con json explicativo', err.status === 502);
check('el mensaje habla del minuto de arranque', /1 minuto/.test((await err.json()).error));

globalThis.fetch = fetchReal;
console.log(`\n${'─'.repeat(46)}\n${ok} ok, ${mal} fallando`);
process.exit(mal ? 1 : 0);
