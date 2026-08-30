// ════════════════════════════════════════════════════════
// GUARDIÁN DEL ORDEN DE LAS RUTAS
//
// Por qué existe: Express prueba las rutas en el orden en que se
// declaran. Si GET /:id está antes que GET /publicas, la llamada a
// /publicas entra por /:id con id="publicas": responde 404 "ruta no
// encontrada" o 500 de Prisma. El registro de pasajeros se quedó sin
// paraderos por exactamente esto.
// Qué revisa: rutas literales tapadas por una ruta con parámetro
// declarada antes, del mismo método y misma cantidad de segmentos.
// Cero dependencias.
// ════════════════════════════════════════════════════════
import { archivos, leer } from "./_util.mjs";

const RAIZ = "src";
let fallos = 0;

const segmentos = (r) => r.split("/").filter(Boolean);
const tapa = (patron, literal) => {
  const a = segmentos(patron), b = segmentos(literal);
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.startsWith(":") || s === b[i]);
};

const revisados = archivos(RAIZ, [".routes.js"]);

for (const ruta of revisados) {
  const contenido = leer(ruta);
  const lineas = contenido.split("\n");
  const declaradas = [];

  lineas.forEach((linea, i) => {
    const m = linea.match(/router\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]/);
    if (!m) return;
    const [, metodo, path] = m;
    const tieneParam = path.includes(":");

    if (!tieneParam) {
      const culpable = declaradas.find(d => d.metodo === metodo && d.tieneParam && tapa(d.path, path));
      if (culpable) {
        fallos++;
        console.error(`\n  ${ruta}:${i + 1}`);
        console.error(`     ${metodo.toUpperCase()} ${path} nunca se ejecuta:`);
        console.error(`     la tapa ${metodo.toUpperCase()} ${culpable.path} (línea ${culpable.linea}).`);
        console.error(`     arréglalo así: mové la línea de '${path}' ARRIBA de la de '${culpable.path}'.`);
      }
    }
    declaradas.push({ metodo, path, tieneParam, linea: i + 1 });
  });
}

if (fallos) {
  console.error(`\n❌ ORDEN DE RUTAS: ${fallos} endpoint(s) inalcanzable(s).\n`);
  process.exit(1);
}
console.log(`✅ Orden de rutas OK: ninguna ruta literal queda tapada por una con :parámetro (${revisados.length} archivos).`);
