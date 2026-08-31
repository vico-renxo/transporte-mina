#!/usr/bin/env node
// Borra SOLO los usuarios de prueba creados por seed-pruebas.js.
//
//   node prisma/purgar-pruebas.js            -> muestra que borraria, NO borra
//   node prisma/purgar-pruebas.js --borrar   -> borra de verdad
//
// POR QUE ARRANCA EN SIMULACRO: borrar es lo unico que no tiene deshacer.
// Se mira la lista primero y despues se confirma.
//
// EL FILTRO ES EXACTO, NO UN LIKE: solo toca usuarios cuyo email termina en
// @prueba.local Y empieza con 'zz-prueba-'. Un LIKE '%prueba%' algun dia se
// llevaria por delante a un usuario real. Este no puede.
//
// ORDEN DE BORRADO: el schema NO tiene onDelete: Cascade en ninguna
// relacion (verificado). Si se borra un Usuario que tiene checkins, Postgres
// rechaza la operacion por clave foranea. Por eso se va de las hojas hacia
// la raiz: calificaciones -> checkins -> estados de turno -> pasajero /
// conductor -> usuario. Esa es tambien la razon por la que la app da de baja
// pasajeros en vez de borrarlos (ver cambiarActivoPasajero).

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PREFIJO = 'zz-prueba-';
const DOMINIO = '@prueba.local';
const deVerdad = process.argv.includes('--borrar');

const esDePrueba = u => u.email.startsWith(PREFIJO) && u.email.endsWith(DOMINIO);

async function main() {
  const candidatos = (await prisma.usuario.findMany({
    where: { email: { startsWith: PREFIJO, endsWith: DOMINIO } },
    include: { conductor: true, pasajero: true },
  })).filter(esDePrueba);   // segundo filtro en JS: cinturon y tirantes

  if (!candidatos.length) { console.log('No hay usuarios de prueba. Nada que hacer.'); return; }

  const pasajeroIds  = candidatos.map(u => u.pasajero?.id).filter(Boolean);
  const conductorIds = candidatos.map(u => u.conductor?.id).filter(Boolean);

  const [nCal, nChk, nEst, nEjec] = await Promise.all([
    prisma.calificacion.count({ where: { pasajeroId: { in: pasajeroIds } } }),
    prisma.checkin.count({ where: { pasajeroId: { in: pasajeroIds } } }),
    prisma.estadoTurno.count({ where: { pasajeroId: { in: pasajeroIds } } }),
    prisma.rutaEjecucion.count({ where: { conductorId: { in: conductorIds } } }),
  ]);

  console.log(`\nUsuarios de prueba encontrados: ${candidatos.length}`);
  console.log(`  ${conductorIds.length} conductores, ${pasajeroIds.length} pasajeros`);
  console.log(`Datos colgando de ellos: ${nCal} calificaciones, ${nChk} checkins, ${nEst} estados de turno`);
  if (nEjec) console.log(`  ⚠ ${nEjec} RutaEjecucion de esos conductores: se borran tambien, con sus coordenadas.`);
  console.log('\nEmails:');
  candidatos.forEach(u => console.log('  ' + u.email));

  if (!deVerdad) {
    console.log('\n>>> SIMULACRO. No se borro nada.');
    console.log('>>> Para borrar de verdad:  node prisma/purgar-pruebas.js --borrar\n');
    return;
  }

  console.log('\nBorrando de las hojas hacia la raiz...');
  await prisma.$transaction(async (tx) => {
    const ejecIds = (await tx.rutaEjecucion.findMany({
      where: { conductorId: { in: conductorIds } }, select: { id: true },
    })).map(e => e.id);

    if (ejecIds.length) {
      console.log('  coordenadas   :', (await tx.coordenada.deleteMany({ where: { rutaEjecucionId: { in: ejecIds } } })).count);
      console.log('  calificaciones:', (await tx.calificacion.deleteMany({ where: { rutaEjecucionId: { in: ejecIds } } })).count);
      console.log('  checkins      :', (await tx.checkin.deleteMany({ where: { rutaEjecucionId: { in: ejecIds } } })).count);
    }
    console.log('  calificaciones (por pasajero):', (await tx.calificacion.deleteMany({ where: { pasajeroId: { in: pasajeroIds } } })).count);
    console.log('  checkins       (por pasajero):', (await tx.checkin.deleteMany({ where: { pasajeroId: { in: pasajeroIds } } })).count);
    console.log('  estados turno :', (await tx.estadoTurno.deleteMany({ where: { pasajeroId: { in: pasajeroIds } } })).count);
    if (ejecIds.length)
      console.log('  ejecuciones   :', (await tx.rutaEjecucion.deleteMany({ where: { id: { in: ejecIds } } })).count);
    console.log('  pasajeros     :', (await tx.pasajero.deleteMany({ where: { id: { in: pasajeroIds } } })).count);
    console.log('  conductores   :', (await tx.conductor.deleteMany({ where: { id: { in: conductorIds } } })).count);
    console.log('  usuarios      :', (await tx.usuario.deleteMany({ where: { id: { in: candidatos.map(u => u.id) } } })).count);
  });

  // Los vehiculos ZZP- se borran aparte: pueden estar referenciados por
  // ejecuciones de OTROS conductores si alguien los reasigno a mano.
  const veh = await prisma.vehiculo.findMany({ where: { placa: { startsWith: 'ZZP-' } }, select: { id: true, placa: true } });
  for (const v of veh) {
    const usos = await prisma.rutaEjecucion.count({ where: { vehiculoId: v.id } });
    if (usos) { console.log(`  vehiculo ${v.placa}: NO se borra, lo usan ${usos} ejecuciones ajenas`); continue; }
    await prisma.vehiculo.delete({ where: { id: v.id } });
    console.log(`  vehiculo ${v.placa}: borrado`);
  }

  console.log('\n✓ Purga completa.\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
