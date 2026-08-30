// ════════════════════════════════════════════════════════
// GUARDIÁN DE BASEPATH
//
// Por qué existe: la web se sirve en viczul.com/transporte (basePath
// '/transporte' en next.config.js). Un enlace escrito a mano como
// href="/login" manda al usuario a viczul.com/login → página en blanco /
// 404 del sitio principal. Pasó con el logout del panel conductor.
// Qué revisa: URLs absolutas escritas a mano en web/src que no empiezan
// con /transporte. NO mira <Link> ni router.push(): Next les agrega el
// basePath solo.
// Cero dependencias.
// ════════════════════════════════════════════════════════
import { archivos, leer } from "./_util.mjs";

const RAIZ = "web/src";
// window.location.href = "/..."  |  <a href="/...">  |  fetch("/api/...")
const PATRONES = [
  { re: /window\.location(?:\.href)?\s*=\s*["'`](\/(?!transporte\/)[^"'`]*)/, como: 'window.location.href = "/transporte/...'  },
  { re: /<a\s[^>]*href=["'](\/(?!transporte\/)[^"']*)/,                       como: '<a href="/transporte/...'                },
  { re: /\b(?:fetch|axios\.[a-z]+)\(\s*["'`](\/(?!transporte\/)[^"'`]*)/,     como: "usa API/BASE + la ruta, no un path suelto" },
];

let fallos = 0;
const revisados = archivos(RAIZ, [".ts", ".tsx", ".js", ".jsx"]);

for (const ruta of revisados) {
  leer(ruta).split("\n").forEach((linea, i) => {
    for (const { re, como } of PATRONES) {
      const m = linea.match(re);
      if (!m) continue;
      fallos++;
      console.error(`\n  ${ruta}:${i + 1}`);
      console.error(`     encontrado: ${m[1]}`);
      console.error(`     arréglalo así: ${como}`);
    }
  });
}

if (fallos) {
  console.error(`\n❌ BASEPATH: ${fallos} enlace(s) absoluto(s) sin /transporte.`);
  console.error("   La web vive en viczul.com/transporte — un path suelto sale del sitio.\n");
  process.exit(1);
}
console.log(`✅ basePath OK: ningún enlace absoluto se salta /transporte (${revisados.length} archivos).`);
