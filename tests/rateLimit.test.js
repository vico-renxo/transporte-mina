const { rateLimit, _reiniciar } = require('../src/shared/middleware/rateLimit');

// Simulador minimo de req/res: el middleware no necesita express de verdad.
function pegar(mw, ip, headers = {}) {
  const req = { ip, headers };
  let estado = 200, cuerpo = null; const cabeceras = {};
  let paso = false;
  const res = {
    set: (k, v) => { cabeceras[k] = v; },
    status(c) { estado = c; return this; },
    json(o) { cuerpo = o; return this; },
  };
  mw(req, res, () => { paso = true; });
  return { paso, estado, cuerpo, cabeceras };
}

beforeEach(() => _reiniciar());

describe('rateLimit', () => {
  test('deja pasar hasta el limite y bloquea el siguiente con 429', () => {
    const mw = rateLimit({ max: 3, ventanaMs: 1000, nombre: 'login' });
    expect([1, 2, 3].map(() => pegar(mw, '1.1.1.1').paso)).toEqual([true, true, true]);

    const cuarto = pegar(mw, '1.1.1.1');
    expect(cuarto.paso).toBe(false);
    expect(cuarto.estado).toBe(429);
    expect(cuarto.cabeceras['Retry-After']).toBeDefined();
    expect(cuarto.cuerpo.error).toMatch(/Espera \d+ segundos/);
  });

  test('cada IP lleva su propio contador', () => {
    const mw = rateLimit({ max: 1, ventanaMs: 1000, nombre: 'login' });
    pegar(mw, '1.1.1.1');
    expect(pegar(mw, '1.1.1.1').paso).toBe(false);
    expect(pegar(mw, '2.2.2.2').paso).toBe(true);
  });

  test('cada endpoint lleva su propio contador', () => {
    const uno = rateLimit({ max: 1, ventanaMs: 1000, nombre: 'login' });
    const dos = rateLimit({ max: 1, ventanaMs: 1000, nombre: 'cambio-pw' });
    pegar(uno, '1.1.1.1');
    expect(pegar(uno, '1.1.1.1').paso).toBe(false);
    expect(pegar(dos, '1.1.1.1').paso).toBe(true);
  });

  test('cf-connecting-ip le gana a req.ip', () => {
    const mw = rateLimit({ max: 1, ventanaMs: 1000, nombre: 'x' });
    pegar(mw, '9.9.9.9', { 'cf-connecting-ip': '5.5.5.5' });
    // misma IP real detras de Cloudflare, aunque el socket cambie
    expect(pegar(mw, '8.8.8.8', { 'cf-connecting-ip': '5.5.5.5' }).paso).toBe(false);
    expect(pegar(mw, '9.9.9.9', { 'cf-connecting-ip': '6.6.6.6' }).paso).toBe(true);
  });

  test('la ventana se libera sola', async () => {
    const mw = rateLimit({ max: 2, ventanaMs: 300, nombre: 'v' });
    pegar(mw, '3.3.3.3'); pegar(mw, '3.3.3.3');
    expect(pegar(mw, '3.3.3.3').paso).toBe(false);
    await new Promise(r => setTimeout(r, 350));
    expect(pegar(mw, '3.3.3.3').paso).toBe(true);
  });
});
