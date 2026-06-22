const express = require('express');
const { listarConductores, obtenerConductor, crearConductor, actualizarConductor } = require('./conductores.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

router.get('/',     authMiddleware, requireRol('ADMIN', 'SUPERVISOR', 'GERENCIA'), async (req, res, next) => {
  try { res.json(await listarConductores()); } catch (err) { next(err); }
});

router.get('/:id',  authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await obtenerConductor(req.params.id)); } catch (err) { next(err); }
});

router.post('/',    authMiddleware, requireRol('ADMIN'), async (req, res, next) => {
  try { res.status(201).json(await crearConductor(req.body)); } catch (err) { next(err); }
});

router.put('/:id',  authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await actualizarConductor(req.params.id, req.body)); } catch (err) { next(err); }
});

module.exports = router;
