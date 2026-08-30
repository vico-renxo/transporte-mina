#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// GUARDIÁN DEL wrangler.toml EN LA RAÍZ
//
// Por qué existe: el 2026-08-30 se agregó `wrangler.toml` en la raíz
// del repo para desplegar el Worker de la API. Cloudflare Pages lee
// ESE archivo cuando construye la web, y falla si encuentra claves de
// Worker (`main`, `routes`), porque ahí espera configuración de Pages.
//
// Resultado: todos los builds de la web se rompieron y el sitio quedó
// congelado en la versión anterior. Nada avisó. La app siguió
// funcionando con código viejo mientras los commits se acumulaban en
// GitHub con el CI en verde. Se descubrió recién al notar que los
// chunks publicados no cambiaban.
//
// Qué revisa: que no haya un wrangler.toml de Worker en la raíz.
// El del Worker vive en worker/wrangler.toml y se despliega con
//   npx wrangler deploy -c worker/wrangler.toml
//
// Cero dependencias.
// ════════════════════════════════════════════════════════════════
import { existe, leer } from "./_util.mjs";

const RAIZ = "wrangler.toml";

if (!existe(RAIZ)) {
  console.log("✅ wrangler OK: no hay wrangler.toml de Worker en la raíz.");
  process.exit(0);
}

const contenido = leer(RAIZ);
const claveDeWorker = ["main", "routes", "compatibility_date"].filter(k =>
  new RegExp(`^\\s*${k}\\s*=|^\\s*\\[\\[${k}\\]\\]`, "m").test(contenido)
);

// Un wrangler.toml de Pages (con pages_build_output_dir) SÍ puede vivir acá.
const esDePages = /^\s*pages_build_output_dir\s*=/m.test(contenido);

if (esDePages && claveDeWorker.length === 0) {
  console.log("✅ wrangler OK: el wrangler.toml de la raíz es de Pages, no de Worker.");
  process.exit(0);
}

console.error(`
  ${RAIZ} tiene configuración de Worker (${claveDeWorker.join(", ")}).

     Cloudflare Pages lee este archivo al construir la web y FALLA:
     ahí espera configuración de Pages, no de Worker. El sitio se queda
     servido con el build anterior y nada lo avisa — los commits siguen
     entrando y el CI sigue en verde.

     arreglalo así:  moverlo a worker/wrangler.toml, poner
                     main = "index.js" (relativo a esa carpeta) y
                     desplegar con:
                       npx wrangler deploy -c worker/wrangler.toml`);
console.error("\n❌ WRANGLER: el build de la web quedaría roto en silencio.\n");
process.exit(1);
