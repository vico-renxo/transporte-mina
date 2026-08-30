#!/usr/bin/env node
// ════════════════════════════════════════════════════════
// CORREDOR DE GUARDIANES — TransporteMina
//
// Corre TODOS los guardianes y devuelve 1 si alguno falla.
// Uso (desde la raíz del proyecto):
//   node guardianes/guardianes.mjs
// Cero dependencias.
// ════════════════════════════════════════════════════════
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));

const GUARDIANES = [
  ["basePath",         "verificar-basepath.mjs"],
  ["URL del backend",  "verificar-api-url.mjs"],
  ["conexiones BD",    "verificar-prisma.mjs"],
  ["deploy Render",    "verificar-deploy-render.mjs"],
  ["export estático",  "verificar-export-estatico.mjs"],
  ["orden de rutas",   "verificar-rutas-express.mjs"],
  ["forma de la API",  "verificar-forma-api.mjs"],
];

console.log("\n🛡  Guardianes de TransporteMina\n" + "─".repeat(48));

const rotos = [];
for (const [nombre, archivo] of GUARDIANES) {
  const r = spawnSync(process.execPath, [join(AQUI, archivo)], { stdio: "inherit" });
  if (r.status !== 0) rotos.push(nombre);
}

console.log("─".repeat(48));
if (rotos.length) {
  console.error(`\n🚫 NO SUBAS TODAVÍA. Falló: ${rotos.join(", ")}.`);
  console.error("   Arreglá lo de arriba y volvé a correr: node guardianes/guardianes.mjs\n");
  process.exit(1);
}
console.log(`\n✅ ${GUARDIANES.length} guardianes en verde. Podés subir.`);
console.log("   Ojo: esto revisa el código, no que la app diga la verdad. Probala igual.\n");
