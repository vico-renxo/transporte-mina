const jwt = require('jsonwebtoken');

// El token lleva `pv`: una huella del hash de la contrasena del usuario.
// Comparandola contra la actual, cambiar la contrasena mata las sesiones
// abiertas en otros dispositivos sin necesidad de columna nueva ni
// migracion. Cuesta una lectura por usuario cada 60s (hay cache).
// Ver el comentario largo en auth.service.js.
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const { huellaSigueValida } = require('../../modules/auth/auth.service');
  if (!(await huellaSigueValida(payload.id, payload.pv))) {
    return res.status(401).json({ error: 'Sesión cerrada: la contraseña cambió' });
  }

  req.usuario = payload;
  next();
}

function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: `Rol requerido: ${roles.join(' o ')}` });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRol };
