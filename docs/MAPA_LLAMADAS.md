# MAPA DE LLAMADAS — TransporteMina
Quién llama a quién. Generado el 2026-08-30 sobre `main`.

## Cadena completa

```
Navegador (viczul.com/transporte)
   │
   ├── CF Worker "transporte-proxy"  ── /api → Render   ⚠️ NO reenvía body en POST (BUG 14)
   │                                     La app NO lo usa: llama a Render directo.
   ▼
https://transporte-mina.onrender.com/api/...
   │  helmet → cors → express.json → router del módulo
   │  authMiddleware (JWT) → requireRol(...)
   ▼
*.routes.js  ──llama──►  *.service.js  ──Prisma──►  Supabase (pooler 6543)
   │
   └── getIo()?.emit(...)  ──►  Socket.io  ──►  salas: "supervisores" | "ruta:<id>"
```

## Endpoints por consumidor

### 🚌 Panel conductor (`/transporte/conductor/`)
| Llama a | Endpoint | Auth |
|---|---|---|
| cargar ejecución | `GET /api/rutas/activas` | JWT — filtra por `conductorId` en el cliente |
| lista de pasajeros | `GET /api/pasajeros/estados-hoy/{rutaId}` | JWT |
| checkins ya hechos | `GET /api/checkin/{ejecucionId}` | JWT |
| enviar GPS (cada ~4 s) | `POST /api/gps/coordenada` | CONDUCTOR |
| marcar subida | `POST /api/checkin` | CONDUCTOR |
| terminar / incidencia | `POST /api/rutas/{id}/finalizar` · `/incidencia` | CONDUCTOR |

### 🧍 Panel pasajero (`/transporte/pasajero/`)
| Llama a | Endpoint | Auth |
|---|---|---|
| todo el panel | `GET /api/pasajeros/mi-perfil` | PASAJERO |
| posición del bus | `GET /api/gps/ultima/{ejecucionId}` | JWT |
| declarar estado | `POST /api/pasajeros/estado` | PASAJERO |
| "estoy en el paradero" | `POST /api/pasajeros/en-paradero` | PASAJERO |
| corregir su domicilio | `PATCH /api/pasajeros/mi-domicilio` | PASAJERO |

### 📝 Registro público (`/transporte/registro/`)
| Llama a | Endpoint | Auth |
|---|---|---|
| llenar los paraderos | `GET /api/rutas/publicas` | **ninguna** (es a propósito) |
| crear la cuenta | `POST /api/auth/registro-pasajero` | **ninguna** |

### 🖥️ Panel admin (`lib/api.ts`, 29 funciones)
`/auth/login` · `/reportes/dashboard|diario|semanal|diario/excel` · `/rutas` (+`/activas`, `/historial`, `/{id}/iniciar`, `/{id}/finalizar`) · `/conductores` · `/vehiculos` · `/pasajeros` (+`/pendientes`, `/{id}/aprobar`, `/estados-hoy/{rutaId}`) · `/checkin/{id}` (+`/resumen`) · `/alertas/emergencia` · `/gps/ultima/{id}`

## Endpoints sin nadie que los llame

Existen en el backend, ninguna pantalla los usa. No son bugs; son cosas a medio terminar:

| Endpoint | Qué significa |
|---|---|
| `POST /api/auth/cambiar-password` | **Falta la pantalla.** Hoy nadie puede cambiar su contraseña: todos siguen con la que les diste. |
| `POST /api/auth/fcm-token` | Las push de Firebase están en modo DEMO (solo `console.log`). |
| `GET /api/auth/me` | El front confía en el `usuario` guardado en localStorage. Si cambiás un rol en la base, la sesión vieja no se entera. |
| `POST /api/checkin/paradero` | Subida por lote (todo un paradero de una). El conductor marca de a uno. |
| `GET /api/gps/historial/{id}` | El recorrido completo. El mapa solo pinta la última posición. |
| `POST /api/alertas/inicio-ruta` | Aviso masivo al arrancar. Se dispara solo desde `iniciarRuta`. |

## Socket.io — quién escucha qué

| Evento | Lo emite | Lo escucha |
|---|---|---|
| `supervisor:gps-update` | `POST /gps/coordenada` | sala `supervisores` (mapa del admin) |
| `ruta:posicion` | `POST /gps/coordenada` | sala `ruta:<id>` (panel pasajero) |
| `pasajero:estado-cambiado` | `declararEstado` | `supervisores` |
| `pasajero:en-paradero` | `marcarEnParadero` | sala de la ejecución (conductor) |
