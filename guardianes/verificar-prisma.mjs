// ════════════════════════════════════════════════════════
// GUARDIÁN DE CONEXIONES A LA BASE
//
// Por qué existe: BUG 13 (2026-07-02). pasajeros.routes.js hacía
// `new PrismaClient()` dentro del handler: una conexión nueva por cada
// request contra el pooler de Supabase. Con varios pasajeros abriendo el
// panel a la vez, la base devolvía "too many connections" y la app moría
// sin error visible en el front.
// Qué revisa: que PrismaClient solo se instancie en *.service.js, nunca
// en un *.routes.js ni dentro de una función.
// Cero dependencias.
// ════════════════════════════════════════════════════════
import { archivos, leer } from "./_util.mjs";

const RAIZ = "src";
let fallos = 0;
const revisados = archivos(RAIZ, [".js"]);

for (const ruta of revisados) {
  const contenido = leer(ruta);
  const lineas = contenido.split("\n");

  lineas.forEach((linea, i) => {
    if (!/new PrismaClient\s*\(/.test(linea)) return;
    if (/^\s*(\/\/|\*)/.test(linea)) return; // comentario

    const esRoutes = /\.routes\.js$/.test(ruta);
    // ¿está indentado? entonces vive dentro de una función, no en el módulo
    const dentroDeFuncion = /^\s+/.test(linea);

    if (esRoutes) {
      fallos++;
      console.error(`\n  ${ruta}:${i + 1}`);
      console.error("     new PrismaClient() en un archivo de rutas.");
      console.error(`     arréglalo así: mové la consulta a ${ruta.replace(".routes.js", ".service.js")}`);
      console.error("     y dejá el handler llamando al service (el service ya tiene su prisma).");
    } else if (dentroDeFuncion) {
      fallos++;
      console.error(`\n  ${ruta}:${i + 1}`);
      console.error("     new PrismaClient() dentro de una función = una conexión por llamada.");
      console.error("     arréglalo así: subí `const prisma = new PrismaClient();` al tope del archivo.");
    }
  });
}

if (fallos) {
  console.error(`\n❌ CONEXIONES: ${fallos} instancia(s) de Prisma mal ubicada(s).`);
  console.error("   Supabase free corta a las pocas conexiones y la app se cae sin aviso.\n");
  process.exit(1);
}
console.log(`✅ Conexiones OK: Prisma solo se instancia una vez por módulo de servicio (${revisados.length} archivos).`);
