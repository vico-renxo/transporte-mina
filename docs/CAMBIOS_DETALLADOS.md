# CAMBIOS REALIZADOS — Sesión 2026-07-02 (Fable 5)
**Commit:** `1bf615d` a main (un solo commit, 7 archivos) — desplegado y verificado en producción.
**Base:** commit `f85f03e` (tu último commit).

---

## 2026-08-31 — Simulación de flota

Página nueva `web/public/simulacion-flota.html`: 4 unidades de 16 plazas sobre
la Ruta 1 real, con 10/20/30/48 pasajeros que declaran al azar si están en su
paradero, se van por sus medios o no viajan. Autocontenida, sin red, sin base
de datos, publicable como artifact.

Tres bugs (23, 24, 25 del HANDOFF) encontrados corriendo la lógica en Node con
un shim de DOM, antes de publicar. Uno de ellos dejaba la página en blanco al
cargar; otro no se veía a simple vista: cada unidad recogía en un solo paradero
y la pantalla se veía perfecta.

Documentado en HANDOFF §5 (bugs 23–25) y §8.d (cómo se prueban las páginas
sueltas), y en MAPA_FUNCIONES §Páginas sueltas.

## BUGS NUEVOS ENCONTRADOS (no estaban en tu documentación)

### BUG 11 — El login nunca devolvía conductorId ni pasajeroId
**Archivo:** `src/modules/auth/auth.service.js`
**Causa raíz del pendiente #3:** el frontend comparaba `e.conductorId === usuario.conductorId`, pero el login no incluía `conductorId` en la respuesta → era siempre `undefined` → por eso alguien puso el hack `|| true`.
```javascript
// ANTES (MAL): usuario sin relación
const usuario = await prisma.usuario.findUnique({ where: { email } });
return { token, usuario: { id, nombre, rol, email, telefono } };

// DESPUÉS (BIEN):
const usuario = await prisma.usuario.findUnique({
  where: { email },
  include: { conductor: { select: { id: true } }, pasajero: { select: { id: true } } }
});
return { token, usuario: { ...igual,
  conductorId: usuario.conductor?.id ?? null,
  pasajeroId:  usuario.pasajero?.id ?? null } };
```
**Regla:** el filtro por conductor en el frontend DEPENDE de este campo. No quitarlo.

### BUG 12 — api.ts llamaba a una ruta que no existe
**Archivo:** `web/src/lib/api.ts`
**Causa:** `getEstadosHoy` llamaba a `/pasajeros/estados/:rutaId` pero el backend expone `/pasajeros/estados-hoy/:rutaId` → 404 silencioso en el panel admin.
```typescript
// ANTES (MAL):
api.get(`/pasajeros/estados/${rutaId}`)
// DESPUÉS (BIEN):
api.get(`/pasajeros/estados-hoy/${rutaId}`)
```
También: `aprobarPasajero(id)` no enviaba `paraderoId` y el backend lo exige → ahora `aprobarPasajero(id, paraderoId?)`.

### BUG 13 — new PrismaClient() POR CADA REQUEST (fuga de conexiones)
**Archivo:** `src/modules/pasajeros/pasajeros.routes.js`
**Causa:** los handlers de `/mi-perfil`, `/estado` y `/en-paradero` hacían `new PrismaClient()` dentro del request. Con pgBouncer (pool de Supabase free) esto agota conexiones con tráfico.
**Solución:** la lógica se movió a `pasajeros.service.js` (nuevas funciones `obtenerMiPerfil(usuarioId)` y `obtenerPasajeroPorUsuario(usuarioId)`) que usan el singleton del módulo. Las rutas quedaron de 1 línea.
**Regla:** NUNCA `new PrismaClient()` dentro de un handler. Siempre el singleton a nivel de módulo.

### BUG 14 (latente, NO corregido) — CF Worker no reenvía body en POST
**Archivo:** `C:\Users\usuario\Desktop\transporte-worker\index.js`
El proxy `/api/*` hace `fetch(targetUrl, { method, headers, redirect })` SIN `body`. Un POST vía `viczul.com/api/...` llega vacío ("Email y password requeridos"). Hoy no afecta porque el frontend llama a Render directo (NEXT_PUBLIC_API_URL). Si algún día usas el proxy, agregar `body: request.body`.

---

## PENDIENTES DE TU LISTA — RESUELTOS

### 1. Conductor — Checkin dinámico (Alta prioridad #1) ✅
**Archivo:** `web/src/app/conductor/page.tsx` (reescrito completo, 411 líneas)
- Se eliminó el componente `PassajeroCheckin` con IDs hardcodeados (`cmqo2lvd10004159ey6065a9b`, etc.).
- Ahora carga: `GET /rutas/activas` → toma `rutaId` → `GET /pasajeros/estados-hoy/:rutaId` (paraderos + pasajeros reales) + `GET /checkin/:ejecucionId` (checkins ya registrados).
- Requirió agregar `rutaId: e.rutaId` a la respuesta de `obtenerEjecucionesActivas()` en `src/modules/rutas/rutas.service.js` (antes no lo devolvía).

### 2. Endpoint /api/pasajeros/mi-perfil (Alta prioridad #2) ✅
**YA EXISTÍA** en el backend — verificado funcionando. Solo se refactorizó (BUG 13).

### 3. Conductor — filtro por conductorId real (Alta prioridad #3) ✅
```typescript
// ANTES (MAL):
r.ejecuciones?.find((e) => e.conductorId === usuario.conductorId || true)
// DESPUÉS (BIEN):
const ej = usuario.conductorId
  ? r.ejecuciones?.find((e) => e.conductorId === usuario.conductorId)
  : r.ejecuciones?.[0]; // fallback para sesiones viejas guardadas sin conductorId
```
(Funciona gracias al fix del BUG 11.)

### 4. Mobile-first del panel conductor (Media #4) ✅
Reescrito de `style` inline a Tailwind, mismo lenguaje visual que el panel pasajero: tema slate oscuro, acento ámbar, header sticky con badge GPS ON/OFF, tarjetas redondeadas, grid de botones 2x2, barra de progreso de paraderos, `max-w-lg mx-auto`.

### 5. Sesión expirada en conductor/pasajero (Media #5) ✅
- Conductor: helper `authFetch()` — cualquier 401 limpia `tm_conductor_token`/`tm_conductor_user` y recarga (vuelve al login propio).
- Pasajero: chequeo `r.status === 401 → cerrarSesion()` en `cargarPerfil`, poll GPS, `declararEstado` y `en-paradero`.
- Ambos: botón ⏻ cerrar sesión en el header (antes NO existía forma de salir).

### 6. CORS en Render (Media #6) ✅ verificado
`FRONTEND_URL` ya incluye viczul.com: fetch desde viczul.com funciona, desde example.com bloqueado (correcto). No hubo que tocar nada.

---

## MEJORAS NUEVAS (no estaban en tu lista)

### Conductor (`conductor/page.tsx`)
- **GPS REAL del teléfono**: `navigator.geolocation.watchPosition` con `enableHighAccuracy`, máx. 1 envío cada 4s. La ruta simulada de Arequipa quedó como checkbox "Modo demo".
- **Botón 🚨 Incidencia**: usa `POST /rutas/:id/incidencia` que ya existía en el backend pero ninguna UI lo llamaba. Suspende la ruta y notifica a supervisor + pasajeros.
- **Estados declarados visibles**: cada pasajero muestra 🚶 "Por sus medios" / 🙅 "No viene hoy" — el conductor ya no espera a quien no viene (los AUSENTE no muestran botones de checkin).
- **Contador "abordo" real** derivado de los checkins (antes era un contador local que se perdía al recargar).
- `confirm()` antes de finalizar ruta; mensaje de "servidor despertando" en login (Render free duerme).
- Guard `listo` para no mostrar flash del login al recargar con sesión activa.

### Pasajero (`pasajero/page.tsx` — mismo diseño, mejoras puntuales)
- **Botón 📢 "Estoy en el paradero — avisar al conductor"**: usa `POST /pasajeros/en-paradero` que ya existía pero ninguna UI lo llamaba. El conductor lo ve en su log vía socket (`pasajero:en-paradero`).
- Botón cerrar sesión en header y en pantalla de error.
- Guard contra doble-carga de Leaflet (`if (!L || !mapContainerRef.current) return`).

---

## ARCHIVOS DEL COMMIT `1bf615d`
| Archivo | Cambio |
|---|---|
| `src/modules/auth/auth.service.js` | + conductorId/pasajeroId en login (BUG 11) |
| `src/modules/rutas/rutas.service.js` | + rutaId en /rutas/activas |
| `src/modules/pasajeros/pasajeros.service.js` | + obtenerMiPerfil, obtenerPasajeroPorUsuario (BUG 13) |
| `src/modules/pasajeros/pasajeros.routes.js` | handlers delgados, sin PrismaClient por request |
| `web/src/lib/api.ts` | fix estados-hoy (BUG 12), aprobarPasajero con paraderoId |
| `web/src/app/conductor/page.tsx` | REESCRITO: Tailwind + checkin dinámico + GPS real + incidencia + logout + 401 |
| `web/src/app/pasajero/page.tsx` | + en-paradero, logout, manejo 401 |

## PRUEBAS EN PRODUCCIÓN (2026-07-02, todo ✅)
1. Backend: health, login×3 roles, rutas/activas con rutaId+conductorId, estados-hoy (5 paraderos, María en Sachaca), POST gps/coordenada, mi-perfil con ejecución activa, en-paradero.
2. UI conductor: login → ruta asignada → checkin de María ✅ → contador 1/1 abordo.
3. UI pasajero: login María → mapa con bus en la coordenada enviada → 7.9km del bus → botón avisar conductor → "Conductor avisado".
4. Cleanup: ruta finalizada vía API (resumen: 1 recogido, 0 ausentes, 7 min).

## MÉTODO DE DEPLOY USADO (nuevo, documentar)
GitHub Git Data API desde un tab del browser (origen ≠ github.com): crear blobs base64 → tree sobre base_tree → commit → PATCH refs/heads/main. **Un solo commit = un solo build** en los 3 servicios (en vez de 7 commits/7 builds con la API de contents).

## ACCIÓN PENDIENTE PARA VICO
- ⚠️ Revocar el token `github_pat_11B3OJ...` (quedó pegado en el chat): https://github.com/settings/tokens
- Copiar este documento a `C:\Users\usuario\Desktop\CLAUDE.md` (regla #9 tuya).

---

# Sesión del 2026-08-30 (noche)

## Bugs corregidos (15-22 del HANDOFF)

| # | Qué estaba mal | Cómo se vio |
|---|---|---|
| 15 | El build de Render corría `prisma migrate deploy` | Contra la regla 6: el pooler 6543 no soporta esos locks |
| 16 | `new PrismaClient()` en `gps.routes.js` | Una conexión por request en el endpoint más caliente |
| 17 | `simulacion.html` tenía la página escrita **dos veces** | 43 ids duplicados, 6 mapas en vez de 3, `Unexpected token '<'` en consola |
| 18 | La simulación leía `{conductores:[...]}` como array | Conductor y vehículo en «—», y `POST /rutas/:id/iniciar` daba 400. **Sin ningún error**: nunca creaba una ejecución real |
| 19 | `startOfDay()` copiada en 5 lugares | El mapa original solo había detectado 2 |
| 20 | `distKm` con dos firmas distintas | Con esa cuenta el admin decide qué paradero le queda más cerca a un pasajero |
| 21 | Dos handlers para iniciar ruta | Mismos roles en distinto orden: divergir era cuestión de tiempo |
| 22 | `cambiar-password` no validaba nada | Aceptaba una contraseña de un carácter; un número en el JSON reventaba en bcrypt con 500 |

## Lo que se agregó

- **Pantalla de cambiar contraseña** (`/transporte/cambiar-password/`), para los 3 roles.
- **Rate limiting** sin dependencias en `/login`, `/registro-pasajero` y `/cambiar-password`.
- **Worker de Cloudflare** (`worker/`): la API pasa a ir por `viczul.com/api`. Arregla el BUG 14.
- **Guardianes 7 y 8**: forma de la API, y socket.
- `subir cambios.bat`, `desplegar worker.bat`, `activar cloudflare.bat`.

## Errores cometidos durante la sesión (que también enseñan)

1. **La pantalla de contraseña le cambiaba la clave al usuario equivocado.** Las 3 sesiones conviven en el mismo navegador y ningún login limpiaba las otras; elegía «la primera que existiera». Lo encontró una revisión hecha por otro agente, no yo.
2. **Mover la API a Cloudflare rompió el WebSocket**, porque dos pantallas lo abrían con la misma constante. Estuvo roto en producción un rato.
3. **Se culpó al `wrangler.toml` de la raíz** de romper los builds de Pages. Falso: todos figuraban Success. La causa real era la variable de build del dashboard pisando a `.env.production`.
4. **Las verificaciones por grep del bundle no servían**: con `basePath`, los chunks están en `/transporte/_next/...` y se estaban pidiendo en `/_next/...`, que devuelve 404. Se buscó texto dentro de respuestas vacías durante un buen rato.

**La lección de las cuatro**: lo único que no se puede falsear es hacer que la
app haga la llamada y mirar a dónde va. El bundle, el panel, el CI y los
guardianes pueden estar todos en verde con la app rota.
