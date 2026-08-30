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
14. **Latente, sin corregir:** el CF Worker no reenvía el body en POST. No molesta porque la app llama a Render directo. Si algún día enrutás por `/api` del Worker, esto explota primero.

## 6. Cómo se sube código (importante)

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

`guardianes/` — seis scripts Node sin dependencias, cada uno vigila un
accidente real. Se corren con:

```bash
node guardianes/guardianes.mjs
```

y solos en cada push vía `.github/workflows/guardianes.yml`.

**El verde no prueba que la app funcione.** Miran el código, no la verdad de
la pantalla. Probá la app igual.

## 8. Estado actual y pendientes

✅ Funcionando y verificado en producción: login unificado, registro con
modalidad domicilio/paradero, aprobación con paradero más cercano por
distancia, edición de asignación por el admin, actualización de ubicación por
el propio pasajero, GPS del conductor en vivo, mapa, reportes.

Pendientes conocidos:
- [ ] Fix A: `package.json` → `"build": "prisma generate"` (hoy incluye `migrate deploy`, contra la regla 6).
- [ ] Fix B: sacar la consulta Prisma de `gps.routes.js` al service, con caché.
- [ ] Pantalla para cambiar contraseña (el endpoint existe hace rato).
- [ ] Unificar `startOfDay` y `distKm` duplicadas (ver MAPA_DUPLICADOS.md).
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
