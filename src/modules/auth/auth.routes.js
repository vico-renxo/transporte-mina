const express = require('express');
const { login, registrarPasajero, actualizarFcmToken, cambiarPassword } = require('./auth.service');
const { authMiddleware } = require('../../shared/middleware/auth');
const { rateLimit } = require('../../shared/middleware/rateLimit');

// Limites por IP. Sin esto, probar contrasenas contra /login o contra
// /cambiar-password (que responde 400 si la actual es incorrecta, o sea que
// confirma aciertos) sale gratis y es ilimitado.
const limiteLogin    = rateLimit({ nombre: 'login',     max: 10, ventanaMs: 10 * 60 * 1000 });
const limiteRegistro = rateLimit({ nombre: 'registro',  max: 5,  ventanaMs: 60 * 60 * 1000 });
const limiteCambio   = rateLimit({ nombre: 'cambio-pw', max: 5,  ventanaMs: 15 * 60 * 1000 });
const router = express.Router();

router.post('/login', limiteLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw { status: 400, message: 'Email y password requeridos' };
    res.json(await login(email, password));
  } catch (err) { next(err); }
});

router.post('/registro-pasajero', limiteRegistro, async (req, res, next) => {
  try {
    const { nombre, email, telefono, password, domicilioLat, domicilioLng, direccion, paraderoId } = req.body;
    if (!nombre || !email || !telefono || !password) {
      throw { status: 400, message: 'Todos los campos son requeridos' };
    }
    res.status(201).json(await registrarPasajero({ nombre, email, telefono, password, domicilioLat, domicilioLng, direccion, paraderoId }));
  } catch (err) { next(err); }
});

router.post('/fcm-token', authMiddleware, async (req, res, next) => {
  try {
    await actualizarFcmToken(req.usuario.id, req.body.fcmToken);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/cambiar-password', limiteCambio, authMiddleware, async (req, res, next) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    await cambiarPassword(req.usuario.id, passwordActual, passwordNueva);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json(req.usuario);
});

module.exports = router;
