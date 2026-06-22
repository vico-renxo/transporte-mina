const express = require('express');
const { login, registrarPasajero, actualizarFcmToken, cambiarPassword } = require('./auth.service');
const { authMiddleware } = require('../../shared/middleware/auth');
const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw { status: 400, message: 'Email y password requeridos' };
    res.json(await login(email, password));
  } catch (err) { next(err); }
});

router.post('/registro-pasajero', async (req, res, next) => {
  try {
    const { nombre, email, telefono, password } = req.body;
    if (!nombre || !email || !telefono || !password) {
      throw { status: 400, message: 'Todos los campos son requeridos' };
    }
    res.status(201).json(await registrarPasajero({ nombre, email, telefono, password }));
  } catch (err) { next(err); }
});

router.post('/fcm-token', authMiddleware, async (req, res, next) => {
  try {
    await actualizarFcmToken(req.usuario.id, req.body.fcmToken);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/cambiar-password', authMiddleware, async (req, res, next) => {
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
