#!/usr/bin/env node
// Crea usuarios de PRUEBA (pasajeros y conductores) para simular la app.
//
// Se corre:   node prisma/seed-pruebas.js            (12 pasajeros, 4 conductores)
//             node prisma/seed-pruebas.js 30 4       (30 pasajeros, 4 conductores)
//
// Necesita DATABASE_URL en el entorno o en un .env en la raiz.
//
// TRES DECISIONES QUE IMPORTAN
//
// 1) Todo lo que crea lleva la marca 'zz-prueba' en el email, con dominio
//    @prueba.local (dominio reservado, no existe ni puede existir). Asi
//    purgar-pruebas.js puede borrarlos sin la menor posibilidad de tocar
//    un usuario real: el filtro es exacto, no un LIKE '%prueba%' que
//    algun dia se comeria a alguien llamado "Pruebast".
//
// 2) Las contrasenas se generan al azar en cada corrida y NO viven en este
//    archivo. El repo es PUBLICO: cualquier contrasena escrita aca queda
//    publicada en GitHub para siempre. Se imprimen al final y se guardan
//    en credenciales-prueba.local.txt, que esta en .gitignore.
//
// 3) Es idempotente (upsert). Correrlo dos veces no duplica nada, pero SI
//    regenera las contrasenas. Guarda el archivo que imprime.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const MARCA   = 'zz-prueba';
const DOMINIO = 'prueba.local';
const email   = (tipo, i) => `${MARCA}-${tipo}${String(i).padStart(2,'0')}@${DOMINIO}`;

// 18 caracteres de entropia real. Nada de 'pas123'.
const clave = () => crypto.randomBytes(14).toString('base64url').slice(0, 18);

const NOMBRES = ['Ana Quispe','Luis Mamani','Rosa Ccama','Marco Apaza','Elena Choque',
  'Jorge Huanca','Nilda Cutipa','Cesar Ticona','Ruth Condori','Pablo Larico',
  'Sonia Calcina','Hugo Machaca','Delia Pari','Raul Ala','Marta Sucari',
  'Percy Colque','Yola Vilca','Edwin Coaquira','Gloria Nina','Fidel Ramos',
  'Rocio Zapana','Wilber Chura','Norma Aguilar','Aldo Cahuana','Lucia Puma',
  'Efrain Salas','Betty Quenta','Nestor Ito','Irma Turpo','Vidal Mendoza'];

async function main() {
  const nPas  = Number(process.argv[2]) || 12;
  const nCond = Number(process.argv[3]) || 4;

  // La ruta a la que se enganchan. Se usa la primera que exista; si no hay
  // ninguna, se avisa en vez de inventar una: crear rutas es decision tuya.
  const ruta = await prisma.ruta.findFirst({ include: { paraderos: { orderBy: { orden: 'asc' } } } });
  if (!ruta) {
    console.error('✗ No hay ninguna Ruta en la base. Crea una desde el panel admin y volve a correr esto.');
    process.exit(1);
  }
  const paraderos = ruta.paraderos;
  console.log(`Ruta destino: "${ruta.nombre}" (${paraderos.length} paraderos)`);

  const credenciales = [];
  const hash = p => bcrypt.hash(p, 10);

  // ── Conductores ──────────────────────────────────────────────────────
  for (let i = 1; i <= nCond; i++) {
    const pass = clave(), correo = email('cond', i);
    const usuario = await prisma.usuario.upsert({
      where:  { email: correo },
      update: { password: await hash(pass), activo: true },
      create: { nombre: `${NOMBRES[(i*7) % NOMBRES.length]} (prueba)`, email: correo,
                password: await hash(pass), rol: 'CONDUCTOR' },
    });
    await prisma.conductor.upsert({
      where:  { usuarioId: usuario.id },
      update: {},
      create: { usuarioId: usuario.id, licencia: `ZZP-${String(i).padStart(6,'0')}`,
                telefono: `9${String(70000000 + i)}` },
    });
    // Un vehiculo por conductor, con placa marcada.
    await prisma.vehiculo.upsert({
      where:  { placa: `ZZP-${String(i).padStart(3,'0')}` },
      update: {},
      create: { placa: `ZZP-${String(i).padStart(3,'0')}`, marca: 'Toyota', modelo: 'Hiace',
                anio: 2022, capacidad: 16, estado: 'ACTIVO' },
    });
    credenciales.push(['CONDUCTOR', correo, pass]);
  }

  // ── Pasajeros ────────────────────────────────────────────────────────
  for (let i = 1; i <= nPas; i++) {
    const pass = clave(), correo = email('pas', i);
    const usuario = await prisma.usuario.upsert({
      where:  { email: correo },
      update: { password: await hash(pass), activo: true },
      create: { nombre: `${NOMBRES[i % NOMBRES.length]} (prueba)`, email: correo,
                password: await hash(pass), rol: 'PASAJERO' },
    });
    // Se reparten entre los paraderos intermedios: nadie sube en el origen
    // ni en el destino.
    const idx = paraderos.length > 2 ? 1 + (i % (paraderos.length - 2)) : 0;
    await prisma.pasajero.upsert({
      where:  { usuarioId: usuario.id },
      update: {},
      create: { usuarioId: usuario.id, rutaId: ruta.id, paraderoId: paraderos[idx]?.id,
                aprobado: true, tiempoAlertaMin: 5 + (i % 6) },
    });
    credenciales.push(['PASAJERO', correo, pass]);
  }

  // ── Salida ───────────────────────────────────────────────────────────
  const destino = path.join(__dirname, '..', 'credenciales-prueba.local.txt');
  const texto = [
    `Credenciales de PRUEBA — generadas ${new Date().toISOString()}`,
    `Ruta: ${ruta.nombre}`,
    `Estos usuarios se borran con:  node prisma/purgar-pruebas.js --borrar`,
    '',
    ...credenciales.map(([rol, correo, pass]) => `${rol.padEnd(9)} ${correo.padEnd(38)} ${pass}`),
    '',
  ].join('\n');
  fs.writeFileSync(destino, texto, 'utf8');

  console.log(`\n✓ ${nCond} conductores y ${nPas} pasajeros listos.`);
  console.log(`✓ Credenciales guardadas en credenciales-prueba.local.txt (ignorado por git).`);
  console.log(`\nPara borrarlos despues:  node prisma/purgar-pruebas.js`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
