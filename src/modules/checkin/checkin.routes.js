const express = require('express');
const {
  registrarCheckin, registrarCheckinsParadero,
  obtenerCheckinsPorRuta, resumenCheckins
} = require('./checkin.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

// Registrar checkin individual
router.post('/', authMiddleware, requireRol('CONDUCTOR'), async (req, res, next) => {
  try { res.json(await registrarCheckin(req.body)); } catch (err) { next(err); }
});

// Registrar todos los checkins de un paradero de una vez
router.post('/paradero', authMiddleware, requireRol('CONDUCTOR'), async (req, res, next) => {
  try {
    const { rutaEjecucionId, paraderoId, checkins } = req.body;
    if (!rutaEjecucionId || !paraderoId || !checkins?.length) {
      throw { status: 400, message: 'rutaEjecucionId, paraderoId y checkins requeridos' };
    }
    res.json(await registrarCheckinsParadero(rutaEjecucionId, paraderoId, checkins));
  } catch (err) { next(err); }
});

// Obtener checkins de una ejecución
router.get('/:rutaEjecucionId', authMiddleware, async (req, res, next) => {
  try { res.json(await obtenerCheckinsPorRuta(req.params.rutaEjecucionId)); } catch (err) { next(err); }
});

// Resumen rápido
router.get('/:rutaEjecucionId/resumen', authMiddleware, async (req, res, next) => {
  try { res.json(await resumenCheckins(req.params.rutaEjecucionId)); } catch (err) { next(err); }
});

module.exports = router;
