@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Subir cambios - TransporteMina

echo.
echo  ============================================================
echo     SUBIR CAMBIOS  -  TransporteMina
echo  ============================================================
echo.

if not exist ".git" goto :norepo
where git  >nul 2>&1 || goto :nogit
where node >nul 2>&1 || goto :nonode

REM ---------------- 1. Que hay para subir ----------------
git fetch origin main >nul 2>&1

set "HAYCAMBIOS="
for /f "delims=" %%i in ('git status --porcelain') do set "HAYCAMBIOS=1"

set "ADELANTE=0"
for /f %%i in ('git rev-list --count origin/main..main 2^>nul') do set "ADELANTE=%%i"

if not defined HAYCAMBIOS if "%ADELANTE%"=="0" goto :nadaquesubir

if defined HAYCAMBIOS (
  echo  --- Archivos modificados ------------------------------------
  git status --short
  echo.
)
if not "%ADELANTE%"=="0" (
  echo  --- Commits ya hechos que faltan subir: %ADELANTE%
  git --no-pager log --oneline origin/main..main
  echo.
)

REM ---------------- 2. GUARDIANES (bloquean) ----------------
echo  ============================================================
echo     Revisando el codigo antes de subir...
echo  ============================================================
node guardianes\guardianes.mjs
if errorlevel 1 goto :guardianesrojo
echo.

REM ---------------- 3. Commit ----------------
if defined HAYCAMBIOS (
  set "MSG="
  set /p "MSG=  Describi en una linea que cambiaste: "
  if "!MSG!"=="" set "MSG=Cambios varios"
  git add -A
  git commit -m "!MSG!"
  if errorlevel 1 goto :errorcommit
  echo.
)

REM ---------------- 4. Aviso Supabase ----------------
set "TOCOBD="
for /f "delims=" %%i in ('git diff --name-only origin/main..main -- prisma 2^>nul') do set "TOCOBD=1"
if defined TOCOBD (
  echo  ************************************************************
  echo   OJO: tocaste algo dentro de prisma/
  echo.
  echo   Las migraciones NO se aplican solas. Regla 6 del HANDOFF:
  echo   el pooler 6543 de Supabase no soporta los locks de migrate.
  echo.
  echo   Despues de subir, corre el SQL a mano en:
  echo     Supabase - SQL Editor - proyecto midimdsudblhonhhqwlv
  echo  ************************************************************
  echo.
  set /p "SIGO=  Entendido? Enter para seguir, o CTRL+C para cortar: "
  echo.
)

REM ---------------- 5. Push ----------------
echo  Subiendo a GitHub...
git push origin main
if errorlevel 1 goto :errorpush

echo.
echo  ============================================================
echo     LISTO. Subido a GitHub.
echo  ============================================================
echo.
echo   Ahora, solos y sin que hagas nada:
echo     - GitHub Actions vuelve a correr los guardianes
echo     - Render redeploya el backend    (~2-4 min, y arranca dormido)
echo     - Vercel y Cloudflare Pages redeployan la web
echo.
echo   Supabase NO se toca sola: la base solo cambia si vos corres
echo   el SQL a mano en el editor de Supabase.
echo.
echo   FALTA LO IMPORTANTE: probar la app de verdad.
echo   Los guardianes leen el codigo, no comprueban que la app ande.
echo     https://viczul.com/transporte
echo.
set /p "VERCI=  Abro la pagina de Actions para ver el chequeo? (s/n): "
if /i "!VERCI!"=="s" start "" "https://github.com/vico-renxo/transporte-mina/actions"
goto :fin

REM ================= ERRORES =================
:guardianesrojo
echo.
echo  ############################################################
echo   NO SE SUBIO NADA.
echo.
echo   Un guardian esta en rojo. Cada uno vigila un accidente que
echo   ya rompio esta app antes, asi que esto es a proposito.
echo.
echo   Arriba dice cual fallo y como arreglarlo. Arreglalo y volve
echo   a correr este mismo archivo.
echo  ############################################################
goto :fin

:errorpush
echo.
echo  ERROR al subir a GitHub.
echo.
echo   Lo mas comun:
echo     - Sin internet.
echo     - Credenciales vencidas: te va a pedir usuario y token.
echo     - Alguien mas subio antes. Proba:  git pull --rebase origin main
echo.
echo   Tu commit NO se perdio: quedo guardado local. Reintenta cuando puedas.
goto :fin

:errorcommit
echo.
echo  ERROR al hacer el commit. No se subio nada.
goto :fin

:nadaquesubir
echo   No hay nada para subir: todo lo local ya esta en GitHub.
goto :fin

:norepo
echo  ERROR: esta carpeta no es el repo (no encuentro .git).
echo  Este archivo tiene que vivir en D:\TransporteMina-app
goto :fin

:nogit
echo  ERROR: git no esta instalado o no esta en el PATH.
goto :fin

:nonode
echo  ERROR: node no esta instalado o no esta en el PATH.
echo  Node hace falta para correr los guardianes.
goto :fin

:fin
echo.
pause
endlocal
