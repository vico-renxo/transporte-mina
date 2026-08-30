#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// GUARDIÁN DE LA FORMA DE LA API
//
// Por qué existe: el 2026-08-30, la simulación mostraba conductor y
// vehículo en "—" y el botón de iniciar ruta devolvía
// 400 "rutaId, conductorId y vehiculoId requeridos". No había ningún
// error en la consola ni en los logs. La causa: hacía if(r.length)
// sobre /api/conductores, pero ese endpoint devuelve
// { conductores: [...] }, no un array. r.length daba undefined, el
// paso se salteaba EN SILENCIO y la simulación nunca creaba una
// RutaEjecucion real. Dos días pareciendo que andaba.
//
// Qué revisa: que nadie use como array la respuesta de un endpoint
// que envuelve la lista en un objeto.
//
// La lista de endpoints envueltos NO está escrita a mano: se deduce
// leyendo los services. Si mañana otro service pasa a envolver su
// lista, este guardián se entera solo.
//
// Cero dependencias.
// ════════════════════════════════════════════════════════════════
import { archivos, leer } from "./_util.mjs";
import { basename, dirname } from "node:path";

// ---- 1. Qué endpoints envuelven la lista, según el backend ----
// Se acepta tanto `return { conductores }` como `return { conductores: filas }`.
const envueltos = new Map(); // "conductores" -> [formas de nombrarlo en el front]
for (const ruta of archivos("src/modules", [".service.js"])) {
  const modulo = basename(dirname(ruta));
  if (new RegExp(`return \\{\\s*${modulo}\\s*[},:]`).test(leer(ruta))) {
    const Modulo = modulo[0].toUpperCase() + modulo.slice(1);
    // El front llega al mismo endpoint de tres formas distintas, y el guardián
    // tiene que conocer las tres o deja de mirar justo donde importa:
    //   simulacion.html   fetch('/api/conductores')
    //   web/src/lib/api   api.get('/conductores')      (baseURL ya trae /api)
    //   las pantallas     getConductores()             (el helper de api.ts)
    envueltos.set(modulo, [`/api/${modulo}`, `'/${modulo}'`, `get${Modulo}`]);
  }
}

if (envueltos.size === 0) {
  console.log("✅ Forma de API OK: ningún endpoint envuelve su lista.");
  process.exit(0);
}

// ---- 2. Quién consume esos endpoints como si fueran arrays ----
const USO_DE_ARRAY = /\.length\b|\.map\(|\.filter\(|\.forEach\(|\[0\]/;
const VENTANA = 3; // el uso puede estar unas líneas más abajo

let fallos = 0;
let revisados = 0;

const consumidores = [
  ...archivos("web/src",    [".ts", ".tsx", ".js", ".jsx"]),
  ...archivos("web/public", [".html", ".js"]),
];

for (const ruta of consumidores) {
  const lineas = leer(ruta).split(/\r?\n/);
  revisados++;

  for (const [clave, formas] of envueltos) {
    for (let i = 0; i < lineas.length; i++) {
      if (!formas.some(f => lineas[i].includes(f))) continue;

      const bloque = lineas.slice(i, i + VENTANA + 1).join("\n");
      if (!USO_DE_ARRAY.test(bloque)) continue;   // solo lo pasa, no lo recorre
      if (bloque.includes("." + clave)) continue; // ya desenvuelve: está bien

      fallos++;
      console.error(`
  ${ruta}:${i + 1}
     usa la respuesta de /api/${clave} como si fuera un array.
     Ese endpoint devuelve { ${clave}: [...] }, así que .length da
     undefined y el bloque se saltea sin lanzar ningún error.

     arreglalo así:  const lista = r.${clave} || r;
                     if (lista.length) { ... lista[0] ... }

     (es el mismo patrón que ya usa el panel web: d.${clave} || d)`);
    }
  }
}

if (fallos) {
  console.error(`\n❌ FORMA DE API: ${fallos} lugar(es) leen mal una lista envuelta.`);
  console.error("   Este es el fallo que no avisa: no hay excepción, solo datos que faltan.\n");
  process.exit(1);
}

const lista = [...envueltos.keys()].map(k => `/api/${k}`).join(", ");
console.log(`✅ Forma de API OK: nadie lee como array ${lista} (${revisados} archivos).`);
