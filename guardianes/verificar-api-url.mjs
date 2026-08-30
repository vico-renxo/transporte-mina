// ════════════════════════════════════════════════════════
// GUARDIÁN DE LA URL DEL BACKEND
//
// Por qué existe: la web es un export estático — la URL del backend se
// congela EN EL BUILD. next.config.js tiene de fallback
// 'http://localhost:3001', así que si web/.env.production desaparece o
// pierde NEXT_PUBLIC_API_URL, el build sale verde, se publica, y todos
// los botones fallan en silencio contra la PC del usuario.
// Qué revisa: que web/.env.production exista, que las dos URLs sean https
// públicas, y que SOCKET_URL siga apuntando a Render.
//
// Lo del socket se agregó el 2026-08-30, cuando la API pasó a ir por
// Cloudflare (viczul.com/api/*). Es tentador mover las dos URLs juntas, pero
// el Worker enruta SOLO /api/*: si el socket apuntara a viczul.com, el
// WebSocket se caería y el mapa en vivo dejaría de moverse — sin ningún
// error visible en la pantalla, sólo un bus que no avanza.
// Cero dependencias.
// ════════════════════════════════════════════════════════
import { existe, leer } from "./_util.mjs";

const ENV = "web/.env.production";
const CLAVES = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SOCKET_URL"];
let fallos = 0;

if (!existe(ENV)) {
  console.error(`\n  falta el archivo ${ENV}`);
  console.error("     créalo con:");
  console.error("       NEXT_PUBLIC_API_URL=https://transporte-mina.onrender.com");
  console.error("       NEXT_PUBLIC_SOCKET_URL=https://transporte-mina.onrender.com");
  fallos++;
} else {
  const contenido = leer(ENV);
  for (const clave of CLAVES) {
    const m = contenido.match(new RegExp(`^\\s*${clave}\\s*=\\s*(.+)$`, "m"));
    if (!m) {
      console.error(`\n  ${ENV}: falta ${clave}`);
      console.error(`     agregá la línea: ${clave}=https://transporte-mina.onrender.com`);
      fallos++;
      continue;
    }
    const valor = m[1].trim();
    if (!/^https:\/\//.test(valor) || /localhost|127\.0\.0\.1/.test(valor)) {
      console.error(`\n  ${ENV}: ${clave} = ${valor}`);
      console.error("     tiene que ser una URL https pública (https://transporte-mina.onrender.com),");
      console.error("     nunca localhost: el valor queda grabado en el HTML publicado.");
      fallos++;
    }
  }
}

// El socket tiene que seguir yendo a Render: el Worker sólo enruta /api/*.
if (existe(ENV)) {
  const socket = leer(ENV).match(/^\s*NEXT_PUBLIC_SOCKET_URL\s*=\s*(.+)$/m);
  if (socket && /viczul\.com/.test(socket[1])) {
    console.error(`\n  ${ENV}: NEXT_PUBLIC_SOCKET_URL = ${socket[1].trim()}`);
    console.error("     el WebSocket NO puede ir por Cloudflare: el Worker enruta sólo");
     console.error("     /api/*, así que socket.io daría 404 y el mapa en vivo se congela");
    console.error("     sin mostrar ningún error.");
    console.error("     arreglalo así: NEXT_PUBLIC_SOCKET_URL=https://transporte-mina.onrender.com");
    fallos++;
  }
}

if (fallos) {
  console.error(`\n❌ URL DEL BACKEND: ${fallos} problema(s). El sitio se publicaría apuntando al lugar equivocado.\n`);
  process.exit(1);
}
console.log("✅ URL del backend OK: API por Cloudflare, socket directo a Render.");
