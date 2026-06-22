const express = require('express');
const {
  listarRutas, obtenerRuta, crearRuta, actualizarRuta,
  iniciarRuta, finalizarRuta, reportarIncidencia,
  obtenerEjecucionesActivas, historialEjecuciones
} = require('./rutas.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

router.get('/', authMiddleware, async (req, res, next) => {
  try { res.json(await listarRutas()); } catch (err) { next(err); }
});

router.get('/activas', authMiddleware, requireRol('ADMIN', 'SUPERVISOR', 'GERENCIA', 'PASAJERO', 'CONDUCTOR'), async (req, res, next) => {
  try { res.json(await obtenerEjecucionesActivas()); } catch (err) { next(err); }
});

router.get('/historial', authMiddleware, requireRol('ADMIN', 'SUPERVISOR', 'GERENCIA'), async (req, res, next) => {
  try { res.json(await historialEjecuciones(req.query)); } catch (err) { next(err); }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try { res.json(await obtenerRuta(req.params.id)); } catch (err) { next(err); }
});

router.post('/', authMiddleware, requireRol('ADMIN'), async (req, res, next) => {
  try { res.status(201).json(await crearRuta(req.body)); } catch (err) { next(err); }
});

router.patch('/:id', authMiddleware, requireRol('ADMIN'), async (req, res, next) => {
  try { res.json(await actualizarRuta(req.params.id, req.body)); } catch (err) { next(err); }
});

// Supervisor inicia ruta desde panel web: POST /rutas/:id/iniciar
router.post('/:id/iniciar', authMiddleware, requireRol('ADMIN', 'SUPERVISOR', 'CONDUCTOR'), async (req, res, next) => {
  try { res.json(await iniciarRuta({ rutaId: req.params.id, ...req.body })); } catch (err) { next(err); }
});

// Conductor inicia su ruta desde la app: POST /rutas/iniciar
router.post('/iniciar', authMiddleware, requireRol('CONDUCTOR', 'ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await iniciarRuta(req.body)); } catch (err) { next(err); }
});

router.post('/:id/finalizar', authMiddleware, requireRol('CONDUCTOR', 'ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await finalizarRuta(req.params.id)); } catch (err) { next(err); }
});

router.post('/:id/incidencia', authMiddleware, requireRol('CONDUCTOR'), async (req, res, next) => {
  try {
    const { mensaje } = req.body;
    if (!mensaje) throw { status: 400, message: 'Mensaje de incidencia requerido' };
    res.json(await reportarIncidencia(req.params.id, mensaje));
  } catch (err) { next(err); }
});

module.exports = router;
