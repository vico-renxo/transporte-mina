# RONDA 3 — Modalidad de recojo + edición de domicilio (estado)

## QUÉ ESTÁ LISTO (código escrito y verificado por SHA, en esta carpeta)
1. **Registro con 2 modalidades** (`web/src/app/registro/page.tsx`):
   🏠 En mi domicilio (GPS o dirección manual) | 🚏 En un paradero (dropdowns de ruta y paradero, cargados del endpoint público nuevo).
2. **Endpoint público** `GET /api/rutas/publicas` (sin login, solo nombres/orden de paraderos) — `rutas.routes.js` + `rutas.service.js`.
3. **Preferencia de paradero**: si el pasajero elige paradero al registrarse, se guarda (`paraderoId` pendiente) y el admin lo ve preseleccionado con badge "🚏 ELEGIDO POR ÉL" en el modal, y "🚏 X (eligió)" en azul en la tabla.
4. **Pasajero actualiza su domicilio**: nueva tarjeta "Mi domicilio → 📍 Actualizar mi ubicación (GPS)" en su panel + endpoint `PATCH /api/pasajeros/mi-domicilio`.
5. **Admin edita aprobados**: botón "✎ Editar" en cada fila aprobada → mismo modal → "Guardar cambios" (reasigna ruta/paradero). Resuelve "no puedo editarlo".
6. **Pendientes ahora incluyen paradero/ruta** en la API (antes no venían).

Sin cambios de BD (la preferencia usa columnas existentes). Los 9 archivos pasaron verificación de integridad (git hash-object == blob SHA en GitHub).

## QUÉ FALTA
El **commit final**. GitHub activó un límite de velocidad (tarpit) por la ráfaga de subidas de hoy y está colgando TODA petición a api.github.com desde esta IP. Los 9 blobs YA están subidos a GitHub; solo falta crear tree+commit+ref (3 llamadas). La cadena quedó lanzada en el navegador y puede completarse sola.

## CÓMO COMPLETARLO (cuando GitHub descongele, ~15-60 min)
Opción A: pedirle a Claude "reintenta el commit de la ronda 3".
Opción B (manual): los archivos de esta carpeta espejan el repo — súbelos con el editor web de GitHub.

## NOTA
- El sitio en producción sigue estable en el commit 53f02d1 (todo lo de las rondas 1 y 2 funcionando).
- Sobre "algunos con mapa y otros sin mapa" en la columna Domicilio: es normal — los que se registraron ANTES de la función GPS no tienen coordenadas. Con esta ronda, ellos mismos podrán actualizarla desde su panel.
