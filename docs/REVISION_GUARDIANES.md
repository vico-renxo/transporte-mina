# REVISIÓN COMPLETA + GUARDIANES — 2026-08-30

> **Actualización de la misma noche.** Lo de abajo describe la revisión de la
> mañana, con 6 guardianes. Al final del día son **8** y dos afirmaciones de
> este documento dejaron de ser ciertas:
>
> - «El sitio publicado apunta a Render» → ya no: la API va por
>   `https://viczul.com/api` (Cloudflare). El **WebSocket** sí sigue en Render,
>   y tiene que seguir así.
> - «`web/.env.production` correcto» → ese archivo **no manda solo**: Cloudflare
>   Pages tiene una variable de build con el mismo nombre que lo pisa. Ver
>   regla 9 del HANDOFF.
>
> Guardianes 7 y 8, agregados después de dos accidentes reales de hoy:
>
> | # | Guardián | El accidente que ataja |
> |---|---|---|
> | 7 | `verificar-forma-api` | La simulación leía `{conductores:[...]}` como si fuera un array. Fallaba **en silencio**: sin excepción, solo datos que faltaban. |
> | 8 | `verificar-socket` | Al mover la API a Cloudflare, dos pantallas se llevaron el WebSocket con ella (`io(API)`, `io(BASE)`) y el GPS en vivo se congeló sin mostrar ningún error. |
>
> Los dos se probaron reintroduciendo el bug a propósito: el corredor corta
> con exit 1. Un guardián que nunca se vio fallar no está probado.
>
> También se **retiró** un guardián (`verificar-wrangler`) que se había
> agregado esta noche: culpaba al `wrangler.toml` de la raíz de romper los
> builds de Pages, y eso era **falso** — todos figuran Success en el panel.
> Un guardián que cuenta una causa equivocada es peor que no tenerlo.

## 1. Qué revisé

Los **56 archivos de código** del repo `vico-renxo/transporte-mina` en `main`
(commit `c73eb58`), no solo los que toqué yo. Más el bundle ya publicado en
viczul.com/transporte y el backend vivo en Render.

## 2. Lo que está bien (verificado, no supuesto)

| Qué | Evidencia |
|---|---|
| Backend responde | `GET /api/rutas/publicas` → Ruta 1 con sus 5 paraderos |
| El sitio publicado apunta a Render | grepeé los 13 chunks JS de /transporte/login/: `onrender.com` sí, `localhost` **no** |
| No hay `web/functions/` | árbol del repo limpio (la regla que rompe CF Pages) |
| Ningún enlace se salta `/transporte` | 24 archivos de `web/src` revisados |
| Orden de rutas Express correcto | ninguna ruta literal tapada por `/:id` en los 9 routers |
| `web/.env.production` correcto | `NEXT_PUBLIC_API_URL=https://transporte-mina.onrender.com` |
| Sin `localhost:3001` en código de app | solo aparece como fallback en `next.config.js` |

## 3. Lo que faltaba (2 cosas, ambas resueltas el 2026-08-30)

### ✅ A. El build de Render corre migraciones — contra tu propia regla — RESUELTO 2026-08-30 (HANDOFF bug 15)

> **Resuelto 2026-08-30.** `package.json` ya tiene `"build": "prisma
> generate"`, sin `migrate deploy`. Es el bug 15 del HANDOFF. Queda el texto
> original de esta revisión como registro de qué se detectó y por qué
> importaba:

`package.json` tenía:

```json
"build": "prisma generate && prisma migrate deploy"
```

Tu regla absoluta dice **nunca** migrar en el build: la base está detrás del
pooler de Supabase (6543, pgBouncer) y `migrate deploy` pide locks que el
pooler no soporta. No explotaba porque Render usaba su propio comando, pero
era una bomba con temporizador: el día que alguien tocara la config del
servicio, o restaurara el servicio desde cero, el deploy se colgaba.

**Arreglo aplicado:** `"build": "prisma generate"`.

### ✅ B. `gps.routes.js` consulta la base desde la capa de rutas — RESUELTO 2026-08-30 (HANDOFF bug 16)

> **Resuelto 2026-08-30.** `gps.routes.js` ya no crea su propio
> `PrismaClient`: llama a `obtenerInfoEjecucion()` en `gps.service.js`, que
> cachea el resultado 5 minutos por `rutaEjecucionId`. Es el bug 16 del
> HANDOFF. Queda el texto original de esta revisión como registro:

`src/modules/gps/gps.routes.js` creaba su propio `PrismaClient` (segundo pool
de conexiones del módulo) y hacía un `findUnique` con 3 joins **en cada
coordenada GPS que manda el conductor** — o sea cada 4 segundos, por
conductor, solo para armar el nombre que va en el evento de socket.

No era el BUG 13 (ahí era una conexión nueva por request), pero era la misma
familia: consulta pesada en el camino caliente, sobre el plan free.

**Arreglo aplicado:** el `findUnique` se movió a `gps.service.js` como
`obtenerInfoEjecucion()`, con caché de 5 minutos por `rutaEjecucionId` (los
datos no cambian durante la ejecución), más `olvidarEjecucion()` para
invalidar si hace falta.

### Nota aparte, no es bug

`next.config.js` tiene `typescript: { ignoreBuildErrors: true }` y
`eslint: { ignoreDuringBuilds: true }`. El build **nunca** te va a avisar de
un error de tipos. Por eso los guardianes valen acá más que en otro proyecto:
son la única red que queda antes de publicar.

## 4. Guardianes instalados

Seis scripts de Node, cero dependencias, cada uno vigila **un accidente que ya
pasó en esta app**:

| Guardián | El accidente que ataja |
|---|---|
| `verificar-basepath` | enlace a `/login` en vez de `/transporte/login/` → usuario fuera del sitio |
| `verificar-api-url` | se borra `web/.env.production` → el sitio se publica apuntando a localhost, sin error |
| `verificar-prisma` | BUG 13: `new PrismaClient()` en un routes → "too many connections" |
| `verificar-deploy-render` | migraciones en el build → deploy colgado contra pgBouncer |
| `verificar-export-estatico` | falta `trailingSlash` o aparece `web/functions/` → sitio entero en 404 |
| `verificar-rutas-express` | `/publicas` declarada después de `/:id` → endpoint inalcanzable |

Cada uno dice **archivo:línea y cómo arreglarlo**, y termina en `exit 1`.

### Probados de verdad

No basta con verlos en verde. Reintroduje cada bug a propósito y confirmé que
lo cazan:

```
enlace sin basePath       → ❌ exit 1 → restaurado → ✅ exit 0
borrar .env.production    → ❌ exit 1
.env con localhost        → ❌ exit 1 → restaurado → ✅ exit 0
PrismaClient en routes    → ❌ exit 1 → restaurado → ✅ exit 0
PrismaClient en función   → ❌ exit 1
/publicas después de /:id → ❌ exit 1 → restaurado → ✅ exit 0
quitar trailingSlash      → ❌ exit 1
crear web/functions/      → ❌ exit 1 → restaurado → ✅ exit 0
```

### Cómo se corren

```bash
node guardianes/guardianes.mjs
```

Y solos, sin tu PC: `.github/workflows/guardianes.yml` los corre en cada push
a `main` y en cada Pull Request. Gratis e ilimitado en repos públicos. Si algo
falla, GitHub te manda un mail y marca el commit con ❌.

## 5. Lo que los guardianes NO atajan

**El verde no prueba que la app funcione.** Miran el código. No miran si la
pantalla dice la verdad, ni si el pasajero que aprobaste quedó en el paradero
correcto. Te compran el derecho a probar la app en vez de gastar la tarde en
errores tontos. No te compran no probarla.
