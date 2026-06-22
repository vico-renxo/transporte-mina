@echo off
title Sistema de Transporte Minero
color 0A
echo.
echo ================================================
echo   INICIANDO SISTEMA DE TRANSPORTE MINERO
echo ================================================
echo.

echo [1/4] Iniciando base de datos...
docker start transporte_minero_db transporte_minero_redis
timeout /t 3 /nobreak >nul
echo     OK - Base de datos activa
echo.

echo [2/4] Iniciando servidor backend (puerto 3001)...
start "BACKEND - No cerrar" cmd /k "cd /d C:\Windows\Temp\transporte_backend && npm run dev"
timeout /t 5 /nobreak >nul
echo     OK - Backend iniciado
echo.

echo [3/4] Iniciando panel web (puerto 3000)...
set WEB=C:\Users\usuario\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions\a5376c0e-8d59-4eb4-a4f1-ccc0a5aa3191\61cd2361-1d70-4f49-a76d-f7e55e6a28c3\local_a971592d-5d09-453d-8f1c-4c56b6695a37\outputs\transporte-minero\apps\web
start "PANEL WEB - No cerrar" cmd /k "cd /d %WEB% && npm run dev"
timeout /t 8 /nobreak >nul
echo     OK - Panel web iniciado
echo.

echo [4/4] Abriendo navegador...
start chrome http://localhost:3000
echo.
echo ================================================
echo   SISTEMA LISTO
echo   Panel: http://localhost:3000
echo   Usuario: admin@empresa.com
echo   Password: admin123
echo ================================================
echo.
echo Mantener las ventanas abiertas mientras usas el sistema.
echo Para apagar: cierra las ventanas de BACKEND y PANEL WEB.
echo.
pause
