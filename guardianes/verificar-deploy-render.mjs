// ════════════════════════════════════════════════════════
// GUARDIÁN DEL DEPLOY DE RENDER
//
// Por qué existe: la base está detrás del pooler de Supabase (pgBouncer,
// puerto 6543). `prisma migrate deploy` pide advisory locks que el pooler
// no soporta: el deploy se queda colgado o revienta, y el backend viejo
// se cae igual. Regla del proyecto: NUNCA migraciones en el build.
// Qué revisa: que el script "build" de package.json no corra migraciones.
// Cero dependencias.
// ════════════════════════════════════════════════════════
import { existe, leer } from "./_util.mjs";

const PKG = "package.json";
let fallos = 0;

if (!existe(PKG)) {
  console.error(`\n  no encuentro ${PKG} — corré el guardián desde la raíz del proyecto.`);
  process.exit(1);
}

const pkg = JSON.parse(leer(PKG));
const build = pkg.scripts?.build ?? "";

if (/prisma\s+migrate/.test(build)) {
  fallos++;
  console.error(`\n  ${PKG} → scripts.build`);
  console.error(`     encontrado: ${build}`);
  console.error('     arréglalo así: "build": "prisma generate"');
  console.error("     Las migraciones se aplican a mano en el SQL editor de Supabase,");
  console.error("     nunca en el build: el pooler (6543) no soporta los locks que pide migrate.");
}

if (fallos) {
  console.error("\n❌ DEPLOY: el build de Render intentaría migrar la base.\n");
  process.exit(1);
}
console.log(`✅ Deploy OK: el build no corre migraciones ("${build || "sin build"}").`);
