const express = require('express');
const {
  declararEstado, marcarEnParadero, listarPendientesAprobacion,
  aprobarPasajero, listarPasajeros, obtenerEstadosHoy, calificarServicio,
  obtenerMiPerfil, obtenerPasajeroPorUsuario
} = require('./pasajeros.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

// Pasajero obtiene su propio perfil (ruta, paradero, ejecución activa)
// FIX: la lógica se movió al service — antes se creaba un PrismaClient por request
router.get('/mi-perfil', authMiddleware, requireRol('PASAJERO'), async (req, res, next) => {
  try { res.json(await obtenerMiPerfil(req.usuario.id)); } catch (err) { next(err); }
});

router.get('/', authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await listarPasajeros(req.query)); } catch (err) { next(err); }
});

router.get('/pendientes', authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await listarPendientesAprobacion()); } catch (err) { next(err); }
});

router.get('/estados-hoy/:rutaId', authMiddleware, async (req, res, next) => {
  try { res.json(await obtenerEstadosHoy(req.params.rutaId)); } catch (err) { next(err); }
});

router.post('/:id/aprobar', authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await aprobarPasajero(req.params.id, req.body.paraderoId)); } catch (err) { next(err); }
});

router.post('/estado', authMiddleware, requireRol('PASAJERO'), async (req, res, next) => {
  try {
    const pasajero = await obtenerPasajeroPorUsuario(req.usuario.id);
    res.json(await declararEstado({
      pasajeroId: pasajero.id,
      rutaId: pasajero.rutaId,
      estado: req.body.estado
    }));
  } catch (err) { next(err); }
});

router.post('/en-paradero', authMiddleware, requireRol('PASAJERO'), async (req, res, next) => {
  try {
    const pasajero = await obtenerPasajeroPorUsuario(req.usuario.id);
    res.json(await marcarEnParadero(pasajero.id));
  } catch (err) { next(err); }
});

router.post('/calificacion', authMiddleware, requireRol('PASAJERO'), async (req, res, next) => {
  try { res.json(await calificarServicio(req.body)); } catch (err) { next(err); }
});

module.exports = router;
