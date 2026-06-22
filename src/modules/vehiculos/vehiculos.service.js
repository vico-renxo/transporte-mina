const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listarVehiculos() {
  const vehiculos = await prisma.vehiculo.findMany({
    orderBy: { placa: 'asc' },
  });
  return { vehiculos };
}

async function crearVehiculo({ placa, marca, modelo, anio, capacidad, estado = 'ACTIVO' }) {
  const existe = await prisma.vehiculo.findFirst({ where: { placa: placa.toUpperCase() } });
  if (existe) throw Object.assign(new Error('La placa ya está registrada'), { status: 409 });

  const v = await prisma.vehiculo.create({
    data: { placa: placa.toUpperCase(), marca, modelo, anio: anio || new Date().getFullYear(), capacidad: capacidad || 20, estado },
  });
  return { vehiculo: v };
}

async function actualizarVehiculo(id, { placa, marca, modelo, anio, capacidad, estado }) {
  const v = await prisma.vehiculo.findUnique({ where: { id } });
  if (!v) throw Object.assign(new Error('Vehículo no encontrado'), { status: 404 });

  const updated = await prisma.vehiculo.update({
    where: { id },
    data: {
      placa:    placa     ? placa.toUpperCase() : v.placa,
      marca:    marca     ?? v.marca,
      modelo:   modelo    ?? v.modelo,
      anio:     anio      ?? v.anio,
      capacidad:capacidad ?? v.capacidad,
      estado:   estado    ?? v.estado,
    },
  });
  return { vehiculo: updated };
}

module.exports = { listarVehiculos, crearVehiculo, actualizarVehiculo };
