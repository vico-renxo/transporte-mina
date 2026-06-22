@echo off
title Instalando Panel Web
color 0A
echo.
echo Instalando dependencias del Panel Web...
echo Esto puede tardar 2-3 minutos, espera...
echo.
cd /d C:\Windows\Temp\transporte_backend\web
npm install
echo.
echo ================================================
echo  INSTALACION COMPLETADA
echo  Ahora ejecuta INICIAR_SISTEMA.bat del Escritorio
echo ================================================
pause
