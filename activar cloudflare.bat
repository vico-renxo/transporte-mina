@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Activar Cloudflare - TransporteMina

echo.
echo  ============================================================
echo     ACTIVAR CLOUDFLARE DELANTE DE LA API
echo  ============================================================
echo.
echo   Esto enruta viczul.com/api/*  ->  el Worker  ->  Render.
echo.
echo   Hoy tu API va directo a Render, sin pasar por Cloudflare:
echo   el WAF, el rate limit del borde y las analiticas no la tocan.
echo   Esto lo cambia.
echo.
echo   ANTES DE SEGUIR, tenes que haber puesto en Render:
echo       CONFIAR_EN_CLOUDFLARE = 1
echo.
echo   Si no la pusiste, CORTA ACA (Ctrl+C) y ponela primero.
echo   Sin esa variable, detras del Worker todos tus usuarios cuentan
echo   como una sola persona y el primero que haga 10 logins bloquea
echo   a todos los demas.
echo.
pause

where node >nul 2>&1 || goto :nonode
if not exist "worker\index.js" goto :nowork

echo.
echo  ---------- 1. Pruebas del Worker ----------
node worker\probar.mjs
if errorlevel 1 goto :pruebasrojas

echo.
echo  ---------- 2. Desplegando CON la ruta ----------
call npx --yes wrangler deploy -c worker\wrangler.toml
if errorlevel 1 goto :errordeploy

echo.
echo  ---------- 3. Esperando 15s a que propague ----------
timeout /t 15 /nobreak >nul

echo.
echo  ---------- 4. Probando viczul.com/api ----------
echo   (tiene que decir "Credenciales invalidas": eso prueba que el
echo    body viajo. Si dijera "Email y password requeridos", el body
echo    se perdio y NO hay que seguir.)
echo.
curl -s -X POST "https://viczul.com/api/auth/login" -H "content-type: application/json" -d "{\"email\":\"prueba@noexiste.local\",\"password\":\"x\"}"
echo.
echo.
echo   Y esto tiene que seguir mostrando tu web normal:
curl -s -o nul -w "   viczul.com/transporte/login/ -> HTTP %%{http_code}\n" "https://viczul.com/transporte/login/"

echo.
echo  ============================================================
echo     LISTO. Copiame lo de arriba al chat.
echo  ============================================================
echo.
echo   Si vino "Credenciales invalidas" y la web dio 200, el ultimo
echo   paso es apuntar la app a viczul.com. Eso lo preparo yo y lo
echo   subis con "subir cambios.bat".
echo.
echo   NO cambies nada mas todavia.
goto :fin

:pruebasrojas
echo.
echo  ############################################################
echo   NO SE DESPLEGO NADA: las pruebas del Worker fallaron.
echo  ############################################################
goto :fin
:errordeploy
echo.
echo   Fallo el deploy. Copiame el error.
echo   Si dice algo de la zona viczul.com, avisame: puede ser que la
echo   ruta choque con el Worker viejo "transporte-proxy".
goto :fin
:nonode
echo  ERROR: node no esta en el PATH.
goto :fin
:nowork
echo  ERROR: este archivo va en D:\TransporteMina-app
goto :fin
:fin
echo.
pause
endlocal
