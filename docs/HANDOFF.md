# HANDOFF — TransporteMina
Estado al 2026-08-30. Escrito para que otra sesión (o vos dentro de seis
meses) pueda seguir sin preguntar nada. Si algo de acá deja de ser cierto,
corregilo acá mismo: este archivo es la memoria del proyecto.

---

## 1. Qué es

Sistema de transporte de personal minero. Dueño: VICO (Arequipa, Perú).
Tres paneles sobre una sola app: **supervisor/admin**, **conductor**,
**pasajero**. Todo en planes gratuitos, costo real S/ 0.00.

## 2. Dónde vive cada cosa

| Pieza | Dónde | Detalle |
|---|---|---|
| Código | GitHub `vico-renxo/transporte-mina`, rama `main` | público |
| Web | Cloudflare Pages + Vercel | Next.js 14, `output: 'export'`, `basePath: '/transporte'` |
| URL pública | https://viczul.com/transporte | entra por `/transporte/login/` |
| Backend | Render (free) `transporte-mina.onrender.com` | Express + Socket.io + Prisma; servicio `srv-d8soacr6sc1c7393ke60` |
| Base | Supabase proyecto `midimdsudblhonhhqwlv` | PostgreSQL, pooler `aws-1-sa-east-1` puerto **6543** |
| Proxy | CF Worker `transporte-proxy` en viczul.com | ⚠️ no reenvía body en POST (BUG 14). La app NO lo usa. |

**Render duerme a los 15 min sin tráfico**: el primer request tarda ~1 minuto.
Hay una tarea programada que la despierta cada mañana 5:50 y de paso mantiene
viva Supabase (que se pausa a los 7 días sin uso).

## 3. Reglas absolutas (romperlas ya rompió la app)

1. **NUNCA** enlaces absolutos sin basePath: es `/transporte/login/`, no `/login`.
2. **NUNCA** hardcodear `localhost:3001`: usar `process.env.NEXT_PUBLIC_API_URL`.
3. **NUNCA** crear `web/functions/`: CF Pages la toma como Worker y se come el sitio.
4. **NUNCA** editar el Worker desde el dashboard de Cloudflare.
5. **NUNCA** tocar viczul.com ni viczul.com/adecco.
6. **NUNCA** `prisma migrate` en el build de Render (el pooler no soporta los locks). Las migraciones se aplican a mano en el SQL editor de Supabase.
7. **SIEMPRE** Supabase host `aws-1`, puerto `6543`, con `?pgbouncer=true`.
8. **SIEMPRE** un solo `PrismaClient` por módulo, arriba del archivo, nunca dentro de un handler.

Los guardianes (§7) vigilan las reglas 1, 2, 3, 6 y 8 automáticamente.

## 4. Credenciales demo

| Rol | Email | Password |
|---|---|---|
| Admin/supervisor | admin@empresa.com | admin123 |
| Conductor | conductor@empresa.com | admin123 |
| Pasajero | pasajero@empresa.com | admin123 |

Un solo formulario de login para los tres: enruta por el campo `rol` que
devuelve el backend. Los pasajeros nuevos se registran solos en
`/transporte/registro/` y quedan **pendientes** hasta que el admin los aprueba
y les asigna paradero.

⚠️ No existe pantalla para cambiar contraseña (el endpoint sí existe).

## 5. Bugs históricos ya corregidos

1–10: los de tu documentación original.
11. El login no devolvía `conductorId` / `pasajeroId` → el conductor veía la ruta de otro.
12. `api.ts` llamaba a una ruta inexistente de estados-hoy.
13. `new PrismaClient()` por request en `pasajeros.routes.js` → fuga de conexiones.
15. `package.json` corria `prisma migrate deploy` en el build de Render, contra la regla 6. Ahora el build es solo `prisma generate`.
16. `new PrismaClient()` en `gps.routes.js` (una conexion por request en el endpoint mas caliente del sistema). La consulta se movio a `gps.service.js` como `obtenerInfoEjecucion()`, con cache de 5 min: nombre de ruta, conductor y placa no cambian durante la ejecucion, asi que ya no se consulta la base en cada ping GPS.
17. `web/public/simulacion.html` tenía la página entera escrita **dos veces**; la primera copia estaba truncada a la mitad de una función, así que ese `<script>` moría con `Unexpected token '<'`. En producción se veían 43 ids duplicados, 6 mapas en vez de 3 y la mitad de abajo congelada. Se borró la copia truncada (655 → 346 líneas).
18. La simulación hacía `if(r.length)` sobre `/api/conductores` y `/api/vehiculos`, pero esos endpoints devuelven `{ conductores: [...] }` y `{ vehiculos: [...] }`, no un array pelado como `/api/rutas`. Fallaba **en silencio**: conductor y vehículo quedaban en "—" y `POST /rutas/:id/iniciar` devolvía 400, así que la simulación nunca creaba una `RutaEjecucion` real. Ahora usa `r.conductores || r` (igual que el panel web) y loguea error si la lista viene vacía.

⚠️ **Ojo con esto**: la API no es uniforme. `/api/rutas` devuelve un array;
`/api/conductores` y `/api/vehiculos` devuelven un objeto que lo envuelve.
Cualquier consumidor nuevo tiene que usar `d.conductores || d`.

19. `startOfDay()` estaba copiada en `alertas.service.js` y `pasajeros.service.js`. Unificada en `src/shared/fechas.js`.
20. `distKm` (Haversine) tenía dos implementaciones con firmas distintas — y con esa cuenta el admin decide qué paradero le queda más cerca a un pasajero. Unificada en `web/src/lib/geo.ts`, una sola firma.
21. `POST /rutas/:id/iniciar` y `POST /rutas/iniciar` eran dos handlers separados con las mismas roles en distinto orden. Ahora comparten `ROLES_INICIAR` y `handlerIniciar`: divergir se volvió imposible.
22. `POST /auth/cambiar-password` no validaba nada: aceptaba una contraseña de un carácter. Ahora exige 8 y que sea distinta de la actual, del lado del servidor.

14. **Latente, sin corregir:** el CF Worker no reenvía el body en POST. No molesta porque la app llama a Render directo. Si algún día enrutás por `/api` del Worker, esto explota primero.

## 6. Cómo se sube código (importante)

**Método actual (desde 2026-08-30): `subir cambios.bat`.**
Doble clic en `D:\TransporteMina-app\subir cambios.bat`. Hace, en orden:

1. Muestra qué cambió.
2. Corre los guardianes. **Si alguno está en rojo, corta y no sube nada.**
3. Pide una descripción y hace el commit.
4. Si tocaste `prisma/`, avisa que la migración hay que correrla a mano.
5. `git push origin main`.

Ese push dispara solo: GitHub Actions (guardianes), Render (backend),
Vercel y Cloudflare Pages (web). Supabase nunca se toca sola.

### Método viejo (ya no hace falta, queda como registro)

Antes no había clon local y el sandbox no alcanzaba GitHub, así que se subía
con la Git Data API desde el navegador. Lo de abajo aplica sólo si algún día
volvés a quedarte sin clon:


El sandbox donde corre Claude **no alcanza GitHub ni Render**. El método que
funciona: la **Git Data API de GitHub ejecutada desde el navegador** del
usuario (crear blobs → tree con `base_tree` → commit → PATCH del ref). Un
commit = un build en Render + Vercel + CF Pages.

Dos lecciones caras:
- **Verificar siempre** `git hash-object <archivo>` contra el SHA del blob que
  devuelve GitHub. Una transcripción a mano metió un typo (`domicilioLnf`) que
  solo se vio comparando SHAs.
- GitHub tiene un *tarpit* (rate limit secundario) que **cuelga** los fetch sin
  error. Se sale con fire-and-forget + poll, y abriendo una pestaña nueva para
  forzar conexión fresca.

## 7. Guardianes

`guardianes/` — siete scripts Node sin dependencias, cada uno vigila un
accidente real. Se corren con:

```bash
node guardianes/guardianes.mjs
```

y solos en cada push vía `.github/workflows/guardianes.yml`.

**El verde no prueba que la app funcione.** Miran el código, no la verdad de
la pantalla. Probá la app igual.

## 8. Estado actual y pendientes

La ronda 3 **sí llegó a `main`** (commit `c73eb58`): el tarpit de GitHub se
destrabó solo y la cadena de commits se completó. `docs/RONDA3_ESTADO.md`
queda solo como registro histórico.

✅ Funcionando y verificado en producción: login unificado, registro con
modalidad domicilio/paradero, aprobación con paradero más cercano por
distancia, edición de asignación por el admin, actualización de ubicación por
el propio pasajero, GPS del conductor en vivo, mapa, reportes.

Pendientes conocidos:
- [x] ~~Fix A~~ hecho 2026-08-30: el build de Render ya no migra.
- [x] ~~Fix B~~ hecho 2026-08-30: consulta movida al service, con caché de 5 min.
- [x] ~~Pantalla para cambiar contraseña~~ hecha 2026-08-30: `/transporte/cambiar-password/`, sirve para los 3 roles, con acceso desde el sidebar del admin y el header de conductor y pasajero.
- [x] ~~Unificar `startOfDay` y `distKm`~~ hecho 2026-08-30: `src/shared/fechas.js` y `web/src/lib/geo.ts`.
- [ ] **Cargar conductores y vehículos en la base.** Hoy `/api/conductores` y `/api/vehiculos` devuelven vacío, así que ninguna ruta puede iniciarse de verdad (lo destapó correr la simulación en producción).
- [ ] **Decidir el huso horario de `startOfDay()`.** Devuelve la medianoche del servidor (Render corre en UTC), no la de Lima: el "día" arranca a las 19:00 hora peruana del día anterior. No se cambió junto con la unificación porque mover la ventana 5 horas altera qué registros de `EstadoTurno` matchean, y eso merece su propia prueba. Está explicado en `src/shared/fechas.js`.
- [ ] Unificar el `Modal` repetido en conductores/rutas/vehículos (🟡 en MAPA_DUPLICADOS.md).
- [ ] Unificar la carga de Leaflet por CDN (🟡 en MAPA_DUPLICADOS.md).

Salidos de la revisión del 2026-08-30 (ordenados por lo que más duele):

- [ ] **Cambiar la contraseña no invalida las sesiones abiertas en otros dispositivos.** Los JWT duran 7 días y no hay lista de revocación: si a alguien le entraron a la cuenta, cambiar la clave no lo echa. Haría falta versionar el token (un campo en `Usuario` que se incremente y que `authMiddleware` compare).
- [ ] **No hay rate limiting en ningún endpoint.** `POST /auth/login` y `POST /auth/cambiar-password` se pueden martillar sin límite, y el segundo confirma si la contraseña actual es correcta (400 "Contraseña actual incorrecta"): es un oráculo. `express-rate-limit` en `src/index.js` alcanza.
- [ ] **`web/next.config.js` tiene `typescript: { ignoreBuildErrors: true }` y `eslint: { ignoreDuringBuilds: true }`.** Un error de tipos no rompe el deploy: se convierte en un bug de runtime silencioso. Se puso para destrabar un deploy; conviene sacarlo y arreglar lo que aparezca.
- [ ] **No hay `.gitattributes` y el repo mezcla finales de línea.** Los archivos están commiteados con LF y en Windows quedan CRLF; una edición descuidada convierte el archivo entero y produce diffs de cientos de líneas que tapan el cambio real (ya pasó una vez). Contenido sugerido: `* text=auto eol=lf` más `*.bat text eol=crlf`. Aplicarlo renormaliza el repo, así que conviene hacerlo en un commit propio que no toque nada más.

- [ ] Borrar el usuario de prueba "Pedro GPS".
- [ ] Aprobar el registro pendiente de Victor Renzo.

## 9. Documentos hermanos

| Archivo | Para qué |
|---|---|
| `MAPA_FUNCIONES.md` | Qué hace cada función y en qué línea |
| `MAPA_LLAMADAS.md` | Qué pantalla llama a qué endpoint, y qué endpoints no llama nadie |
| `MAPA_DUPLICADOS.md` | Qué está escrito dos veces y cuál conviene unificar |
| `REVISION_GUARDIANES.md` | La auditoría del 2026-08-30 y cómo se probó cada guardián |
| `CAMBIOS_DETALLADOS.md` | Changelog de la sesión de julio (bugs 11-14) |

Desde 2026-08-30 esta documentación vive en `docs/` dentro del repo, y los
guardianes en `guardianes/`, corriendo solos en cada push vía GitHub Actions.
