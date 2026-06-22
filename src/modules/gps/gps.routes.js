const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { guardarCoordenada, obtenerUltimaCoordenada, obtenerHistorial } = require('./gps.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

// Fallback HTTP para cuando WebSocket no esté disponible
router.post('/coordenada', authMiddleware, requireRol('CONDUCTOR'), async (req, res, next) => {
  try {
    const { rutaEjecucionId, lat, lng, velocidad } = req.body;
    if (!rutaEjecucionId || lat === undefined || lng === undefined) {
      throw { status: 400, message: 'rutaEjecucionId, lat y lng son requeridos' };
    }
    const coord = await guardarCoordenada({ rutaEjecucionId, lat, lng, velocidad });

    // Emitir actualización en tiempo real a supervisores
    const { getIo } = require('../../config/socket');
    // Obtener info de la ejecución para el evento
    const ej = await prisma.rutaEjecucion.findUnique({
      where: { id: rutaEjecucionId },
      include: {
        ruta:      { select: { nombre: true } },
        conductor: { include: { usuario: { select: { nombre: true } } } },
        vehiculo:  { select: { placa: true } }
      }
    });
    getIo()?.to('supervisores').emit('supervisor:gps-update', {
      conductorId:     ej?.conductorId || req.usuario.id,
      rutaEjecucionId,
      lat, lng,
      speed:           velocidad || 0,
      timestamp:       coord.timestamp,
      rutaNombre:      ej?.ruta?.nombre                  || '',
      conductorNombre: ej?.conductor?.usuario?.nombre    || '',
      vehiculoPlaca:   ej?.vehiculo?.placa               || '',
    });
    // También emitir a pasajeros suscritos a esta ruta
    getIo()?.to(`ruta:${rutaEjecucionId}`).emit('ruta:posicion', {
      lat, lng, velocidad: velocidad || 0, timestamp: coord.timestamp,
    });

    // Verificar proximidad async
    const { alertasService } = require('../alertas/alertas.service');
    alertasService.verificarProximidad(rutaEjecucionId, lat, lng).catch(console.error);
    res.json(coord);
  } catch (err) { next(err); }
});

router.get('/ultima/:rutaEjecucionId', authMiddleware, async (req, res, next) => {
  try {
    const coord = await obtenerUltimaCoordenada(req.params.rutaEjecucionId);
    if (!coord) return res.status(404).json({ error: 'Sin coordenadas para esta ruta' });
    res.json(coord);
  } catch (err) { next(err); }
});

router.get('/historial/:rutaEjecucionId', authMiddleware, async (req, res, next) => {
  try {
    res.json(await obtenerHistorial(req.params.rutaEjecucionId));
  } catch (err) { next(err); }
});

module.exports = router;
