const { guardarCoordenada } = require('../modules/gps/gps.service');

const conductoresActivos = new Map();
const pasajerosPorRuta = new Map();

let _io = null;

function initSocket(io) {
  _io = io;

  io.on('connection', (socket) => {
    // Conductor inicia transmisión GPS
    socket.on('conductor:join', ({ rutaEjecucionId }) => {
      conductoresActivos.set(rutaEjecucionId, socket.id);
      socket.join(`ruta:${rutaEjecucionId}`);
    });

    // Conductor envía posición
    socket.on('conductor:gps', async ({ rutaEjecucionId, lat, lng, velocidad }) => {
      try {
        await guardarCoordenada({ rutaEjecucionId, lat, lng, velocidad });
        io.to(`ruta:${rutaEjecucionId}`).emit('ruta:posicion', {
          lat, lng, velocidad, timestamp: new Date()
        });
        // Verificar proximidad async
        const { alertasService } = require('../modules/alertas/alertas.service');
        alertasService.verificarProximidad(rutaEjecucionId, lat, lng).catch(console.error);
      } catch (err) {
        console.error('GPS error:', err.message);
      }
    });

    // Pasajero se suscribe
    socket.on('pasajero:join', ({ rutaEjecucionId }) => {
      if (!pasajerosPorRuta.has(rutaEjecucionId)) {
        pasajerosPorRuta.set(rutaEjecucionId, new Set());
      }
      pasajerosPorRuta.get(rutaEjecucionId).add(socket.id);
      socket.join(`ruta:${rutaEjecucionId}`);
    });

    // Supervisor se suscribe al panel
    socket.on('supervisor:join', () => {
      socket.join('supervisores');
    });

    socket.on('disconnect', () => {
      conductoresActivos.forEach((socketId, rutaId) => {
        if (socketId === socket.id) conductoresActivos.delete(rutaId);
      });
    });
  });

  return io;
}

function getIo() {
  return _io;
}

module.exports = { initSocket, getIo, conductoresActivos, pasajerosPorRuta };
