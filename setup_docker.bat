@echo off
title Iniciando Bases de Datos
color 0A
echo.
echo ================================================
echo   VERIFICANDO IMAGENES DOCKER DISPONIBLES
echo ================================================
echo.
cd /d C:\Windows\Temp\transporte_backend

echo === Imagenes PostgreSQL disponibles: ===
docker images postgres
echo.
echo === Imagenes Redis disponibles: ===
docker images redis
echo.
echo === Contenedores existentes: ===
docker ps -a --filter "name=transporte_minero"
echo.

echo ================================================
echo   INTENTANDO INICIAR CONTENEDORES EXISTENTES
echo ================================================

REM Intentar iniciar contenedores que ya existan
docker start transporte_minero_db 2>nul && echo OK: transporte_minero_db iniciado || echo INFO: transporte_minero_db no existe aun
docker start transporte_minero_redis 2>nul && echo OK: transporte_minero_redis iniciado || echo INFO: transporte_minero_redis no existe aun

echo.
echo === Creando contenedores si no existen (sin descargar) ===

REM Crear con imagen local solo si existe
docker run -d ^
    --name transporte_minero_db ^
    --pull=never ^
    -e POSTGRES_USER=postgres ^
    -e POSTGRES_PASSWORD=postgres ^
    -e POSTGRES_DB=transporte_minero ^
    -p 5432:5432 ^
    --restart unless-stopped ^
    postgres:15-alpine 2>&1

docker run -d ^
    --name transporte_minero_redis ^
    --pull=never ^
    -p 6379:6379 ^
    --restart unless-stopped ^
    redis:7-alpine 2>&1

echo.
echo === Estado final de contenedores: ===
docker ps --filter "name=transporte_minero" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo Esperando 10 segundos para que PostgreSQL arranque...
timeout /t 10 /nobreak

echo.
echo === Ejecutando migraciones Prisma ===
cd /d C:\Windows\Temp\transporte_backend
call npx prisma migrate deploy 2>&1

echo.
echo === Cargando seed (datos iniciales) ===
node prisma/seed.js 2>&1

echo.
echo ================================================
echo   PROCESO COMPLETADO - Revisa los mensajes arriba
echo ================================================
pause
