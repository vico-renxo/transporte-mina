const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

function rangoDia(fecha) {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fecha);
  fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
}

async function reporteDiario(fecha = new Date()) {
  const { inicio, fin } = rangoDia(fecha);

  const ejecuciones = await prisma.rutaEjecucion.findMany({
    where: { fecha: { gte: inicio, lte: fin } },
    include: {
      ruta: { select: { nombre: true, horaInicio: true } },
      conductor: { include: { usuario: { select: { nombre: true } } } },
      vehiculo: { select: { placa: true, modelo: true } },
      checkins: true,
      calificaciones: { select: { estrellas: true } }
    },
    orderBy: { iniciadaEn: 'asc' }
  });

  const detalle = ejecuciones.map(e => {
    const recogidos = e.checkins.filter(c => c.subio).length;
    const ausentes = e.checkins.filter(c => !c.subio).length;
    const totalCheckins = recogidos + ausentes;
    const duracionMin = e.finalizadaEn && e.iniciadaEn
      ? Math.round((new Date(e.finalizadaEn) - new Date(e.iniciadaEn)) / 60000) : null;
    const promedioCalif = e.calificaciones.length
      ? (e.calificaciones.reduce((s, c) => s + c.estrellas, 0) / e.calificaciones.length).toFixed(1)
      : null;

    return {
      rutaEjecucionId: e.id,
      fecha: e.fecha.toISOString().split('T')[0],
      rutaNombre: e.ruta.nombre,
      turno: e.ruta.horaInicio,
      conductor: e.conductor.usuario.nombre,
      vehiculo: `${e.vehiculo.placa} - ${e.vehiculo.modelo}`,
      estado: e.estado,
      iniciadaEn: e.iniciadaEn,
      finalizadaEn: e.finalizadaEn,
      duracionMin,
      recogidos,
      ausentes,
      totalCheckins,
      puntualidad: totalCheckins > 0 ? Math.round((recogidos / totalCheckins) * 100) : 100,
      calificacion: promedioCalif ? Number(promedioCalif) : null
    };
  });

  const totalRecogidos  = detalle.reduce((s, e) => s + e.recogidos, 0);
  const totalAusentes   = detalle.reduce((s, e) => s + e.ausentes, 0);
  const totalCheckins   = totalRecogidos + totalAusentes;

  return {
    detalle,
    resumen: {
      totalEjecuciones:    detalle.length,
      totalRecogidos,
      totalAusentes,
      totalPorMedios:      0,
      puntualidadPromedio: totalCheckins > 0 ? Math.round((totalRecogidos / totalCheckins) * 100) : (detalle.length > 0 ? 100 : 0)
    }
  };
}

async function reporteSemanal(fechaInicio) {
  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fechaInicio);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23, 59, 59, 999);

  const ejecuciones = await prisma.rutaEjecucion.findMany({
    where: { fecha: { gte: inicio, lte: fin } },
    include: {
      ruta: { select: { nombre: true, horaInicio: true } },
      conductor: { include: { usuario: { select: { nombre: true } } } },
      vehiculo: { select: { placa: true } },
      checkins: true
    }
  });

  // Agrupar por conductor
  const porConductorMap = {};
  for (const e of ejecuciones) {
    const nombre = e.conductor.usuario.nombre;
    if (!porConductorMap[nombre]) {
      porConductorMap[nombre] = { conductor: nombre, rutas: 0, recogidos: 0, ausentes: 0 };
    }
    porConductorMap[nombre].rutas++;
    porConductorMap[nombre].recogidos += e.checkins.filter(c => c.subio).length;
    porConductorMap[nombre].ausentes += e.checkins.filter(c => !c.subio).length;
  }
  const porConductor = Object.values(porConductorMap).map(c => ({
    ...c,
    puntualidad: c.recogidos + c.ausentes > 0
      ? Math.round((c.recogidos / (c.recogidos + c.ausentes)) * 100) : 100
  }));

  // Agrupar por día para tendencia
  const porDiaMap = {};
  for (let i = 0; i <= 6; i++) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    porDiaMap[key] = { fecha: key, rutas: 0, pasajeros: 0, ausentes: 0 };
  }
  for (const e of ejecuciones) {
    const key = e.fecha.toISOString().split('T')[0];
    if (porDiaMap[key]) {
      porDiaMap[key].rutas++;
      porDiaMap[key].pasajeros += e.checkins.filter(c => c.subio).length;
      porDiaMap[key].ausentes  += e.checkins.filter(c => !c.subio).length;
    }
  }
  const dias = Object.values(porDiaMap).map(d => ({
    ...d,
    puntualidad: d.pasajeros + d.ausentes > 0
      ? Math.round((d.pasajeros / (d.pasajeros + d.ausentes)) * 100) : (d.rutas > 0 ? 100 : 0)
  }));

  const totalRecogidos = ejecuciones.reduce((s, e) => s + e.checkins.filter(c => c.subio).length, 0);
  const totalAusentes  = ejecuciones.reduce((s, e) => s + e.checkins.filter(c => !c.subio).length, 0);
  const totalCheckins  = totalRecogidos + totalAusentes;

  return {
    periodo: { inicio: inicio.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] },
    resumen: {
      totalEjecuciones:    ejecuciones.length,
      totalPasajeros:      totalRecogidos,
      totalAusentes,
      puntualidadPromedio: totalCheckins > 0 ? Math.round((totalRecogidos / totalCheckins) * 100) : (ejecuciones.length > 0 ? 100 : 0)
    },
    porConductor,
    dias
  };
}

async function generarExcel(datos, titulo) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TransporteMina';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(titulo, {
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  });

  const columnas = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Ruta', key: 'rutaNombre', width: 22 },
    { header: 'Turno', key: 'turno', width: 10 },
    { header: 'Conductor', key: 'conductor', width: 24 },
    { header: 'Vehículo', key: 'vehiculo', width: 20 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Recogidos', key: 'recogidos', width: 12 },
    { header: 'Ausentes', key: 'ausentes', width: 12 },
    { header: 'Puntualidad %', key: 'puntualidad', width: 16 },
    { header: 'Duración (min)', key: 'duracionMin', width: 16 },
    { header: 'Calificación', key: 'calificacion', width: 14 }
  ];

  sheet.columns = columnas;

  // Encabezado estilizado
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 22;

  // Datos
  datos.forEach((row, i) => {
    const dataRow = sheet.addRow(row);
    dataRow.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' }
    };
    // Colorear puntualidad
    const puntCell = dataRow.getCell('puntualidad');
    if (row.puntualidad >= 90) puntCell.font = { color: { argb: 'FF15803D' }, bold: true };
    else if (row.puntualidad >= 70) puntCell.font = { color: { argb: 'FFD97706' }, bold: true };
    else puntCell.font = { color: { argb: 'FFDC2626' }, bold: true };
  });

  // Borde exterior
  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  return workbook;
}

module.exports = { reporteDiario, reporteSemanal, generarExcel };
