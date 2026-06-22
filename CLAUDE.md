# TransporteMina — Memoria del Proyecto (CLAUDE.md)

Sistema de transporte de personal minero. Node.js/Express + Next.js + PostgreSQL. Desplegado 100% gratis en la nube. Arequipa, Peru.

---

## Stack de produccion

| Capa | Servicio | URL |
|------|----------|-----|
| Frontend (panel admin + simulacion) | Vercel | https://transporte-mina.vercel.app |
| Backend (API + WebSocket) | Render free tier | https://transporte-mina.onrender.com |
| Base de datos | Supabase PostgreSQL | Proyecto ID: midimdsudblhonhhqwlv |
| Codigo fuente | GitHub | https://github.com/vico-renxo/transporte-mina |
| Simulacion 3 actores | Vercel (static) | https://transporte-mina.vercel.app/simulacion.html |

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

## Vercel — Configuracion

- Root Directory: `web/`
- Framework: Next.js (auto-detectado)
- Deploy automatico en cada push a main

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
Solucion: FRONTEND_URL=https://transporte-mina.vercel.app (sin barra final)

### E8: navigate de Chrome MCP no soporta file:// URLs
Solucion: Subir archivos HTML a GitHub/Vercel para servirlos desde HTTPS

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

Render auto-redeploya el backend. Vercel auto-redeploya el frontend.

---

## Monitoreo

Render free tier duerme tras 15 min de inactividad.
Solucion: UptimeRobot (gratis) pinguea https://transporte-mina.onrender.com/health cada 5 min.

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