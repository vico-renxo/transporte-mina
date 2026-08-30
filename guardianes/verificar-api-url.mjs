// ════════════════════════════════════════════════════════
// GUARDIÁN DE LA URL DEL BACKEND
//
// Por qué existe: la web es un export estático — la URL del backend se
// congela EN EL BUILD. next.config.js tiene de fallback
// 'http://localhost:3001', así que si web/.env.production desaparece o
// pierde NEXT_PUBLIC_API_URL, el build sale verde, se publica, y todos
// los botones fallan en silencio contra la PC del usuario.
// Qué revisa: que web/.env.production exista y apunte a Render por https.
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

if (fallos) {
  console.error(`\n❌ URL DEL BACKEND: ${fallos} problema(s). El sitio se publicaría apuntando al lugar equivocado.\n`);
  process.exit(1);
}
console.log("✅ URL del backend OK: web/.env.production apunta a Render por https.");
