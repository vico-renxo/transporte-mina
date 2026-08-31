@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Probar todo - TransporteMina

echo.
echo  ============================================================
echo     PROBAR TODO  -  TransporteMina
echo  ============================================================
echo.
echo   Instala dependencias y corre TODO lo que se puede correr:
echo     1. Guardianes            (rapido, sin dependencias)
echo     2. Pruebas del Worker    (rapido, sin dependencias)
echo     3. npm install           (la primera vez tarda unos minutos)
echo     4. Tests de Jest         (backend)
echo     5. Typecheck de TypeScript (la web)
echo.
echo   No toca nada de produccion. Solo lee y prueba.
echo.
pause

where node >nul 2>&1 || goto :nonode

echo.
echo  ---------- 1. Guardianes ----------
node guardianes\guardianes.mjs
set G=%errorlevel%

echo.
echo  ---------- 2. Worker ----------
node worker\probar.mjs
set W=%errorlevel%

echo.
echo  ---------- 3. Dependencias del backend ----------
if not exist "node_modules" (
  echo   Instalando... paciencia.
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :errorinstall
) else ( echo   Ya estaban. )

echo.
echo  ---------- 4. Tests de Jest ----------
call npm test
set T=%errorlevel%

echo.
echo  ---------- 5. Dependencias de la web ----------
pushd web
if not exist "node_modules" (
  echo   Instalando... paciencia.
  call npm install --no-audit --no-fund
  if errorlevel 1 ( popd & goto :errorinstall )
) else ( echo   Ya estaban. )

echo.
echo  ---------- 6. Typecheck ----------
echo   (next.config.js tiene ignoreBuildErrors:true, asi que un error de
echo    tipos NO rompe el deploy: se convierte en un bug silencioso. Por
echo    eso conviene mirarlo aca.)
call npx --yes tsc --noEmit
set TS=%errorlevel%
popd

echo.
echo  ============================================================
echo     RESUMEN
echo  ============================================================
if "%G%"=="0"  (echo   Guardianes ........ OK) else (echo   Guardianes ........ FALLA)
if "%W%"=="0"  (echo   Worker ............ OK) else (echo   Worker ............ FALLA)
if "%T%"=="0"  (echo   Tests Jest ........ OK) else (echo   Tests Jest ........ FALLA)
if "%TS%"=="0" (echo   Typecheck ......... OK) else (echo   Typecheck ......... hay errores)
echo.
echo   Copiame este resumen al chat, sobre todo si algo dice FALLA
echo   o si el typecheck tiene errores: con eso puedo sacar el
echo   ignoreBuildErrors sin riesgo de romperte el deploy.
goto :fin

:errorinstall
echo.
echo   Fallo npm install. Lo mas comun: sin internet, o npm no esta en el PATH.
goto :fin
:nonode
echo  ERROR: node no esta en el PATH.
goto :fin
:fin
echo.
pause
endlocal
