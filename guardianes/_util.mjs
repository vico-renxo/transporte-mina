// Utilidades compartidas: recorrer archivos sin dependencias.
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function archivos(raiz, extensiones) {
  if (!existsSync(raiz)) return [];
  const salida = [];
  const IGNORAR = new Set(["node_modules", ".next", ".git", "out", "dist", "build"]);
  (function recorrer(dir) {
    for (const nombre of readdirSync(dir)) {
      if (IGNORAR.has(nombre)) continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (extensiones.some(e => nombre.endsWith(e))) salida.push(ruta);
    }
  })(raiz);
  return salida;
}

export function leer(ruta) {
  return readFileSync(ruta, "utf8");
}

export function existe(ruta) {
  return existsSync(ruta);
}
