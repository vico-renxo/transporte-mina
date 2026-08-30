// ════════════════════════════════════════════════════════════════
// RATE LIMIT — sin dependencias
//
// Por que existe: no habia ninguno. POST /api/auth/login se podia
// martillar sin limite, y peor, POST /api/auth/cambiar-password
// responde 400 "Contrasena actual incorrecta": es un oraculo que dice
// si adivinaste. Con eso, probar contrasenas es gratis e ilimitado.
//
// Por que a mano y no express-rate-limit: los guardianes de este
// proyecto son cero dependencias y esto son 40 lineas. Render free
// corre UNA sola instancia, asi que un contador en memoria alcanza.
// El dia que haya varias instancias esto deja de ser exacto — y ese
// dia conviene que el limite lo ponga Cloudflare en el borde.
// ════════════════════════════════════════════════════════════════

// clave -> array de timestamps dentro de la ventana
const golpes = new Map();

// Limpieza periodica: sin esto, un atacante rotando IPs llena la memoria.
const LIMPIEZA_MS = 5 * 60 * 1000;
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, tiempos] of golpes) {
    const vivos = tiempos.filter(t => ahora - t < 60 * 60 * 1000);
    if (vivos.length === 0) golpes.delete(clave);
    else golpes.set(clave, vivos);
  }
}, LIMPIEZA_MS).unref?.();

/**
 * @param {object} opciones
 * @param {number} opciones.max        golpes permitidos en la ventana
 * @param {number} opciones.ventanaMs  tamano de la ventana
 * @param {string} opciones.nombre     para separar contadores por endpoint
 */
function rateLimit({ max, ventanaMs, nombre }) {
  return (req, res, next) => {
    // Detras de Render (y manana de Cloudflare) req.ip puede ser el proxy.
    const ip =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.ip ||
      'desconocida';

    const clave = `${nombre}:${ip}`;
    const ahora = Date.now();
    const tiempos = (golpes.get(clave) || []).filter(t => ahora - t < ventanaMs);

    if (tiempos.length >= max) {
      const esperaMs = ventanaMs - (ahora - tiempos[0]);
      const segundos = Math.ceil(esperaMs / 1000);
      res.set('Retry-After', String(segundos));
      return res.status(429).json({
        error: `Demasiados intentos. Espera ${segundos} segundos.`,
      });
    }

    tiempos.push(ahora);
    golpes.set(clave, tiempos);
    next();
  };
}

// Solo para los tests: vaciar el estado entre casos.
function _reiniciar() { golpes.clear(); }

module.exports = { rateLimit, _reiniciar };
