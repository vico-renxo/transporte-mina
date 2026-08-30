#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// GUARDIÁN DEL SOCKET
//
// Por qué existe: el 2026-08-30, al poner la API detrás de Cloudflare
// (NEXT_PUBLIC_API_URL pasó de Render a viczul.com), dos pantallas
// quedaron abriendo el WebSocket con esa MISMA constante:
//   conductor/page.tsx  io(API, ...)
//   pasajero/page.tsx   io(BASE, ...)
// El Worker enruta sólo /api/*, así que socket.io pide /socket.io/,
// cae en la web estática y da 404. El GPS en vivo se congela y la
// pantalla no muestra ningún error: un bus que no avanza.
//
// Se descubrió mirando el bundle publicado del panel del pasajero,
// donde aparecía viczul.com y ya no aparecía Render.
//
// Qué revisa: que ninguna llamada a io(...) use la constante de la
// API. El socket va derecho a Render, con NEXT_PUBLIC_SOCKET_URL.
//
// Cero dependencias.
// ════════════════════════════════════════════════════════════════
import { archivos, leer } from "./_util.mjs";

// Nombres que en este proyecto significan "la URL de la API".
const DE_LA_API = ["API", "BASE", "API_URL", "BASE_URL"];

let fallos = 0;
let revisados = 0;

for (const ruta of archivos("web/src", [".ts", ".tsx"])) {
  const lineas = leer(ruta).split(/\r?\n/);
  revisados++;
  lineas.forEach((linea, i) => {
    const m = linea.match(/\bio\(\s*([A-Za-z_$][\w$]*)\s*[,)]/);
    if (!m) return;
    if (!DE_LA_API.includes(m[1])) return;
    fallos++;
    console.error(`
  ${ruta}:${i + 1}
     abre el socket con ${m[1]}, que es la URL de la API.

     La API va por Cloudflare, pero el Worker enruta SOLO /api/*.
     socket.io pide /socket.io/, que por ese camino cae en la web
     estática y devuelve 404: el mapa en vivo se congela y no se
     muestra ningún error.

     arreglalo así:  const SOCKET = process.env.NEXT_PUBLIC_SOCKET_URL
                                  || 'https://transporte-mina.onrender.com';
                     io(SOCKET, ...)`);
  });
}

if (fallos) {
  console.error(`\n❌ SOCKET: ${fallos} conexión(es) irían por Cloudflare y se caerían.\n`);
  process.exit(1);
}
console.log(`✅ Socket OK: ninguna conexión usa la URL de la API (${revisados} archivos).`);
