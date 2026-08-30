// ════════════════════════════════════════════════════════
// GUARDIÁN DEL EXPORT ESTÁTICO
//
// Por qué existe: la web se publica como HTML plano en Cloudflare Pages
// bajo /transporte. Tres cosas la sostienen: output:'export',
// basePath:'/transporte' y trailingSlash:true. Si falta trailingSlash,
// /transporte/login/ deja de resolver y CF devuelve 404. Si aparece una
// carpeta web/functions/, CF Pages la toma como Worker y se come TODAS
// las rutas del sitio (accidente ya vivido: el sitio entero en blanco).
// Qué revisa: esas tres opciones y que no exista web/functions/.
// Cero dependencias.
// ════════════════════════════════════════════════════════
import { existe, leer } from "./_util.mjs";

const CFG = "web/next.config.js";
let fallos = 0;

if (!existe(CFG)) {
  console.error(`\n  falta ${CFG}`);
  process.exit(1);
}

const cfg = leer(CFG);
const OBLIGATORIAS = [
  { re: /output:\s*['"]export['"]/,        arreglo: "output: 'export'",        por: "CF Pages solo sirve archivos, no un server Next" },
  { re: /basePath:\s*['"]\/transporte['"]/, arreglo: "basePath: '/transporte'", por: "el sitio vive en viczul.com/transporte" },
  { re: /trailingSlash:\s*true/,            arreglo: "trailingSlash: true",     por: "sin esto /transporte/login/ da 404 en CF" },
];

for (const { re, arreglo, por } of OBLIGATORIAS) {
  if (re.test(cfg)) continue;
  fallos++;
  console.error(`\n  ${CFG}: falta ${arreglo}`);
  console.error(`     agregalo — ${por}.`);
}

if (existe("web/functions")) {
  fallos++;
  console.error("\n  existe la carpeta web/functions/");
  console.error("     borrala: Cloudflare Pages la interpreta como Functions y secuestra");
  console.error("     todas las rutas del sitio (el proxy /api vive en el Worker aparte).");
}

if (fallos) {
  console.error(`\n❌ EXPORT ESTÁTICO: ${fallos} problema(s). El sitio publicado quedaría roto.\n`);
  process.exit(1);
}
console.log("✅ Export estático OK: output/basePath/trailingSlash puestos y sin web/functions/.");
