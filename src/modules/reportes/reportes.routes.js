const express = require('express');
const { reporteDiario, reporteSemanal, generarExcel } = require('./reportes.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

const ROLES_REPORTE = ['ADMIN', 'SUPERVISOR', 'GERENCIA'];

router.get('/diario', authMiddleware, requireRol(...ROLES_REPORTE), async (req, res, next) => {
  try {
    const datos = await reporteDiario(req.query.fecha ? new Date(req.query.fecha) : new Date());
    res.json(datos);
  } catch (err) { next(err); }
});

router.get('/diario/excel', authMiddleware, requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try {
    const fecha = req.query.fecha ? new Date(req.query.fecha) : new Date();
    const datos = await reporteDiario(fecha);
    const workbook = await generarExcel(datos.detalle, 'Reporte Diario');
    const fechaStr = fecha.toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-diario-${fechaStr}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

router.get('/semanal', authMiddleware, requireRol(...ROLES_REPORTE), async (req, res, next) => {
  try {
    const fecha = req.query.inicio
      ? new Date(req.query.inicio)
      : (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d; })();
    res.json(await reporteSemanal(fecha));
  } catch (err) { next(err); }
});

module.exports = router;

// Dashboard KPIs rápidos
router.get('/dashboard', authMiddleware, requireRol(...ROLES_REPORTE), async (req, res, next) => {
  try {
    const datos = await reporteDiario(new Date());
    res.json(datos);
  } catch (err) { next(err); }
});
