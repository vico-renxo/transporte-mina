# Cómo arrancar un chat nuevo con todo el contexto de TransporteMina

Ningún chat recuerda al anterior. Lo único que sobrevive es lo que quede
escrito en el repo. Este documento es la puerta de entrada.

---

## La frase

Conectá la carpeta del proyecto al chat nuevo y escribí:

```
Trabajo en TransporteMina, mi sistema de transporte de personal minero.
Te conecté la carpeta del proyecto.

Antes de tocar nada leé, en este orden:
  1. CLAUDE.md              (raíz)  → stack, URLs, config de cada servicio
  2. docs/HANDOFF.md                → estado, reglas absolutas, bugs 1-25, pendientes
  3. docs/MAPA_FUNCIONES.md         → qué hace cada función
  4. docs/MAPA_LLAMADAS.md          → qué pantalla llama a qué endpoint

Después decime qué entendiste, sobre todo las reglas absolutas del §3 del
HANDOFF, y esperá instrucciones.

Lo que quiero hacer hoy: [ESCRIBÍ ACÁ LO QUE NECESITÁS]
```

Con eso alcanza para el 90% de los casos. Los otros documentos se leen
solo si el tema lo pide (están listados abajo).

**Ojo**: hay que **conectar la carpeta** al chat. Un chat sin la carpeta
conectada no ve ninguno de estos archivos, por más que se los nombres.
La carpeta es `D:\TransporteMina-app`.

---

## Qué hay en cada documento

| Documento | Para qué | ¿Leerlo siempre? |
|---|---|---|
| `CLAUDE.md` (raíz) | Stack, URLs de cada servicio, config de Cloudflare Pages, cómo correr los tests | **Sí** |
| `docs/HANDOFF.md` | El documento principal. Estado, arquitectura, **reglas absolutas**, bugs 1-25, guardianes, pendientes, cómo se verifica | **Sí** |
| `docs/MAPA_FUNCIONES.md` | Qué hace cada función del backend y del frontend | **Sí** |
| `docs/MAPA_LLAMADAS.md` | Qué pantalla llama a qué endpoint, y qué endpoints no llama nadie | **Sí** |
| `docs/MAPA_DUPLICADOS.md` | Qué lógica estuvo escrita dos veces y cómo se unificó | Si vas a refactorizar |
| `docs/REVISION_GUARDIANES.md` | Por qué existe cada guardián y cuál se retiró | Si tocás guardianes |
| `docs/CAMBIOS_DETALLADOS.md` | Changelog por sesión (julio, agosto, flota) | Si querés historia |
| `docs/RESUMEN_CAMBIOS.md` | Snapshot de la sesión de julio. **Obsoleto**, tiene banner que lo aclara | Casi nunca |
| `docs/RONDA3_ESTADO.md` | Registro histórico | Casi nunca |

Y el código que también es documentación:

- `guardianes/` — los 8 chequeos que bloquean la subida cuando vuelve un bug viejo
- `worker/` — el proxy de Cloudflare, con `probar.mjs` (22 casos, no despliega nada)
- `prisma/schema.prisma` — los 11 modelos de la base

---

## Los .bat (doble clic, no hace falta terminal)

| Archivo | Qué hace |
|---|---|
| `subir cambios.bat` | Sube a GitHub. Dispara Render y Cloudflare Pages. **Es el método actual.** |
| `probar todo.bat` | Guardianes + worker + typecheck + tests |
| `desplegar worker.bat` | Despliega el CF Worker (`transporte-api`) |
| `activar cloudflare.bat` | Config de Cloudflare |
| `INICIAR_SISTEMA.bat` | Levanta todo en local |

---

## Lo que NO está en los documentos (y no puede estar)

Esto es lo importante de saber: hay cosas que **viven fuera del repo**, así
que ningún chat las va a saber leyendo estos archivos. Si el problema es de
acá, hay que entrar al panel correspondiente:

- **Variables del dashboard de Cloudflare Pages.** `process.env` le gana al
  `.env.production` del repo. Una variable cargada ahí, invisible desde el
  código, es exactamente lo que rompió la app un día entero. Si algo no
  coincide entre lo que dice el repo y lo que hace la app en vivo,
  **mirá el dashboard primero**.
- **Variables de entorno de Render** (JWT_SECRET, DATABASE_URL, etc.).
- **Credenciales de Supabase** y cualquier contraseña. No están versionadas
  y no deben estarlo.
- **UptimeRobot**: sin confirmar si existe el monitor. Ver la nota en
  `CLAUDE.md`.
- **Rutas de los Workers en el dashboard de Cloudflare**, en particular las
  dos de `transporte-proxy`. Ese Worker **no se borra**: tiene la ruta
  `viczul.com/transporte*`, que es la que sirve la app.

---

## Regla de oro

Cada vez que se arregle un bug o se cambie una regla, se actualiza
`docs/HANDOFF.md` **en el mismo commit**. Si no está escrito ahí, la próxima
sesión no lo sabe y lo va a romper de nuevo.

Y una advertencia que ya costó cara: **los guardianes, el CI y los
dashboards pueden estar todos en verde mientras la app está rota.** La única
verificación que vale es hacer que la app haga la llamada y mirar a dónde
va. Ver §8.b y §8.d del HANDOFF.
