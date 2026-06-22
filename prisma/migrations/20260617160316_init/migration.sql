-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'SUPERVISOR', 'GERENCIA', 'CONDUCTOR', 'PASAJERO');

-- CreateEnum
CREATE TYPE "EstadoPasajeroTurno" AS ENUM ('NORMAL', 'POR_MIS_MEDIOS', 'AUSENTE');

-- CreateEnum
CREATE TYPE "EstadoRuta" AS ENUM ('PENDIENTE', 'EN_RUTA', 'COMPLETADA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "EstadoVehiculo" AS ENUM ('ACTIVO', 'INACTIVO', 'MANTENIMIENTO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "fcmToken" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conductor" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "licencia" TEXT NOT NULL,
    "telefono" TEXT,

    CONSTRAINT "Conductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT NOT NULL DEFAULT '',
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL DEFAULT 2020,
    "capacidad" INTEGER NOT NULL DEFAULT 20,
    "estado" "EstadoVehiculo" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT '',
    "destino" TEXT NOT NULL DEFAULT '',
    "horaInicio" TEXT NOT NULL,
    "dias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paradero" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lng" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "Paradero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pasajero" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rutaId" TEXT,
    "paraderoId" TEXT,
    "tiempoAlertaMin" INTEGER NOT NULL DEFAULT 5,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pasajero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaEjecucion" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "conductorId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoRuta" NOT NULL DEFAULT 'PENDIENTE',
    "iniciadaEn" TIMESTAMP(3),
    "finalizadaEn" TIMESTAMP(3),

    CONSTRAINT "RutaEjecucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coordenada" (
    "id" TEXT NOT NULL,
    "rutaEjecucionId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "velocidad" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coordenada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstadoTurno" (
    "id" TEXT NOT NULL,
    "pasajeroId" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPasajeroTurno" NOT NULL DEFAULT 'NORMAL',
    "declaradoEn" TIMESTAMP(3),

    CONSTRAINT "EstadoTurno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkin" (
    "id" TEXT NOT NULL,
    "rutaEjecucionId" TEXT NOT NULL,
    "paraderoId" TEXT NOT NULL,
    "pasajeroId" TEXT NOT NULL,
    "subio" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calificacion" (
    "id" TEXT NOT NULL,
    "rutaEjecucionId" TEXT NOT NULL,
    "pasajeroId" TEXT NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Conductor_usuarioId_key" ON "Conductor"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_placa_key" ON "Vehiculo"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "Pasajero_usuarioId_key" ON "Pasajero"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "EstadoTurno_pasajeroId_rutaId_fecha_key" ON "EstadoTurno"("pasajeroId", "rutaId", "fecha");

-- AddForeignKey
ALTER TABLE "Conductor" ADD CONSTRAINT "Conductor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paradero" ADD CONSTRAINT "Paradero_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasajero" ADD CONSTRAINT "Pasajero_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasajero" ADD CONSTRAINT "Pasajero_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasajero" ADD CONSTRAINT "Pasajero_paraderoId_fkey" FOREIGN KEY ("paraderoId") REFERENCES "Paradero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaEjecucion" ADD CONSTRAINT "RutaEjecucion_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaEjecucion" ADD CONSTRAINT "RutaEjecucion_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaEjecucion" ADD CONSTRAINT "RutaEjecucion_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coordenada" ADD CONSTRAINT "Coordenada_rutaEjecucionId_fkey" FOREIGN KEY ("rutaEjecucionId") REFERENCES "RutaEjecucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstadoTurno" ADD CONSTRAINT "EstadoTurno_pasajeroId_fkey" FOREIGN KEY ("pasajeroId") REFERENCES "Pasajero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_rutaEjecucionId_fkey" FOREIGN KEY ("rutaEjecucionId") REFERENCES "RutaEjecucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_paraderoId_fkey" FOREIGN KEY ("paraderoId") REFERENCES "Paradero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_pasajeroId_fkey" FOREIGN KEY ("pasajeroId") REFERENCES "Pasajero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_rutaEjecucionId_fkey" FOREIGN KEY ("rutaEjecucionId") REFERENCES "RutaEjecucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_pasajeroId_fkey" FOREIGN KEY ("pasajeroId") REFERENCES "Pasajero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
