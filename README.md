# TransporteMina

Sistema de transporte de personal minero: rutas, unidades, conductores y
pasajeros, con GPS en vivo y alertas de proximidad.
En producción: **https://viczul.com/transporte**

> **Este archivo es la puerta de entrada.** GitHub lo muestra solo en la
> portada del repo, así que es lo único que alguien encuentra sin buscarlo.
> Si venís a retomar el proyecto —persona o asistente— empezá acá.

---

## Si vas a abrir un chat nuevo

Conectá la carpeta del proyecto y pegá esto:

```
Trabajo en TransporteMina, mi sistema de transporte de personal minero.
Te conecté la carpeta del proyecto.

Antes de tocar nada leé, en este orden:
  1. README.md              (raíz)  → mapa general
  2. CLAUDE.md              (raíz)  → stack, URLs, config de cada servicio
  3. docs/HANDOFF.md                → reglas absolutas, bugs 1-25, pendientes
  4. docs/MAPA_FUNCIONES.md         → qué hace cada función
  5. docs/MAPA_LLAMADAS.md          → qué pantalla llama a qué endpoint

Después decime qué entendiste, sobre todo las reglas absolutas del §3 del
HANDOFF, y esperá instrucciones.

Lo que quiero hacer hoy: [ESCRIBÍ ACÁ]
```

Hay que **conectar la carpeta** (`D:\TransporteMina-app`). Un chat sin ella no
ve ninguno de estos archivos por más que se los nombres. Detalle completo en
[`docs/INICIAR_CHAT.md`](docs/INICIAR_CHAT.md).

---

## Las tres cosas que hay que saber antes de tocar nada

**1. El dashboard le gana al repo.** Una variable cargada en el panel de
Cloudflare Pages pisa a `web/.env.production`, porque `process.env` gana en
Next.js. Es invisible desde el código y ya rompió la app un día entero. Si lo
que dice el repo no coincide con lo que hace la app en vivo, **mirá el
dashboard primero**.

**2. Verde no quiere decir que funcione.** Los guardianes, el CI y los paneles
pueden estar todos en verde mientras la app está rota. La única verificación
que vale es **hacer que la app haga la llamada y mirar a dónde va**. Ver §8.b
y §8.d del HANDOFF.

**3. El Worker `transporte-proxy` NO se borra.** Tiene la ruta
`viczul.com/transporte*`, que es la que sirve la app. Borrarlo tumba el sitio.

---

## Documentación

| Documento | Para qué | ¿Siempre? |
|---|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Stack, URLs, config de Cloudflare Pages, cómo correr los tests | **Sí** |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | El principal: reglas absolutas, credenciales, bugs 1-25, guardianes, pendientes, cómo se verifica | **Sí** |
| [`docs/MAPA_FUNCIONES.md`](docs/MAPA_FUNCIONES.md) | Qué hace cada función del backend y del frontend | **Sí** |
| [`docs/MAPA_LLAMADAS.md`](docs/MAPA_LLAMADAS.md) | Qué pantalla llama a qué endpoint, y cuáles no llama nadie | **Sí** |
| [`docs/INICIAR_CHAT.md`](docs/INICIAR_CHAT.md) | Cómo arrancar un chat nuevo, y qué NO está en los docs | Al empezar |
| [`docs/MAPA_DUPLICADOS.md`](docs/MAPA_DUPLICADOS.md) | Qué lógica estuvo escrita dos veces y cómo se unificó | Si refactorizás |
| [`docs/REVISION_GUARDIANES.md`](docs/REVISION_GUARDIANES.md) | Por qué existe cada guardián y cuál se retiró | Si tocás guardianes |
| [`docs/CAMBIOS_DETALLADOS.md`](docs/CAMBIOS_DETALLADOS.md) | Changelog por sesión | Si querés historia |
| [`docs/RESUMEN_CAMBIOS.md`](docs/RESUMEN_CAMBIOS.md) | Snapshot de julio. **Obsoleto**, tiene banner | Casi nunca |
| [`docs/RONDA3_ESTADO.md`](docs/RONDA3_ESTADO.md) | Registro histórico | Casi nunca |

Secciones del HANDOFF que se buscan seguido: **§3** reglas absolutas ·
**§4** credenciales · **§4.b** usuarios de prueba · **§4.c** rotar la contraseña
del admin · **§4.d** hallazgo abierto de GPS · **§5** bugs 1-25 · **§7**
guardianes · **§8** pendientes · **§8.c** Cloudflare.

---

## Arquitectura

| Pieza | Dónde | Detalle |
|---|---|---|
| Web | Cloudflare Pages | Next.js 14, `output: 'export'`, `basePath: '/transporte'` |
| Backend | Render (free) | Express + Socket.io + Prisma |
| Base | Supabase | PostgreSQL, pooler puerto **6543** |
| Proxy | CF Worker `transporte-api` | `viczul.com/api/*` → Render |

**La API va por Cloudflare; el socket va DIRECTO a Render.** El Worker enruta
solo `/api/*`, así que un socket apuntado a `viczul.com` pide `/socket.io/`,
cae en la web estática y da 404: el GPS se congela sin mostrar ningún error.
Hay un guardián que lo vigila.

**Render duerme a los 15 min** sin tráfico: el primer request tarda ~1 minuto.

---

## Comandos

Todo es doble clic, no hace falta terminal:

| Archivo | Qué hace |
|---|---|
| `subir cambios.bat` | Sube a GitHub y dispara Render + Cloudflare Pages. **Es el método actual.** |
| `probar todo.bat` | Guardianes + worker + typecheck + tests |
| `desplegar worker.bat` | Despliega el CF Worker |
| `INICIAR_SISTEMA.bat` | Levanta todo en local |

Desde terminal:

```bash
npx jest                            # 6 suites, 30 pruebas
node worker/probar.mjs              # 22 casos del Worker, sin desplegar
node guardianes/guardianes.mjs      # 8 guardianes
node web/public/probar-simulacion.mjs   # 21 aserciones de la simulación
```

No hace falta base de datos ni `.env`: `__mocks__/@prisma/client.js` reemplaza
a Prisma con arrays en memoria.

---

## Simulaciones

| Página | Qué hace |
|---|---|
| [`/transporte/simulacion.html`](https://viczul.com/transporte/simulacion.html) | **Contra el sistema real.** Hasta 4 unidades, dos direcciones, 3 vistas (admin / conductor / pasajero). Crea `RutaEjecucion` y emite GPS. **Escribe en la base.** |
| [`/transporte/simulacion-flota.html`](https://viczul.com/transporte/simulacion-flota.html) | Cerrada, sin red ni base. 4 unidades de 16 plazas con pasajeros que declaran si esperan, se van por sus medios o no viajan. Para mostrar sin riesgo. |

Estas páginas viven en `web/public/` y **no pasan por el build**: ni el CI ni
los guardianes las miran. Lo único que las vigila es
`node web/public/probar-simulacion.mjs`.

---

## Datos de prueba

```bash
node prisma/seed-pruebas.js 30 4        # 30 pasajeros, 4 conductores
node prisma/purgar-pruebas.js           # muestra qué borraría, NO borra
node prisma/purgar-pruebas.js --borrar  # borra
```

Todo lo de prueba lleva `zz-prueba-*@prueba.local` y placas `ZZP-`. El filtro
de purga exige **las dos cosas**: un `LIKE '%prueba%'` habría borrado a un
`juan.prueba@gmail.com` real, y hay 11 tests que lo demuestran.

Alternativa sin `DATABASE_URL`: `prisma/datos-prueba.sql` se pega en el editor
SQL de Supabase, que ya tiene acceso a la base.

---

## Guardianes

Ocho scripts sin dependencias que **bloquean la subida** cuando vuelve un bug
que ya rompió la app: basePath, api-url, prisma, deploy-render, export-estático,
rutas-express, forma-api y socket. Cada uno documenta en su cabecera qué
desastre concreto previene.

Un guardián que cuenta una causa equivocada es peor que no tenerlo: ya se
escribió uno sobre una premisa falsa y hubo que retirarlo.

---

## Regla de oro

Cada vez que se arregle un bug o se cambie una regla, se actualiza
`docs/HANDOFF.md` **en el mismo commit**. Ningún chat recuerda al anterior. Si
no está escrito, la próxima sesión no lo sabe y lo rompe de nuevo.
