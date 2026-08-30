# MAPA DE FUNCIONES — TransporteMina
Generado el 2026-08-30 sobre `main` (56 archivos de código).

## Backend (`src/`)

### Capa de entrada
| Archivo | Función | Qué hace |
|---|---|---|
| `src/index.js` | — | Monta helmet, CORS, los 9 routers, el 404 y el errorHandler. Arranca el monitor GPS. |
| `shared/middleware/auth.js` | `authMiddleware` L3 | Verifica el JWT y pone `req.usuario`. |
| | `requireRol(...roles)` L16 | Corta con 403 si el rol no está en la lista. |
| `shared/middleware/errorHandler.js` | `errorHandler` L1 | Traduce `{status, message}` a JSON. Última red del backend. |
| `config/socket.js` | `initSocket(io)` L8 / `getIo()` L57 | Salas `supervisores` y `ruta:<id>`. `getIo()` se usa con `?.` en todos lados. |

### Módulo auth
| Función | Línea | Qué hace |
|---|---|---|
| `login(email, password)` | 6 | **Corazón del login unificado.** Devuelve `{token, usuario{rol, conductorId, pasajeroId}}`. El front enruta por `rol`. |
| `registrarPasajero({...})` | 48 | Alta pública. Acepta `domicilioLat/Lng`, `direccion` y `paraderoId`. Deja `aprobado=false`. |
| `actualizarFcmToken` | 82 | Sin UI que la llame (ver mapa de llamadas). |
| `cambiarPassword` | 89 | Sin UI que la llame. |

### Módulo rutas
| Función | Línea | Qué hace |
|---|---|---|
| `listarRutas` | 5 | Listado completo para el admin. |
| `listarRutasPublicas` | 34 | **Sin auth.** Solo id/nombre/paraderos, para el registro. |
| `obtenerRuta` / `crearRuta` / `actualizarRuta` | 45/54/79 | CRUD del panel admin. |
| `iniciarRuta({rutaId, conductorId, vehiculoId})` | 84 | Crea la `RutaEjecucion` en estado `EN_RUTA`. |
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
| `gps` | `guardarCoordenada` 4, `obtenerUltimaCoordenada` 10, `obtenerHistorial` 17 | + `obtenerContextoEjecucion` (nueva, con caché) si aplicás el Fix B. |
| `alertas` | `verificarProximidad` 14, `enviarAlertaInicioRuta` 93, `enviarAlertaEmergencia` 176 | Depende de Google Maps y FCM/SMS: hoy en modo DEMO (solo `console.log`). |
| `reportes` | `reporteDiario` 13, `reporteSemanal` 73, `generarExcel` 146 | Excel con exceljs. |
| `conductores` / `vehiculos` | CRUD simple | |

## Frontend (`web/src`)

| Pantalla | Componentes/funciones internas | Sesión que usa |
|---|---|---|
| `app/page.tsx` | `RootPage` L8 | Reparte según sesión guardada. Es el semáforo de entrada. |
| `app/login/page.tsx` | `LoginPage` L13 | **Login unificado**: un solo form, enruta por `rol`. |
| `app/registro/page.tsx` | `RegistroPage` L11 | Modalidad 🏠 domicilio (GPS/manual) o 🚏 paradero. |
| `app/conductor/page.tsx` | `cerrarSesion` 17, `authFetch` 24, `VistaConductor` 50 | `tm_conductor_token` |
| `app/pasajero/page.tsx` | `deg2rad` 24, `distKm` 25, `cerrarSesion` 34, `VistaPasajero` 102 | `tm_pasajero_token` |
| `app/(app)/pasajeros/page.tsx` | `distKm` 27, `PasajerosPage` 34 | Zustand `tm-auth` (admin) |
| `app/(app)/rutas|conductores|vehiculos/page.tsx` | `Modal`, `Form*`, `handleSave`, `cargar` | idem |
| `app/(app)/mapa/page.tsx` | `MapaPage` 11, `buildPopup` 195 | Leaflet cargado a mano por CDN |
| `lib/api.ts` | 29 funciones (`loginApi`, `getRutas`, `aprobarPasajero`…) | Cliente HTTP del panel admin |
