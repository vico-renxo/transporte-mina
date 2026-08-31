# TransporteMina — Memoria del Proyecto (CLAUDE.md)

Sistema de transporte de personal minero. Node.js/Express + Next.js + PostgreSQL. Desplegado 100% gratis en la nube. Arequipa, Peru.

---

## Stack de produccion

| Capa | Servicio | URL |
|------|----------|-----|
| Frontend (los 3 paneles + simulacion) | Cloudflare Pages | https://viczul.com/transporte |
| **API (HTTP)** | CF Worker `transporte-api` -> Render | **https://viczul.com/api** |
| **WebSocket (socket.io)** | Render **directo** | https://transporte-mina.onrender.com |
| Backend (origen real) | Render free tier | https://transporte-mina.onrender.com |
| Base de datos | Supabase PostgreSQL | Proyecto ID: midimdsudblhonhhqwlv |
| Codigo fuente | GitHub | https://github.com/vico-renxo/transporte-mina |
| Simulacion 3 actores | CF Pages (static) | https://viczul.com/transporte/simulacion.html |

> Las URLs de `transporte-mina.vercel.app` que figuraban aca estan MUERTAS (404).
> Vercel ya no sirve este proyecto: lo sirve Cloudflare Pages.

> **La API y el WebSocket van por caminos distintos, a proposito.** La API pasa
> por Cloudflare (WAF, rate limiting de borde, analiticas). El WebSocket NO:
> el Worker enruta solo `/api/*`, asi que socket.io (`/socket.io/`) caeria en
> la web estatica y daria 404. Ver regla 9 del HANDOFF.

---

## CRITICO: Conexion Supabase desde Render

Render Oregon es IPv4-only. Supabase Sao Paulo requiere pooler.

| Uso | Host | Puerto | Parametro |
|-----|------|--------|-----------|
| DATABASE_URL (Prisma runtime) | aws-1-sa-east-1.pooler.supabase.com | **6543** | ?pgbouncer=true |
| DIRECT_URL (migrations) | aws-1-sa-east-1.pooler.supabase.com | 5432 | — |

El host es **aws-1** (NO aws-0). Obtener string exacto desde: Supabase Dashboard → Connect → ORMs → Prisma

---

## Render — Configuracion

- Service ID: srv-d8soacr6sc1c7393ke60
- Root Directory: (vacio — raiz del repo)
- Build Command: `npm install && npx prisma generate`
- Start Command: `node src/index.js`
- Instance: Free
- NO ejecutar prisma migrate en build (no hay DB en build time)

## Cloudflare Pages — Configuracion (reemplaza a Vercel)

- Proyecto: `transporte-mina`, conectado a `vico-renxo/transporte-mina`
- Production branch: `main` · Deploy automatico: habilitado
- Root Directory: `web`
- Build Command: `npm run build` · Build output: `out`
- Dominio propio del proyecto: `transporte-mina.pages.dev`
- viczul.com lo sirve el Worker `viczul` (ruta `viczul.com/*`)

### ⚠️ TRAMPA: la URL de la API esta escrita en DOS lugares

Pages tiene una variable de build `NEXT_PUBLIC_API_URL`, y en Next.js
`process.env` **pisa** a `web/.env.production`. Cambiar solo el archivo del
repo no hace nada: el build sale verde, despliega, y la app sigue apuntando
a donde diga el dashboard. Costo una hora encontrarlo porque todo se ve
bien: commit correcto, CI verde, build Success, sitio funcionando.

Al tocar esa URL: cambiar **los dos**, y despues **volver a construir**
(cambiar la variable no redespliega sola: Deployments -> Manage -> Retry).

## Cloudflare Workers

| Worker | Ruta | Para que |
|---|---|---|
| `transporte-api` | `viczul.com/api/*` | Proxy de la API a Render. Codigo en `worker/`, se despliega con `npx wrangler deploy -c worker/wrangler.toml`. |
| `viczul` | `viczul.com/*` | Sirve el resto del dominio. NO tocar. |
| `transporte-proxy` | `viczul.com/transporte*` | **NO BORRAR: es lo que sirve la app.** Tiene el BUG 14, pero eso solo afectaba a su ruta `/api*`, que se le quitó el 2026-08-30 porque competía con `transporte-api`. Su código vive solo en el dashboard. |

El `wrangler.toml` vive en `worker/`, no en la raiz.

---

## Usuarios del sistema

| Email | Password | Rol |
|-------|----------|-----|
| admin@empresa.com | admin123 | ADMIN |
| conductor@empresa.com | admin123 | CONDUCTOR (Juan Mamani) |
| pasajero@empresa.com | admin123 | PASAJERO (Maria Lopez, paradero Sachaca) |

Hash bcrypt de 'admin123': $2b$10$fmHgtQBnOhYAkqOxescOu.OWG.xLeELtPyeM1eQ7VtAOeSdLbl3I2
Generar hash: python3 -c "import bcrypt; print(bcrypt.hashpw(b'PASSWORD', bcrypt.gensalt(10)).decode())"

---

## Errores encontrados y soluciones

### E1: P1001 — Can't reach database server
Causa: Render Oregon (IPv4) no alcanza conexion directa Supabase (IPv6)
Solucion: Usar Connection Pooler de Supabase en DATABASE_URL

### E2: ENOTFOUND tenant/user not found
Causa: Host incorrecto (aws-0 en lugar de aws-1) o puerto incorrecto (5432 en lugar de 6543)
Solucion: Ir a Supabase → Connect → ORM → Prisma → copiar string exacto

### E3: Render Shell no disponible en free tier
Causa: Render Shell requiere plan Starter (pago)
Solucion: Usar Supabase SQL Editor para operaciones de BD

### E4: Variables enmascaradas en Render no se actualizan al escribir encima
Causa: React state no se actualiza via DOM directo en campos masked
Solucion: Eliminar variable con icono de basura → crear nueva con + Add variable

### E5: Login devuelve 401 sin mostrar error visible
Diagnostico en Render Logs:
  - '[401] POST /api/auth/login – Credenciales invalidas' = DB conecta, falta seed
  - 'ENOTFOUND' = problema de conexion a DB

### E6: Prisma — Invalid invocation en produccion
Causa: Prisma Client no generado en build
Solucion: Agregar 'npx prisma generate' al Build Command en Render

### E7: CORS bloqueando peticiones del frontend
Causa: FRONTEND_URL en Render apuntando a URL incorrecta
Solucion: FRONTEND_URL debe incluir https://viczul.com (sin barra final). La URL de Vercel ya no aplica.

### E8: navigate de Chrome MCP no soporta file:// URLs
Solucion: Subir archivos HTML a GitHub; Cloudflare Pages los sirve por HTTPS desde viczul.com/transporte/

### E9: Monaco editor en Supabase SQL Editor
Para inyectar SQL via JavaScript:
  window.monaco.editor.getEditors()[0].getModel().setValue('-- tu SQL aqui')

### E10: git clone timeout en bash sandbox
Solucion: Usar GitHub Contents API desde browser JavaScript:
  fetch('https://api.github.com/repos/OWNER/REPO/contents/path', {
    method: 'PUT',
    headers: { Authorization: 'Bearer TOKEN', Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ message: 'msg', content: btoa(unescape(encodeURIComponent(content))) })
  })

---

## Workflow para subir cambios a produccion

git add . && git commit -m 'descripcion' && git push origin main

Render auto-redeploya el backend. Cloudflare Pages auto-redeploya el frontend. Vercel YA NO participa.

---

## Monitoreo

Render free tier duerme tras 15 min de inactividad.
Solucion propuesta en su momento: UptimeRobot (gratis) pingueando
https://transporte-mina.onrender.com/health cada 5 min.

⚠️ SIN VERIFICAR (2026-08-31). No se pudo comprobar desde el repo si ese
UptimeRobot existe realmente, porque vive fuera del codigo. Y contradice a
docs/HANDOFF.md, que dice que hay una tarea programada que despierta a Render
UNA vez por dia (5:50). Las dos cosas no pueden ser ciertas a la vez: con un
ping cada 5 min Render nunca dormiria, y el mensaje de "servidor despertando"
del login no tendria sentido. Antes de apoyarse en cualquiera de las dos,
entrar a la cuenta de UptimeRobot y confirmar si el monitor existe y esta
activo.

---

## API endpoints principales

POST /api/auth/login              { email, password } → { token, usuario }
GET  /api/rutas                   Lista rutas
POST /api/rutas/:id/iniciar       Iniciar ejecucion { conductorId, vehiculoId }
POST /api/rutas/:id/finalizar     Finalizar ejecucion
GET  /api/rutas/activas           Ejecuciones en curso
POST /api/gps/coordenada          { rutaEjecucionId, lat, lng, velocidad } (CONDUCTOR)

WebSocket eventos: gps:update | ruta:iniciada | ruta:finalizada | alerta:proximidad

---

## Notas tecnicas

- Socket.io en Render: servidor persistente (no serverless). Vercel NO soporta Socket.io.
- Prisma + PgBouncer transaction mode: requiere ?pgbouncer=true para deshabilitar prepared statements.
- Next.js public/: archivos en web/public/ se sirven como estaticos.
- CORS: backend acepta origen de FRONTEND_URL. Para dev local agregar http://localhost:3000.
- Claude-in-Chrome MCP: browsers son tier 'read'. Usar mcp__Claude_in_Chrome__* para interaccion.
- Monaco editor (Supabase): window.monaco.editor.getEditors()[0].getModel().setValue(sql)

## Tests

    npx jest              # los 5 suites, 19 pruebas
    node worker/probar.mjs    # 22 casos del Worker, sin desplegar nada
    node guardianes/guardianes.mjs

No hace falta base de datos ni .env: `__mocks__/@prisma/client.js` reemplaza a
PrismaClient con arrays en memoria, y jest lo toma solo por estar en __mocks__
junto a node_modules. Antes los suites auth/health/alertas fallaban por el
entorno (falta DATABASE_URL en Windows; engine solo-Windows si se corre desde
Linux), no por el codigo.

Ese mock NO valida el schema ni resuelve include anidados. Sirve para probar la
logica alrededor de la consulta, no la consulta. Si algun dia hacen falta
queries de verdad, es una base de prueba, no un mock mas grande.
