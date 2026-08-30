-- ════════════════════════════════════════════════════════════════
-- Revocar sesiones al cambiar la contrasena
--
-- Hoy los JWT duran 7 dias y no hay forma de invalidarlos: cambiar la
-- contrasena no echa a una sesion abierta en otro telefono. Esta
-- columna arregla eso: el token lleva la version con la que se firmo,
-- y al cambiar la contrasena la version sube, dejando fuera a todos
-- los tokens viejos de una.
--
-- CORRER ESTO A MANO en el SQL Editor de Supabase (regla 6: el pooler
-- 6543 no soporta los locks de `prisma migrate`).
--
-- ORDEN IMPORTANTE:
--   1. correr este SQL
--   2. recien despues subir el codigo que usa la columna
-- Al reves, Prisma pide una columna que no existe y la API responde 500.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
