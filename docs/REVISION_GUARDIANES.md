# REVISIÓN COMPLETA + GUARDIANES — 2026-08-30

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

## 3. Lo que falta (2 cosas reales)

### 🔴 A. El build de Render corre migraciones — contra tu propia regla

`package.json`:

```json
"build": "prisma generate && prisma migrate deploy"
```

Tu regla absoluta dice **nunca** migrar en el build: la base está detrás del
pooler de Supabase (6543, pgBouncer) y `migrate deploy` pide locks que el
pooler no soporta. Hoy no explota porque Render usa su propio comando, pero
es una bomba con temporizador: el día que alguien toque la config del
servicio, o restaures el servicio desde cero, el deploy se cuelga.

**Arreglo:** `"build": "prisma generate"`.

### 🟡 B. `gps.routes.js` consulta la base desde la capa de rutas

`src/modules/gps/gps.routes.js:3` crea su propio `PrismaClient` (segundo pool
de conexiones del módulo) y hace un `findUnique` con 3 joins **en cada
coordenada GPS que manda el conductor** — o sea cada 4 segundos, por
conductor, solo para armar el nombre que va en el evento de socket.

No es el BUG 13 (ahí era una conexión nueva por request), pero es la misma
familia: consulta pesada en el camino caliente, sobre el plan free.

**Arreglo:** mover ese `findUnique` a `gps.service.js` y cachear el resultado
por `rutaEjecucionId` (los datos no cambian durante la ruta).

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
