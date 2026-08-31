# MAPA DE DUPLICADOS — TransporteMina
Generado el 2026-08-30. Detección: nombres definidos en 2+ archivos + bloques
de 6 líneas idénticas (normalizando espacios) entre archivos distintos.

## Ranking: qué conviene unificar y qué no

> **Estado al 2026-08-30:** los puntos 1, 2 y 3 están resueltos. Quedan
> abiertos el 4 (Modal), el 5 (Leaflet) y el 6 (cerrarSesion, opcional).

### ✅ 1. Dos puertas para la misma habitación — `iniciarRuta` — RESUELTO 2026-08-30

`src/modules/rutas/rutas.routes.js` tenía `POST /:id/iniciar` y `POST /iniciar`
declaradas por separado, cada una con su propia lista de roles y su propio
handler que armaba el mismo llamado a `iniciarRuta`. Mismo service, dos
rutas, dos juegos de permisos que había que acordarse de mantener iguales —
la familia de bug más cara: el día que alguien sumara un rol a una y se
olvidara de la otra, el agujero quedaba abierto sin que nadie lo notara.

Ahora `ROLES_INICIAR` y `handlerIniciar` existen una sola vez y se montan en
los dos paths (`router.post('/:id/iniciar', ...)` y `router.post('/iniciar',
...)`), así que divergir se volvió imposible. El path sin `:id` se conserva
por si algún cliente afuera de este repo lo usa; el front del panel solo usa
`/:id/iniciar`.

### ✅ 2. `startOfDay()` copiada en dos servicios — RESUELTO 2026-08-30

`alertas.service.js` y `pasajeros.service.js` tenían cada uno su propia copia
de `startOfDay()`. Idénticas en ese momento, pero el día que una tuviera en
cuenta el huso horario de Perú y la otra no, los estados del día y las
alertas iban a discrepar sin que nadie lo notara. Ahora ambas hacen
`require('../../shared/fechas')` y usan la única definición de
`src/shared/fechas.js` (junto con `rutas.service.js` y `reportes.service.js`,
que también la consumen de ahí).

### ✅ 3. `distKm` / Haversine — dos implementaciones — RESUELTO 2026-08-30

- `web/src/app/(app)/pasajeros/page.tsx:27` — `distKm(a, b)` con objetos
- `web/src/app/pasajero/page.tsx:25` — `distKm(lat1, lng1, lat2, lng2)` + `deg2rad`

Misma fórmula, firmas distintas. Con esto el admin decide qué paradero está
"más cerca" del domicilio. **Recomendación:** una sola en `web/src/lib/geo.ts`.

### 🟡 4. `Modal` copiado en tres pantallas del admin

`(app)/conductores`, `(app)/rutas`, `(app)/vehiculos` — el bloque del overlay
y los botones son idénticos línea por línea. **Recomendación:**
`web/src/components/Modal.tsx`. Es la duplicación más grande en cantidad de
líneas, pero la menos peligrosa: si una queda distinta, se ve.

### 🟡 5. Carga de Leaflet por CDN, dos veces

`(app)/mapa/page.tsx` y `pasajero/page.tsx` crean el `<link>` del CSS y el
`<script>` a mano. Si cambia la versión en un lado y no en el otro, un mapa se
ve distinto al otro. **Recomendación:** `web/src/lib/leaflet.ts` con la carga
y la versión en una sola constante.

### 🟢 6. `cerrarSesion` en conductor y pasajero

Casi iguales, pero borran claves distintas (`tm_conductor_*` vs
`tm_pasajero_*`). Unificar con un parámetro es opcional; hoy no hace daño.

### ⚪ 7. Falsos positivos — NO tocar

`crearRuta`, `aprobarPasajero`, `finalizarRuta`, `crearVehiculo`… aparecen en
el backend y otra vez en `lib/api.ts` o en las pantallas. **No es
duplicación**: uno es la operación y el otro es quien la llama por HTTP. Que
se llamen igual es una virtud, no un problema.

## Duplicación estructural (no de código): las 3 sesiones

| Panel | Dónde guarda la sesión |
|---|---|
| admin | Zustand, clave `tm-auth` |
| conductor | `localStorage: tm_conductor_token` / `tm_conductor_user` |
| pasajero | `localStorage: tm_pasajero_token` / `tm_pasajero_user` |

Tres mecanismos para lo mismo. Funciona (permite tener admin y conductor
abiertos a la vez en el mismo navegador, útil para probar), pero cada arreglo
de "sesión expirada" hay que hacerlo tres veces — ya pasó. Si algún día se
unifica, que sea a propósito y de una sola vez.

## Lo que NO está duplicado (revisado)

- Ningún endpoint declarado dos veces con la misma ruta y método.
- Ninguna consulta Prisma repetida entre servicios.
- El `authFetch` del conductor existe una sola vez.
