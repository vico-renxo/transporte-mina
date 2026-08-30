@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Desplegar Worker - TransporteMina

echo.
echo  ============================================================
echo     DESPLEGAR EL WORKER  -  TransporteMina
echo  ============================================================
echo.
echo   Esto sube worker\index.js a Cloudflare con el nombre
echo   "transporte-api".
echo.
echo   NO toca viczul.com. La ruta esta comentada en wrangler.toml
echo   a proposito: primero se prueba en una URL .workers.dev.
echo.
echo   Tampoco toca el Worker viejo "transporte-proxy": este tiene
echo   nombre distinto.
echo.

where node >nul 2>&1 || goto :nonode
if not exist "worker\index.js" goto :nowork
if not exist "wrangler.toml" goto :noconf

echo  ---------- 1. Probando el Worker aca, antes de subirlo ----------
node worker\probar.mjs
if errorlevel 1 goto :pruebasrojas
echo.

echo  ---------- 2. Tu cuenta de Cloudflare ----------
call npx --yes wrangler whoami
if errorlevel 1 (
  echo.
  echo   No hay sesion. Se va a abrir el navegador para que autorices.
  echo   Es tu cuenta: la autorizacion la das vos.
  echo.
  pause
  call npx --yes wrangler login
  if errorlevel 1 goto :errorlogin
)
echo.

echo  ---------- 3. Desplegando ----------
call npx --yes wrangler deploy
if errorlevel 1 goto :errordeploy

echo.
echo  ============================================================
echo     DESPLEGADO.
echo  ============================================================
echo.
echo   Arriba dice la URL, algo como:
echo     https://transporte-api.TU-SUBDOMINIO.workers.dev
echo.
echo   COPIAME ESA URL Y PEGAMELA EN EL CHAT.
echo   Con eso pruebo yo que el body viaje bien (el BUG 14) y que
echo   /transporte no se rompa, antes de tocar viczul.com.
echo.
echo   No cambies nada mas todavia.
echo.
goto :fin

:pruebasrojas
echo.
echo  ############################################################
echo   NO SE SUBIO NADA: las pruebas del Worker fallaron.
echo   Contame que dice arriba.
echo  ############################################################
goto :fin

:errorlogin
echo.
echo   No se pudo autorizar. Reintenta, o avisame que dice.
goto :fin

:errordeploy
echo.
echo   Fallo el deploy. Lo mas comun:
echo     - La cuenta no tiene Workers habilitado.
echo     - Hay varias cuentas: wrangler pregunta cual, elegi la de viczul.com
echo     - Sin internet.
echo   Copiame el error y lo vemos.
goto :fin

:nonode
echo  ERROR: node no esta instalado o no esta en el PATH.
goto :fin
:nowork
echo  ERROR: no encuentro worker\index.js. Este archivo va en D:\TransporteMina-app
goto :fin
:noconf
echo  ERROR: no encuentro wrangler.toml.
goto :fin

:fin
echo.
pause
endlocal
