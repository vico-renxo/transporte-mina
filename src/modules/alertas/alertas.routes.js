const express = require('express');
const { alertasService } = require('./alertas.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

// Supervisor dispara alerta de emergencia manualmente
router.post('/emergencia', authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try {
    const { rutaEjecucionId, mensaje } = req.body;
    if (!rutaEjecucionId || !mensaje) {
      throw { status: 400, message: 'rutaEjecucionId y mensaje son requeridos' };
    }
    await alertasService.enviarAlertaEmergencia(rutaEjecucionId, mensaje);
    res.json({ ok: true, mensaje: 'Alerta de emergencia enviada a todos los pasajeros' });
  } catch (err) { next(err); }
});

// Disparar alerta de inicio de ruta manualmente (en caso de falla automática)
router.post('/inicio-ruta', authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try {
    const { rutaEjecucionId } = req.body;
    if (!rutaEjecucionId) throw { status: 400, message: 'rutaEjecucionId requerido' };
    await alertasService.enviarAlertaInicioRuta(rutaEjecucionId);
    res.json({ ok: true, mensaje: 'Alertas de inicio enviadas a todos los pasajeros' });
  } catch (err) { next(err); }
});

module.exports = router;
