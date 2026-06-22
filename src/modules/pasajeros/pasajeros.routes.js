const express = require('express');
const {
  declararEstado, marcarEnParadero, listarPendientesAprobacion,
  aprobarPasajero, listarPasajeros, obtenerEstadosHoy, calificarServicio
} = require('./pasajeros.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

// Pasajero obtiene su propio perfil (ruta, paradero, estado hoy)
router.get('/mi-perfil', authMiddleware, requireRol('PASAJERO'), async (req, res, next) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const pasajero = await prisma.pasajero.findFirst({
      where: { usuarioId: req.usuario.id },
      include: {
        usuario: { select: { nombre: true, email: true } },
        ruta: { select: { id: true, nombre: true, horaInicio: true, origen: true, destino: true } },
        paradero: { select: { id: true, nombre: true, lat: true, lng: true, orden: true } },
      }
    });
    if (!pasajero) return res.status(404).json({ error: 'Perfil de pasajero no encontrado' });

    // Buscar ejecucion activa para su ruta
    const ejecucion = await prisma.rutaEjecucion.findFirst({
      where: { rutaId: pasajero.rutaId, estado: 'EN_RUTA' },
      include: {
        coordenadas: { orderBy: { timestamp: 'desc' }, take: 1 },
        conductor: { include: { usuario: { select: { nombre: true } } } },
        vehiculo: { select: { placa: true, modelo: true, marca: true } },
      }
    });
    res.json({
      pasajero,
      ejecucionActiva: ejecucion ? {
        id: ejecucion.id,
        estado: ejecucion.estado,
        conductorNombre: ejecucion.conductor?.usuario?.nombre || '—',
        vehiculo: ejecucion.vehiculo ? `${ejecucion.vehiculo.marca} ${ejecucion.vehiculo.modelo} - ${ejecucion.vehiculo.placa}` : '—',
        ultimaLat: ejecucion.coordenadas?.[0]?.lat ?? null,
        ultimaLng: ejecucion.coordenadas?.[0]?.lng ?? null,
        ultimaActualizacion: ejecucion.coordenadas?.[0]?.timestamp || ejecucion.iniciadaEn,
      } : null
    });
  } catch (err) { next(err); }
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
    // Obtener datos del pasajero desde el token
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const pasajeroRecord = await prisma.pasajero.findFirst({
      where: { usuarioId: req.usuario.id }
    });
    if (!pasajeroRecord) return res.status(404).json({ error: 'Perfil de pasajero no encontrado' });
    const { estado } = req.body;
    res.json(await declararEstado({
      pasajeroId: pasajeroRecord.id,
      rutaId: pasajeroRecord.rutaId,
      estado
    }));
  } catch (err) { next(err); }
});

router.post('/en-paradero', authMiddleware, requireRol('PASAJERO'), async (req, res, next) => {
  try {
    // BUG FIX: obtener pasajeroId desde JWT, no desde body (seguridad + UX)
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const pasajeroRecord = await prisma.pasajero.findFirst({
      where: { usuarioId: req.usuario.id }
    });
    if (!pasajeroRecord) return res.status(404).json({ error: 'Perfil de pasajero no encontrado' });
    res.json(await marcarEnParadero(pasajeroRecord.id));
  } catch (err) { next(err); }
});

router.post('/calificacion', authMiddleware, requireRol('PASAJERO'), async (req, res, next) => {
  try { res.json(await calificarServicio(req.body)); } catch (err) { next(err); }
});

module.exports = router;
