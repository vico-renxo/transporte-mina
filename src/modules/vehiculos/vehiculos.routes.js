const express = require('express');
const { listarVehiculos, crearVehiculo, actualizarVehiculo } = require('./vehiculos.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

router.get('/',    authMiddleware, requireRol('ADMIN', 'SUPERVISOR', 'GERENCIA'), async (req, res, next) => {
  try { res.json(await listarVehiculos()); } catch (err) { next(err); }
});

router.post('/',   authMiddleware, requireRol('ADMIN'), async (req, res, next) => {
  try { res.status(201).json(await crearVehiculo(req.body)); } catch (err) { next(err); }
});

router.put('/:id', authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await actualizarVehiculo(req.params.id, req.body)); } catch (err) { next(err); }
});

module.exports = router;
