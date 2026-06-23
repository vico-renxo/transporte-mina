require('dotenv').config();

// Prevenir crashes por errores no capturados
process.on('uncaughtException', (err) => {
  console.error('â ï¸  uncaughtException (no fatal):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('â ï¸  unhandledRejection (no fatal):', reason?.message || reason);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const { initSocket } = require('./config/socket');
const errorHandler = require('./shared/middleware/errorHandler');

// MÃ³dulos
const authRoutes = require('./modules/auth/auth.routes');
const rutasRoutes = require('./modules/rutas/rutas.routes');
const pasajerosRoutes = require('./modules/pasajeros/pasajeros.routes');
const gpsRoutes = require('./modules/gps/gps.routes');
const checkinRoutes = require('./modules/checkin/checkin.routes');
const reportesRoutes = require('./modules/reportes/reportes.routes');
const alertasRoutes    = require('./modules/alertas/alertas.routes');
const conductoresRoutes= require('./modules/conductores/conductores.routes');
const vehiculosRoutes  = require('./modules/vehiculos/vehiculos.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (process.env.FRONTEND_URL || '*').split(','),
    methods: ['GET', 'POST']
  }
});

// Middlewares globales
app.use(helmet());
app.use(cors({ origin: (process.env.FRONTEND_URL || '*').split(',') }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/rutas', rutasRoutes);
app.use('/api/pasajeros', pasajerosRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/alertas',    alertasRoutes);
app.use('/api/conductores',conductoresRoutes);
app.use('/api/vehiculos',  vehiculosRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// Error handler
app.use(errorHandler);

// WebSocket
initSocket(io);

// Monitor GPS (verifica seÃ±al cada 60 seg)
const { iniciarMonitor } = require('./modules/gps/gps.monitor');
iniciarMonitor(io);

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`â Servidor corriendo en http://localhost:${PORT}`);
    console.log(`ð¡ WebSocket activo`);
  });
}

module.exports = { app, server, io };
