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
| Web | Cloudflare Pages (Vercel ya no participa: sus URLs dan 404) | Next.js 14, `output: 'export'`, `basePath: '/transporte'` |
| URL pública | https://viczul.com/transporte | entra por `/transporte/login/` |
| Backend | Render (free) `transporte-mina.onrender.com` | Express + Socket.io + Prisma; servicio `srv-d8soacr6sc1c7393ke60` |
| Base | Supabase proyecto `midimdsudblhonhhqwlv` | PostgreSQL, pooler `aws-1-sa-east-1` puerto **6543** |
| Proxy | CF Worker **`transporte-api`** (repo: `worker/`, `wrangler.toml`) | Ruta `viczul.com/api/*` → Render. **La app SÍ lo usa** desde el 2026-08-30. El viejo `transporte-proxy` **NO SE BORRA**: tiene la ruta `viczul.com/transporte*`, que es la que sirve la app. Ver §8. |

**Render duerme a los 15 min sin tráfico**: el primer request tarda ~1 minuto.
Hay una tarea programada que la despierta cada mañana 5:50 y de paso mantiene
viva Supabase (que se pausa a los 7 días sin uso).

## 3. Reglas absolutas (romperlas ya rompió la app)

> **Regla 9, agregada el 2026-08-30:** `NEXT_PUBLIC_API_URL` está escrito en
> **dos lugares**, y el del dashboard le gana al del repo. Cloudflare Pages
> tiene una variable de build con ese nombre, y en Next.js `process.env`
> siempre pisa a `.env.production`. Cambiar sólo `web/.env.production` no
> hace nada: el build sale verde, despliega, y la app sigue apuntando a
> donde decía el dashboard. Tardó una hora en encontrarse porque **todo se
> ve bien**: commit correcto, CI verde, build Success, sitio funcionando.
>
> Al tocar esa URL hay que cambiar **los dos** —o mejor, borrar la variable
> del dashboard y dejar el repo como única fuente— y después **volver a
> construir**: cambiar la variable no redespliega sola.
>
> **Y hay una segunda mitad, peor:** mover esa URL rompió el WebSocket. El
> panel del conductor y el del pasajero abrían el socket con la MISMA
> constante de la API (`io(API)`, `io(BASE)`), así que se fueron a
> viczul.com — donde el Worker enruta sólo `/api/*` y `/socket.io/` da 404.
> El GPS en vivo se congela sin mostrar ningún error. Ahora cada pantalla
> tiene su `SOCKET` aparte y lo vigila `verificar-socket`.
>
> Cómo verificarlo de verdad: no alcanza con leer el bundle. Hay que hacer
> que la app haga una llamada y mirar a qué host le pega.


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

> ⚠️ **RIESGO ABIERTO (2026-08-31): estas credenciales están publicadas.**
> `prisma/seed.js` está versionado en un repo **público** y contiene las
> contraseñas en texto plano. `https://viczul.com/transporte/login/` es
> alcanzable desde cualquier parte de internet. Si ese seed se corrió alguna
> vez contra la base de producción, **cualquiera que encuentre el repo entra
> como ADMIN**. Ver §4.b.

| Rol | Email | Password |
|---|---|---|
| Admin | admin@empresa.com | admin123 |
| Supervisor | supervisor@empresa.com | super123 |
| Conductor | conductor1@empresa.com | cond123 |
| Pasajero | pasajero1@empresa.com | pas123 |
| Pasajero | pasajero2@empresa.com | pas123 |

Esta tabla decía antes `conductor@empresa.com` y `pasajero@empresa.com`, las dos
con `admin123`. **No coincidía con `prisma/seed.js`**, que es quien las crea.
Corregido contra el código el 2026-08-31.

Un solo formulario de login para los tres: enruta por el campo `rol` que
devuelve el backend. Los pasajeros nuevos se registran solos en
`/transporte/registro/` y quedan **pendientes** hasta que el admin los aprueba
y les asigna paradero.

⚠️ No existe pantalla para cambiar contraseña (el endpoint sí existe).

## 4.b Usuarios de prueba (crear y purgar)

Para simular con gente de verdad en la base, sin ensuciarla para siempre:

    node prisma/seed-pruebas.js            # 12 pasajeros y 4 conductores
    node prisma/seed-pruebas.js 30 4       # 30 pasajeros y 4 conductores

    node prisma/purgar-pruebas.js          # muestra qué borraría, NO borra
    node prisma/purgar-pruebas.js --borrar # borra de verdad

Necesitan `DATABASE_URL` en el entorno o en un `.env` en la raíz. Se saca del
panel de Render (variables de entorno del servicio) o de Supabase. **Ese `.env`
no se versiona nunca.**

Tres cosas que hacen que esto sea seguro, y conviene no deshacerlas:

1. **Marca exacta, no un `LIKE`.** Todo lo creado lleva el prefijo
   `zz-prueba-` y el dominio `@prueba.local` (dominio reservado, no existe).
   El purgador exige **las dos cosas**. Un `LIKE '%prueba%'` habría borrado a
   un usuario real llamado `juan.prueba@gmail.com`; hay un test que lo
   demuestra (`tests/purga.test.js`, 11 casos).
2. **Contraseñas al azar en cada corrida**, nunca escritas en el código. El
   repo es público: una contraseña en un archivo versionado queda publicada
   para siempre. Se guardan en `credenciales-prueba.local.txt`, ignorado por
   git.
3. **El purgador arranca en simulacro.** Muestra la lista y se detiene. Hay
   que pasarle `--borrar` a propósito.

**Orden de borrado**: el schema **no tiene `onDelete: Cascade` en ninguna
relación**. Borrar un `Usuario` con checkins lo rechaza Postgres por clave
foránea. Por eso el purgador va de las hojas a la raíz: coordenadas →
calificaciones → checkins → estados de turno → ejecuciones → pasajero /
conductor → usuario. Y por eso mismo la app **da de baja** pasajeros en vez de
borrarlos (`cambiarActivoPasajero`).

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

23. `simulacion-flota.html` moría al cargar: `reiniciar()` llamaba a `pausar()`, y `pausar()` leía `estado.terminado` cuando `estado` todavía era `null`. La página se veía en blanco. Ahora `pausar()` valida `estado &&`.
24. En esa misma simulación, `unidad` y `paradero` se calculaban los dos con `i % 4`, así que quedaban acoplados: la unidad V-01 recogía **todos** sus pasajeros en Variante Uchumayo, la V-02 todos en Sachaca, y así. El paradero ahora sale de `Math.floor(i/4)`, independiente de la unidad.
25. Esa simulación asignaba pasajeros al último paradero (Plaza de Armas), que es el **destino**: nadie sube ahí. Ahora los pasajeros solo se asignan a paraderos intermedios.

Los tres se encontraron **antes de publicar**, corriendo la lógica en Node con
un shim de DOM (ver §8.d). Ninguno llegó a producción.

14. ~~Latente~~ **CORREGIDO 2026-08-30** (falta desplegar el Worker): el CF Worker no reenvía el body en POST. No molesta porque la app llama a Render directo. Si algún día enrutás por `/api` del Worker, esto explota primero.

## 6. Cómo se sube código (importante)

**Método actual (desde 2026-08-30): `subir cambios.bat`.**
Doble clic en `D:\TransporteMina-app\subir cambios.bat`. Hace, en orden:

1. Muestra qué cambió.
2. Corre los guardianes. **Si alguno está en rojo, corta y no sube nada.**
3. Pide una descripción y hace el commit.
4. Si tocaste `prisma/`, avisa que la migración hay que correrla a mano.
5. `git push origin main`.

Ese push dispara solo: GitHub Actions (guardianes), Render (backend),
Cloudflare Pages (web). Supabase nunca se toca sola.

### Método viejo (ya no hace falta, queda como registro)

Antes no había clon local y el sandbox no alcanzaba GitHub, así que se subía
con la Git Data API desde el navegador. Lo de abajo aplica sólo si algún día
volvés a quedarte sin clon:


El sandbox donde corre Claude **no alcanza GitHub ni Render**. El método que
funciona: la **Git Data API de GitHub ejecutada desde el navegador** del
usuario (crear blobs → tree con `base_tree` → commit → PATCH del ref). Un
commit = un build en Render + CF Pages.

Dos lecciones caras:
- **Verificar siempre** `git hash-object <archivo>` contra el SHA del blob que
  devuelve GitHub. Una transcripción a mano metió un typo (`domicilioLnf`) que
  solo se vio comparando SHAs.
- GitHub tiene un *tarpit* (rate limit secundario) que **cuelga** los fetch sin
  error. Se sale con fire-and-forget + poll, y abriendo una pestaña nueva para
  forzar conexión fresca.

## 7. Guardianes

`guardianes/` — ocho scripts Node sin dependencias, cada uno vigila un
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
- ~~Cargar conductores y vehículos en la base~~ — **diagnóstico equivocado, ya verificado.** La base nunca estuvo vacía: `Juan Mamani` y `ABA-123 Hiace` estaban ahí desde el seed. Lo que fallaba era el bug 18 (leer `{conductores:[...]}` como array). Con el arreglo desplegado, la simulación corrió entera, creó una `RutaEjecucion` real (`cmtfxim580001122u73mf7i0s`) y la finalizó sola.
- [x] ~~Decidir el huso horario~~ **hecho 2026-08-30: ahora es medianoche de Lima.** Perú es UTC-5 todo el año (sin horario de verano desde 1994), así que alcanza un offset fijo. El bug que arregla: un viaje de vuelta a las 19:30 de Lima se guardaba con fecha de hoy pero al consultarlo caía en la ventana de mañana — el reporte del día no lo mostraba. Nota vieja: Devuelve la medianoche del servidor (Render corre en UTC), no la de Lima: el "día" arranca a las 19:00 hora peruana del día anterior. No se cambió junto con la unificación porque mover la ventana 5 horas altera qué registros de `EstadoTurno` matchean, y eso merece su propia prueba. Está explicado en `src/shared/fechas.js`.
- [x] ~~Borrar `NEXT_PUBLIC_API_URL` del dashboard de Cloudflare~~ hecho 2026-08-30: el repo (`web/.env.production`) es ahora la única fuente. Era el caso de "una regla escrita dos veces" que más caro salió hoy.
- [x] ~~Correr `probar todo.bat`~~ corrido 2026-08-30: guardianes 8/8, worker 22/22, typecheck **0 errores**.
- [x] ~~**Los tests de `alertas` y `auth` fallan por el entorno**~~ **RESUELTO 2026-08-31.**
  Eran **dos** causas distintas del mismo síntoma, según dónde se corrieran:
  (1) falta `.env` con `DATABASE_URL` (el clon no lo trae, y con razón: está en `.gitignore`);
  (2) `node_modules/.prisma/client/` solo contiene `query_engine-windows.dll.node`, así que
  desde Linux Prisma ni llegaba a mirar la URL y pedía `binaryTargets`.

  **Arreglo**: `__mocks__/@prisma/client.js`, un `PrismaClient` sobre arrays en memoria con
  los 11 modelos del schema. Jest lo toma solo, sin que ningún test llame a `jest.mock`,
  porque `@prisma/client` vive en `node_modules`. `revocacion.test.js` conserva su mock
  propio: ese gana dentro de su archivo.

  **Verificado con control negativo**, no con "quedó verde": se saboteó `login()` para que
  dejara de rechazar usuarios inexistentes y `auth.test.js` falló como debía (esperaba 401,
  recibió 200). Un mock que vuelve verde todo no sirve de nada; este vigila.

  Antes: 3 suites fallando, 4 tests rojos de 19. Ahora: **19/19**.

  **Límite**: el mock no valida el schema ni resuelve `include` anidados. Los tests de
  `alertas` solo comprueban que "no explota", que es una prueba débil. Para probar queries
  de verdad hace falta una base de prueba, no un mock más grande.
- [x] ~~Borrar el Worker viejo `transporte-proxy`~~ **NO SE BORRA — la premisa era falsa y peligrosa.**
  Al ir a borrarlo se vio que tiene DOS rutas:
  `viczul.com/transporte*` y `viczul.com/api*`.
  **La primera es la que sirve tu app.** Borrar ese Worker te tumbaba el
  sitio entero. Todo este documento decía que "la app NO lo usa", y eso era
  cierto sólo de la parte `/api`.
  Lo que sí se hizo: sacarle **sólo** la ruta `viczul.com/api*`, que se
  superponía con la del Worker nuevo `transporte-api` (`viczul.com/api/*`).
  Dos Workers peleando por el mismo tráfico, y el viejo es el que pierde el
  body en POST: si la precedencia se hubiera dado vuelta, el login moría sin
  ninguna pista. Verificado después: la web carga y el login sigue yendo por
  `viczul.com/api`.
- [ ] Unificar el `Modal` repetido en conductores/rutas/vehículos (🟡 en MAPA_DUPLICADOS.md).
- [ ] Unificar la carga de Leaflet por CDN (🟡 en MAPA_DUPLICADOS.md).

Salidos de la revisión del 2026-08-30 (ordenados por lo que más duele):

- [x] ~~Cambiar la contraseña no invalida sesiones~~ **hecho 2026-08-30, sin migración.** El token lleva `pv`, una huella del hash de la contraseña; al cambiarla el hash cambia y los tokens viejos mueren. Cuesta una lectura por usuario cada 60s (hay caché) y **falla abierta** a propósito: un hipo de Supabase no deja a un conductor sin panel a mitad de ruta. Nota vieja: Los JWT duran 7 días y no hay lista de revocación: si a alguien le entraron a la cuenta, cambiar la clave no lo echa. Haría falta versionar el token (un campo en `Usuario` que se incremente y que `authMiddleware` compare).
- [x] ~~No hay rate limiting~~ **hecho 2026-08-30**: `src/shared/middleware/rateLimit.js`, sin dependencias, aplicado a `/login` (10 cada 10 min), `/registro-pasajero` (5 por hora) y `/cambiar-password` (5 cada 15 min). 7 pruebas propias en `tests/rateLimit.test.js`. Nota vieja: `POST /auth/login` y `POST /auth/cambiar-password` se pueden martillar sin límite, y el segundo confirma si la contraseña actual es correcta (400 "Contraseña actual incorrecta"): es un oráculo. `express-rate-limit` en `src/index.js` alcanza.
- [x] ~~`ignoreBuildErrors`~~ **sacado 2026-08-30, con evidencia**: `tsc --noEmit` sobre todo `web/src` da CERO errores. `eslint.ignoreDuringBuilds` se deja a propósito. Nota vieja: Un error de tipos no rompe el deploy: se convierte en un bug de runtime silencioso. Se puso para destrabar un deploy; conviene sacarlo y arreglar lo que aparezca.
- [ ] **No hay `.gitattributes` y el repo mezcla finales de línea.** Los archivos están commiteados con LF y en Windows quedan CRLF; una edición descuidada convierte el archivo entero y produce diffs de cientos de líneas que tapan el cambio real (ya pasó una vez). Contenido sugerido: `* text=auto eol=lf` más `*.bat text eol=crlf`. Aplicarlo renormaliza el repo, así que conviene hacerlo en un commit propio que no toque nada más.

- [ ] **Dar de baja a "Pedro Prueba GPS"** — ahora ya se puede: hay botón "⏻ Dar de baja" en el panel de Pasajeros. Antes era imposible: **no existía ningún endpoint para borrar ni desactivar a nadie**, ni UI para hacerlo. Falta desplegar y apretarlo.

  Se eligió desactivar y NO borrar a propósito: un pasajero tiene checkins,
  estados de turno y calificaciones colgando. Borrarlo obliga a decidir qué
  pasa con ese historial y las claves foráneas lo bloquearían igual.
  Desactivar es reversible y no pierde nada — y con la revocación por huella
  agregada hoy, además le cierra las sesiones abiertas en el próximo request.
- [x] ~~Aprobar a Victor Renzo~~ **ya estaba aprobado** (Ruta 1, paradero Hunter). Verificado en el panel: 0 pendientes.

## 8.b Cómo se verificó lo del 2026-08-30

Para que la próxima sesión no repita el trabajo ni confíe de más:

- **Tipos.** No hay `node_modules` ni salida a red en la máquina, y el proxy
  de npm bloquea el registro entero. Se corrió `tsc` igual, con el TypeScript
  del contenedor y shims propios de React/Next que conservan los genéricos.
  `web/src/lib/geo.ts`: cero errores. Cero errores de asignabilidad o de
  estrechamiento de nulos en todo el árbol. Los tres usos reales de `distKm`
  se probaron aislados bajo `strict`, con dos controles negativos: sacar la
  guarda de nulo da `TS2322`, y llamar con la firma vieja de 4 números da
  `TS2554`. El verde no es un falso verde.
- **Pantalla de contraseña**, en producción: con dos sesiones abiertas a la
  vez, `?de=pasajero` eligió al pasajero (es exactamente el bug que se estaba
  arreglando); las cuatro validaciones muestran su mensaje y bloquean el
  botón; un token inválido devuelve 401 y redirige al login.
- **Simulación**, en producción: de 43 ids duplicados a 0, de 6 mapas a 3,
  cero errores de consola, y `POST /rutas/:id/iniciar` ya no devuelve 400.
- **Lo que sigue sin probarse: los tests de Jest.** Necesitan `npm install`.

## 8.c Cloudflare: lo que se está desaprovechando

**Medido el 2026-08-30 con las cabeceras de respuesta:**

| | ¿Pasa por Cloudflare? |
|---|---|
| La web (viczul.com) | sí — `cf-ray`, `server: cloudflare` |
| **La API (onrender.com)** | **no** — sin `cf-ray` |

El navegador llama a Render **directo**. Todo lo que da Cloudflare —WAF,
rate limiting de borde, bot management, caché, analíticas, ocultar el
origen— se aplica sólo a HTML y JS estático, que no tiene ni un secreto.
Los logins, los tokens y los datos viajan por fuera.

### El arreglo, ya escrito

`worker/index.js` + `wrangler.toml` ponen `viczul.com/api/*` delante de
Render. De paso arreglan el BUG 14 (el Worker viejo no reenviaba el body en
POST, por eso la app no lo usaba). 22 pruebas en `worker/probar.mjs`,
ejecutables sin desplegar: `node worker/probar.mjs`.

El Worker ahora vive **en el repo**, no en el dashboard. Eso es lo que hace
cumplible la regla 4: se despliega con `npx wrangler deploy` y queda
historial, revisión y vuelta atrás.

### Estado: pasos 1 y 2 HECHOS (2026-08-30)

El Worker está desplegado y verificado contra producción:

    https://transporte-api.victorcaracela.workers.dev

| Comprobación | Resultado |
|---|---|
| **BUG 14** — `POST /api/auth/login` por el Worker | `401 Credenciales inválidas`, igual que directo a Render. Si el body no viajara, sería `400 "Email y password requeridos"`. Esa diferencia es la prueba. |
| Sobrecosto de latencia | ~135 ms (mediana 1395 vs 1260 ms, 4 muestras). Baja cuando esté en el mismo dominio. |
| `cache-control` | `no-store`, puesto por el Worker |
| Red de seguridad de ruta | `/transporte/login/` por el Worker devuelve el 404 de Cloudflare, **no** se reenvía a Render. Sin bucles. |

Se desplegó con nombre **`transporte-api`**, distinto del viejo
`transporte-proxy`, que sigue intacto. Borrar el viejo recién cuando el
nuevo esté enrutado y andando.

### TERMINADO — 2026-08-30

Los cinco pasos están hechos y verificados contra producción:

| # | Paso | Verificación |
|---|---|---|
| 1 | Worker desplegado | `transporte-api`, 22 pruebas verdes |
| 2 | Probado en `.workers.dev` | BUG 14 cerrado con evidencia |
| 3 | `CONFIAR_EN_CLOUDFLARE=1` en Render | leído del dashboard; las otras 5 variables intactas |
| 4 | Ruta `viczul.com/api/*` activa | `wrangler` la reporta; `/rutas/publicas`, `/auth/login` y el 404 responden igual que directo |
| 5 | App apuntando a `https://viczul.com` | este commit |

`NEXT_PUBLIC_SOCKET_URL` sigue en Render **a propósito**, y ahora hay un
guardián que impide moverlo: el Worker enruta sólo `/api/*`, así que un
socket apuntando a viczul.com daría 404 y el mapa en vivo se congelaría sin
mostrar ningún error.

Para volver atrás si algo apareciera: poner `NEXT_PUBLIC_API_URL` de vuelta
en `https://transporte-mina.onrender.com` y subir. El Worker puede quedar
desplegado sin molestar a nadie.

### Lo que falta (en este orden, no al revés)

~~1. `npx wrangler deploy`~~ hecho. Se corre con `desplegar worker.bat`.
~~2. Probarlo~~ hecho, ver la tabla de arriba. Lo que sigue: `POST https://viczul.com/api/auth/login`. Si devuelve lo
   mismo que Render, el body viaja bien.
3. Poner en Render la variable `CONFIAR_EN_CLOUDFLARE=1`. **Sin esto el rate
   limit seguiría contando por `req.ip`, que detrás del Worker es el de
   Cloudflare: todos los usuarios contarían como uno solo.** Y al revés,
   ponerla ANTES de que el Worker esté enrutando deja el límite evadible,
   porque la cabecera la escribiría el cliente.
4. Recién ahí cambiar `web/.env.production`:
   `NEXT_PUBLIC_API_URL=https://viczul.com`
   **`NEXT_PUBLIC_SOCKET_URL` NO se toca**: el WebSocket de Socket.io sigue
   yendo directo a Render a propósito.
5. Subir. Si algo sale mal, volver el `.env.production` a Render y ya está.

### Lo que se desbloquea recién después del paso 3

- **Rate limiting y WAF en el borde**: los intentos ni llegan a Render.
- **Ocultar el origen**: hoy `transporte-mina.onrender.com` es público y
  cualquiera lo golpea salteándose Cloudflare.
- **Analíticas reales de la API**, no sólo de la web.
- **Caché de las respuestas GET que no cambian** (rutas, paraderos), que
  además tapa el arranque de Render en las lecturas.

### Lo que Cloudflare NO te va a arreglar

El minuto de arranque de Render en el primer POST. Eso es del plan free de
Render, no de Cloudflare. Se arregla pagando Render, o migrando el backend a
Workers — pero eso último es reescribir Socket.io con Durable Objects y
Prisma con un driver HTTP: proyecto aparte, no un ajuste.

## 8.d Cómo se prueba una página suelta sin navegador

`web/public/simulacion-flota.html` es una página autocontenida: HTML, CSS y JS
en un solo archivo, sin build. No pasa por `npm run build`, así que **ningún
guardián ni el CI la miran**. Un error de JS ahí no lo detecta nadie.

El método que sí la prueba, y que encontró los bugs 23, 24 y 25:

1. Se extrae el bloque `<script>` del HTML con un split.
2. Se arma un shim mínimo de DOM: `document.getElementById` devuelve objetos
   con `innerHTML` / `textContent` / `value` escribibles, `getComputedStyle`
   devuelve un color fijo, `setInterval` no hace nada.
3. Se corre la simulación entera en un `while` hasta que cierra el turno, para
   10, 20, 30 y 48 pasajeros, varias veces (hay azar de por medio).
4. Se afirman invariantes, no apariencia:
   - la suma de los cinco estados es igual al total de pasajeros;
   - ninguna unidad supera las 16 plazas;
   - nadie queda en estado `espera` al cerrar el turno;
   - las 4 unidades llegan al final de la ruta;
   - nadie está asignado al paradero 0 ni al último.

La regla general, que ya vale para todo el proyecto: **una aserción sobre el
comportamiento vale más que mirar la pantalla**. Mirar la pantalla no habría
mostrado el bug 24 — se veía perfecto, solo que mal.

### Restricción de los artifacts

Una página publicada como artifact **no puede cargar Leaflet ni los mosaicos de
OpenStreetMap**: la CSP solo admite scripts de cdnjs y hojas de estilo de
Google Fonts; imágenes y `fetch` externos están bloqueados. Por eso el
recorrido de `simulacion-flota.html` está dibujado en SVG, proyectando las
coordenadas reales de los paraderos a un `viewBox`, en vez de sobre un mapa.
`simulacion.html`, que se sirve desde `viczul.com/transporte/`, sí usa Leaflet
porque ahí no rige esa CSP. No unificar las dos a la ligera.

## 9. Documentos hermanos

| Archivo | Para qué |
|---|---|
| `MAPA_FUNCIONES.md` | Qué hace cada función (sin números de línea, se desactualizan — usar `grep`) |
| `MAPA_LLAMADAS.md` | Qué pantalla llama a qué endpoint, y qué endpoints no llama nadie |
| `MAPA_DUPLICADOS.md` | Qué está escrito dos veces y cuál conviene unificar |
| `REVISION_GUARDIANES.md` | La auditoría del 2026-08-30 y cómo se probó cada guardián |
| `CAMBIOS_DETALLADOS.md` | Changelog de todas las sesiones: julio (bugs 11-14), la noche del 2026-08-30 (bugs 15-22) y la simulación de flota del 2026-08-31 |

Desde 2026-08-30 esta documentación vive en `docs/` dentro del repo, y los
guardianes en `guardianes/`, corriendo solos en cada push vía GitHub Actions.
