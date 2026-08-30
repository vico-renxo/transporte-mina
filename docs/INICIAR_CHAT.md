# Cómo arrancar un chat nuevo con todo el contexto de TransporteMina

## Opción A — Una vez que los documentos estén en el repo (lo mejor)

Copiá y pegá esto como primer mensaje:

```
Trabajo en TransporteMina, mi sistema de transporte de personal minero.

Repo público: https://github.com/vico-renxo/transporte-mina (rama main)

ANTES DE TOCAR NADA, leé estos archivos del repo y confirmame que los leíste:
- HANDOFF.md          → estado, arquitectura, reglas absolutas, bugs 1-14
- MAPA_FUNCIONES.md   → qué hace cada función
- MAPA_LLAMADAS.md    → qué pantalla llama a qué endpoint
- MAPA_DUPLICADOS.md  → qué está escrito dos veces
- guardianes/         → los chequeos que bloquean la subida

Notas de entorno:
- Tu sandbox NO alcanza github.com ni Render. Para leer el repo usá
  raw.githubusercontent.com; para escribir, la Git Data API desde mi navegador.
- Render duerme a los 15 min: el primer request tarda ~1 minuto.
- La web se sirve en https://viczul.com/transporte

Lo que quiero hacer hoy: [ESCRIBÍ ACÁ LO QUE NECESITÁS]
```

## Opción B — Mientras los documentos no estén en el repo

Guardá los .md en una carpeta tuya (por ejemplo
`C:\Users\usuario\Desktop\TransporteMina\docs\`), conectá esa carpeta al
chat nuevo, y escribí:

```
Te conecté la carpeta con la documentación de mi proyecto TransporteMina.
Leé HANDOFF.md primero: ahí está el estado, las reglas absolutas y los bugs.
Después leé los MAPA_*.md. Cuando termines, decime qué entendiste y
esperá instrucciones.
```

## Regla de oro

Ningún chat recuerda al anterior. Lo único que sobrevive es lo que quede
**escrito en el repo**. Cada vez que se arregle un bug nuevo o se cambie una
regla, actualizá `HANDOFF.md` en el mismo commit. Si no está ahí, la próxima
sesión no lo sabe.
