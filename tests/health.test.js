const request = require('supertest');

// Mocks para módulos externos antes de cargar la app
jest.mock('../src/modules/gps/gps.monitor', () => ({
  iniciarMonitor: jest.fn()
}));
jest.mock('../src/config/socket', () => ({
  initSocket: jest.fn(),
  getIo: jest.fn(() => null),
  conductoresActivos: new Map(),
  pasajerosPorRuta: new Map()
}));

const { app } = require('../src/index');

describe('Health check', () => {
  it('GET /health devuelve status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
  });

  it('GET /ruta-inexistente devuelve 404', async () => {
    const res = await request(app).get('/api/ruta-que-no-existe');
    expect(res.status).toBe(404);
  });
});
