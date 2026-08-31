# TransporteMina — Mejoras propuestas (para revisión)

> **Este documento es de la sesión de julio y ya está aplicado.** Lo del
> 2026-08-30 está en `HANDOFF.md` (§5 bugs 15-22, §8 pendientes, §8.b cómo se
> verificó, §8.c Cloudflare) y en `CAMBIOS_DETALLADOS.md`.
>
> Dos cosas de acá quedaron obsoletas: «Frontend (CF Pages + Vercel)» —Vercel
> ya no sirve este proyecto, sus URLs dan 404— y el pendiente de `FRONTEND_URL`,
> que hay que revisar con `https://viczul.com`, no con la URL de Vercel.

7 archivos modificados. Ninguno toca CF Worker, `_redirects`, `web/functions/` ni nada de viczul.com.

## Backend (Render — redeploy automático al push)

### 1. `src/modules/auth/auth.service.js`
**Bug raíz encontrado (no documentado):** el login nunca devolvía `conductorId` ni `pasajeroId`.
Por eso el panel conductor tenía el hack `|| true` — `usuario.conductorId` era siempre `undefined`.
- Ahora el login incluye `conductorId` y `pasajeroId` en la respuesta.

### 2. `src/modules/rutas/rutas.service.js`
- `GET /api/rutas/activas` ahora incluye `rutaId` en cada ejecución (el conductor lo necesita para cargar sus paraderos reales).

### 3. `src/modules/pasajeros/pasajeros.service.js` + 4. `pasajeros.routes.js`
- `mi-perfil`, `/estado` y `/en-paradero` creaban un `new PrismaClient()` POR CADA REQUEST → fuga de conexiones con pgBouncer (riesgo real de tumbar el pool de Supabase). La lógica se movió al service con el singleton del módulo.
- El endpoint `/api/pasajeros/mi-perfil` YA EXISTÍA — verificado y refactorizado.

## Frontend (CF Pages + Vercel)

### 5. `web/src/lib/api.ts`
**Bug encontrado (no documentado):** `getEstadosHoy` llamaba a `/pasajeros/estados/:rutaId` pero el backend expone `/pasajeros/estados-hoy/:rutaId` → 404 silencioso en el panel admin.
- Corregido. También `aprobarPasajero` ahora envía `paraderoId` (el backend lo exige).

### 6. `web/src/app/conductor/page.tsx` — REESCRITO COMPLETO
- ✅ Checkin dinámico: paraderos y pasajeros reales desde `/pasajeros/estados-hoy/:rutaId` (adiós IDs hardcodeados).
- ✅ Filtra la ejecución por `conductorId` real (eliminado `|| true`, con fallback para sesiones viejas).
- ✅ Sesión expirada: cualquier 401 limpia `tm_conductor_*` y vuelve al login.
- ✅ Rediseño visual Tailwind mobile-first (dark, acento ámbar, header sticky, barra de progreso de paraderos, mismo lenguaje visual que el panel pasajero).
- ✅ GPS REAL del teléfono (`navigator.geolocation.watchPosition`, máx 1 envío/4s) + checkbox "modo demo" que mantiene la ruta simulada de Arequipa.
- ✅ NUEVO: botón "🚨 Incidencia" (usa `POST /rutas/:id/incidencia` que ya existía en el backend pero ninguna UI lo usaba).
- ✅ NUEVO: botón cerrar sesión. Confirmación antes de finalizar ruta.
- ✅ Muestra estado declarado de cada pasajero (🚶 por sus medios / 🙅 ausente) para que el conductor no espere a quien no viene.
- ✅ Contador "abordo" real derivado de checkins (antes era un contador local incorrecto).

### 7. `web/src/app/pasajero/page.tsx` — mejoras puntuales (mismo diseño)
- ✅ Sesión expirada: 401 → limpia `tm_pasajero_*` y vuelve al login.
- ✅ NUEVO: botón "📢 Estoy en el paradero — avisar al conductor" (usa `POST /pasajeros/en-paradero` que ya existía pero ninguna UI lo usaba; el conductor lo ve en su log vía socket).
- ✅ Botón cerrar sesión en header y en pantalla de error.
- ✅ Guard SSR (`listo`) para evitar flash del login al recargar con sesión activa.

## Reglas respetadas
- Sin `/login` absoluto, sin localhost hardcodeado, sin `web/functions/`, sin tocar Worker ni `_redirects`, sin prisma migrate.
- Compatible hacia atrás: si un conductor tiene sesión vieja (sin conductorId), usa fallback a la primera ejecución.

## Pendiente posterior al push (no requiere código)
- Verificar `FRONTEND_URL` en Render incluya `https://viczul.com` (bug 9 / pendiente 6).
- Actualizar `C:\Users\usuario\Desktop\CLAUDE.md` con los 2 bugs nuevos (login sin conductorId; ruta estados-hoy).
