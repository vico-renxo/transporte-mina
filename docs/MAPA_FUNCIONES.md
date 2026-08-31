# MAPA DE FUNCIONES — TransporteMina
Generado el 2026-08-30 sobre `main`. Actualizado el 2026-08-30 por la noche,
después de: pantalla de contraseña, rate limiting, unificación de duplicados,
Worker de Cloudflare y separación del socket.

## Backend (`src/`)

### Capa de entrada
| Archivo | Función | Qué hace |
|---|---|---|
| `src/index.js` | — | Monta helmet, CORS, los 9 routers, el 404 y el errorHandler. Arranca el monitor GPS. |
| `shared/middleware/auth.js` | `authMiddleware` L3 | Verifica el JWT y pone `req.usuario`. |
| | `requireRol(...roles)` L16 | Corta con 403 si el rol no está en la lista. |
| `shared/middleware/errorHandler.js` | `errorHandler` L1 | Traduce `{status, message}` a JSON. Última red del backend. |
| `config/socket.js` | `initSocket(io)` L8 / `getIo()` L57 | Salas `supervisores` y `ruta:<id>`. `getIo()` se usa con `?.` en todos lados. |
| `shared/middleware/rateLimit.js` | `rateLimit({max, ventanaMs, nombre})` | **Sin dependencias.** Contador en memoria por IP+endpoint. 429 con `Retry-After`. Render free corre una sola instancia, por eso alcanza. |
| | `ipDelCliente(req)` | De dónde sale la IP. Por defecto **solo `req.ip`**: `cf-connecting-ip` la escribe el cliente mientras la API no pase por Cloudflare, y confiar en ella hacía el límite evadible. Se cree solo con `CONFIAR_EN_CLOUDFLARE=1`. |
| `shared/fechas.js` | `startOfDay(fecha?)` / `endOfDay(fecha?)` | Antes copiadas en 5 lugares. **Ojo huso horario**: devuelven medianoche del SERVIDOR (Render = UTC), no de Lima. Explicado en el archivo. |

### Módulo auth
| Función | Línea | Qué hace |
|---|---|---|
| `login(email, password)` | 6 | **Corazón del login unificado.** Devuelve `{token, usuario{rol, conductorId, pasajeroId}}`. El front enruta por `rol`. |
| `registrarPasajero({...})` | 48 | Alta pública. Acepta `domicilioLat/Lng`, `direccion` y `paraderoId`. Deja `aprobado=false`. |
| `actualizarFcmToken` | 82 | Sin UI que la llame (ver mapa de llamadas). |
| — | — | `/login`, `/registro-pasajero` y `/cambiar-password` pasan por `rateLimit` antes del handler. |
| `cambiarPassword` | 95 | **Ya tiene pantalla** (`/transporte/cambiar-password/`). Valida: strings, mínimo 8, distinta de la actual. Antes aceptaba una contraseña de un carácter, y un JSON con un número reventaba dentro de bcrypt con un 500. |

### Módulo rutas
| Función | Línea | Qué hace |
|---|---|---|
| `listarRutas` | 5 | Listado completo para el admin. |
| `listarRutasPublicas` | 34 | **Sin auth.** Solo id/nombre/paraderos, para el registro. |
| `obtenerRuta` / `crearRuta` / `actualizarRuta` | 45/54/79 | CRUD del panel admin. |
| `iniciarRuta({rutaId, conductorId, vehiculoId})` | 84 | Crea la `RutaEjecucion` en estado `EN_RUTA`. |
| — | — | En `rutas.routes.js`: `ROLES_INICIAR` y `handlerIniciar` existen **una sola vez** y se montan en `/:id/iniciar` y en `/iniciar`. Antes eran dos handlers separados con los mismos roles en distinto orden: divergir era cuestión de tiempo. |
| `finalizarRuta` | 113 | Cierra la ejecución. |
| `reportarIncidencia` | 139 | Emite alerta a supervisores. |
| `obtenerEjecucionesActivas` | 148 | Devuelve `rutaId` y `conductorId` — de esto depende que el conductor vea SU ruta. |
| `historialEjecuciones` | 207 | Con filtros de fecha/ruta/conductor. |

### Módulo pasajeros
| Función | Línea | Qué hace |
|---|---|---|
| `obtenerPasajeroPorUsuario` | 13 | Traduce `usuarioId → pasajero`. La usan las otras. |
| `obtenerMiPerfil` | 19 | Perfil + ejecución activa + última coordenada. Es lo que pinta el panel del pasajero. |
| `declararEstado` | 55 | NORMAL / POR_MIS_MEDIOS / AUSENTE del día. |
| `marcarEnParadero` | 79 | Avisa al conductor por socket. |
| `listarPendientesAprobacion` | 105 | Incluye paradero y ruta elegidos en el registro. |
| `actualizarMiDomicilio` | 119 | El pasajero corrige su GPS. Merge parcial: lo que no mandes no se pisa. |
| `aprobarPasajero(id, paraderoId)` | 131 | Asigna paradero **y** `rutaId` derivado. Sin esto, `mi-perfil` no encuentra ruta. |
| `obtenerEstadosHoy(rutaId)` | 161 | Paraderos → pasajeros → estado del día. Lo consume el conductor. |
| `calificarServicio` | 190 | 1 a 5 estrellas. |

### Otros módulos
| Módulo | Funciones | Nota |
|---|---|---|
| `checkin` | `registrarCheckin` 4, `registrarCheckinsParadero` 59, `obtenerCheckinsPorRuta` 71, `resumenCheckins` 82 | El conductor usa la individual; la de paradero (lote) no tiene UI. |
| `gps` | `guardarCoordenada` 4, `obtenerUltimaCoordenada` 10, `obtenerHistorial` 17, **`obtenerInfoEjecucion`**, **`olvidarEjecucion`** | Fix B **hecho**: la consulta salió de `gps.routes.js` al service, con caché de 5 min. Se pedía en CADA coordenada GPS —el endpoint más caliente— y ruta/conductor/placa no cambian durante la ejecución. `olvidarEjecucion()` invalida si hace falta. |
| `alertas` | `verificarProximidad` 14, `enviarAlertaInicioRuta` 93, `enviarAlertaEmergencia` 176 | Depende de Google Maps y FCM/SMS: hoy en modo DEMO (solo `console.log`). |
| `reportes` | `reporteDiario`, `reporteSemanal`, `generarExcel`, `rangoDia` | Excel con exceljs. `rangoDia` y `reporteSemanal` usan `startOfDay`/`endOfDay` de `shared/fechas`. |
| `conductores` / `vehiculos` | CRUD simple | |

## Frontend (`web/src`)

| Pantalla | Componentes/funciones internas | Sesión que usa |
|---|---|---|
| `app/page.tsx` | `RootPage` L8 | Reparte según sesión guardada. Es el semáforo de entrada. |
| `app/login/page.tsx` | `LoginPage` L13 | **Login unificado**: un solo form, enruta por `rol`. |
| `app/registro/page.tsx` | `RegistroPage` L11 | Modalidad 🏠 domicilio (GPS/manual) o 🚏 paradero. |
| `app/conductor/page.tsx` | `cerrarSesion`, `authFetch`, `VistaConductor`, consts `API` y **`SOCKET`** | `tm_conductor_token` |
| `app/pasajero/page.tsx` | `cerrarSesion`, `VistaPasajero`, consts `BASE` (API) y **`SOCKET`** | `tm_pasajero_token`. `deg2rad`/`distKm` locales **borradas** → `@/lib/geo`. |
| `app/(app)/pasajeros/page.tsx` | `PasajerosPage` | Zustand `tm-auth` (admin). `distKm` local **borrada** → `@/lib/geo`. |
| `app/(app)/rutas|conductores|vehiculos/page.tsx` | `Modal`, `Form*`, `handleSave`, `cargar` | idem |
| `app/(app)/mapa/page.tsx` | `MapaPage` 11, `buildPopup` 195 | Leaflet cargado a mano por CDN |
| `app/cambiar-password/page.tsx` | `CambiarPasswordPage`, `problema()` | **Nueva.** Sirve a los 3 roles. Lee `?de=` para saber qué sesión usar. |
| `lib/geo.ts` | `distKm(a: Punto, b: Punto)`, tipo `Punto` | **Nuevo.** Una sola Haversine, una sola firma. Con esta cuenta el admin decide qué paradero le queda más cerca a un pasajero. |
| `lib/socket.ts` | `getSocket()`, `disconnectSocket()` | Socket del panel admin. Usa `NEXT_PUBLIC_SOCKET_URL`. |
| `lib/api.ts` | 29 funciones (`loginApi`, `getRutas`, `aprobarPasajero`…) | Cliente HTTP del panel admin |

## Páginas sueltas (`web/public/`)

No pasan por el build de Next: se sirven tal cual desde
`viczul.com/transporte/<archivo>.html`. Sin TypeScript, sin guardianes, sin CI.
Lo que se rompa ahí no lo detecta nadie salvo que se pruebe a mano (§8.d del
HANDOFF).

### `simulacion.html`
Simulación contra el sistema **real**: pide `/api/rutas`, `/api/conductores` y
`/api/vehiculos`, crea una `RutaEjecucion` y emite GPS por Socket.io. Usa
Leaflet con mosaicos de OpenStreetMap. **Escribe en la base de datos.**

### `simulacion-flota.html`
Simulación **cerrada**, sin red y sin base de datos: 4 unidades de 16 plazas
sobre las coordenadas reales de la Ruta 1. Sirve para mostrar el flujo a
alguien sin tocar producción, y funciona publicada como artifact.

| Función | Qué hace |
|---|---|
| `proy(p)` | Proyecta lat/lng al `viewBox` del SVG, normalizando contra el mínimo y el máximo de los paraderos. Sustituye al mapa: la CSP de un artifact bloquea los mosaicos. |
| `posEnRuta(t)` | Interpola la posición de una unidad dentro del tramo actual. `t` va de 0 a `TOTAL = (paraderos-1) * TRAMOS`. |
| `crear(nPas)` | Arma el estado inicial. Las 4 unidades salen escalonadas (`t = -i*12`). `unidad = i % 4` reparte parejo; `paradero = 1 + Math.floor(i/4) % 3` reparte **independiente de la unidad** (bug 24) y nunca cae en Mina Central ni en el destino (bug 25). |
| `paso()` | Un tick de reloj (2 min). Los pasajeros que aún no declararon y tienen su unidad cerca deciden al azar: 72% espera, 18% se va por sus medios, 10% no viaja. Las unidades avanzan; al llegar a un paradero suben los que estaban esperando **hasta las 16 plazas**, y al que no entra se le marca ausente con línea en la bitácora. |
| `pintar()` | Redibuja KPIs, SVG, tarjetas de unidad, grilla de pasajeros y bitácora. Lee los colores con `getComputedStyle` para que el SVG siga al tema claro/oscuro. |
| `arrancar()` / `pausar()` / `reiniciar()` | Controles. `pausar()` valida `estado &&` porque `reiniciar()` la llama antes de que exista el estado (bug 23). |

Prueba: extraer el `<script>` y correrlo en Node con un shim de DOM
(HANDOFF §8.d). No hay forma de que el CI la cubra.

## Worker de Cloudflare (`worker/`)

| Función | Qué hace |
|---|---|
| `fetch(req, env)` | Punto de entrada. Responde `OPTIONS` en el borde sin despertar a Render. **Red de seguridad**: lo que no empieza con `/api/` pasa de largo al sitio, así una ruta demasiado ancha no se come viczul.com (regla 3). Si el origen falla, 502 con un mensaje que explica el minuto de arranque, en vez de un 1101 de Cloudflare. |
| `reenviar(req, origen)` | **Arregla el BUG 14**: reenvía el body en todo lo que no sea GET/HEAD (`duplex: 'half'`). Fuerza `cache-control: no-store`. |
| `cabecerasSalida(req)` | Filtra las cabeceras de hop y las de Cloudflare. **Descarta `cf-connecting-ip` y `x-forwarded-for` del cliente** y las repone con el valor de Cloudflare: si dejara pasar la del cliente, cualquiera falsearía su IP y esquivaría el rate limit. |

Pruebas: `node worker/probar.mjs` (22 casos, sin desplegar nada).

## Guardianes (`guardianes/`)

Ocho, cero dependencias: basePath · URL del backend · conexiones Prisma ·
deploy Render · export estático · orden de rutas Express · forma de la API ·
socket. Se corren con `node guardianes/guardianes.mjs` y solos en cada push.
