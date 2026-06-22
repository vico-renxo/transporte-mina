const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  const hash = pwd => bcrypt.hash(pwd, 10);

  // Usuarios
  const [admin, supervisor, conductor1, pasajero1, pasajero2] = await Promise.all([
    prisma.usuario.upsert({
      where: { email: 'admin@empresa.com' },
      update: {},
      create: { nombre: 'Admin Sistema', email: 'admin@empresa.com', password: await hash('admin123'), rol: 'ADMIN' },
    }),
    prisma.usuario.upsert({
      where: { email: 'supervisor@empresa.com' },
      update: {},
      create: { nombre: 'Carlos Supervisor', email: 'supervisor@empresa.com', password: await hash('super123'), rol: 'SUPERVISOR' },
    }),
    prisma.usuario.upsert({
      where: { email: 'conductor1@empresa.com' },
      update: {},
      create: { nombre: 'Pedro Quispe', email: 'conductor1@empresa.com', password: await hash('cond123'), rol: 'CONDUCTOR' },
    }),
    prisma.usuario.upsert({
      where: { email: 'pasajero1@empresa.com' },
      update: {},
      create: { nombre: 'Juan Huanca', email: 'pasajero1@empresa.com', password: await hash('pas123'), rol: 'PASAJERO' },
    }),
    prisma.usuario.upsert({
      where: { email: 'pasajero2@empresa.com' },
      update: {},
      create: { nombre: 'Maria Flores', email: 'pasajero2@empresa.com', password: await hash('pas123'), rol: 'PASAJERO' },
    }),
  ]);

  // Conductor
  const conductorRecord = await prisma.conductor.upsert({
    where: { usuarioId: conductor1.id },
    update: {},
    create: { usuarioId: conductor1.id, licencia: 'A-IIb-123456', telefono: '987654321' },
  });

  // Vehículo
  const vehiculo = await prisma.vehiculo.upsert({
    where: { placa: 'ABC-123' },
    update: {},
    create: { placa: 'ABC-123', marca: 'Toyota', modelo: 'Hiace', anio: 2022, capacidad: 15, estado: 'ACTIVO' },
  });

  // Ruta demo
  const ruta = await prisma.ruta.upsert({
    where: { id: 'ruta-demo-001' },
    update: {},
    create: {
      id: 'ruta-demo-001',
      nombre: 'Ruta 1 — Ciudad → Mina',
      origen: 'Terminal Ciudad',
      destino: 'Mina Principal',
      horaInicio: '05:30',
      dias: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'],
      paraderos: {
        create: [
          { nombre: 'Terminal Ciudad',    lat: -14.065, lng: -75.728, orden: 1 },
          { nombre: 'Paradero Norte',     lat: -14.060, lng: -75.720, orden: 2 },
          { nombre: 'Paradero Este',      lat: -14.055, lng: -75.710, orden: 3 },
          { nombre: 'Acceso Mina',        lat: -14.050, lng: -75.700, orden: 4 },
          { nombre: 'Mina Principal',     lat: -14.045, lng: -75.690, orden: 5 },
        ],
      },
    },
  });

  // Pasajeros
  const paraderos = await prisma.paradero.findMany({ where: { rutaId: ruta.id }, orderBy: { orden: 'asc' } });

  await prisma.pasajero.upsert({
    where: { usuarioId: pasajero1.id },
    update: {},
    create: {
      usuarioId: pasajero1.id, rutaId: ruta.id,
      paraderoId: paraderos[1]?.id, aprobado: true, tiempoAlertaMin: 5,
    },
  });
  await prisma.pasajero.upsert({
    where: { usuarioId: pasajero2.id },
    update: {},
    create: {
      usuarioId: pasajero2.id, rutaId: ruta.id,
      paraderoId: paraderos[2]?.id, aprobado: true, tiempoAlertaMin: 8,
    },
  });

  console.log('✅ Seed completado');
  console.log('  👤 admin@empresa.com    / admin123  (ADMIN)');
  console.log('  👤 supervisor@empresa.com / super123 (SUPERVISOR)');
  console.log('  🚌 conductor1@empresa.com / cond123  (CONDUCTOR)');
  console.log('  👥 pasajero1@empresa.com  / pas123   (PASAJERO)');
  console.log('  👥 pasajero2@empresa.com  / pas123   (PASAJERO)');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
