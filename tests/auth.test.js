const request = require('supertest');

jest.mock('../src/modules/gps/gps.monitor', () => ({ iniciarMonitor: jest.fn() }));
jest.mock('../src/config/socket', () => ({
  initSocket: jest.fn(),
  getIo: jest.fn(() => null),
  conductoresActivos: new Map(),
  pasajerosPorRuta: new Map()
}));

const { app } = require('../src/index');

describe('Auth endpoints', () => {
  it('POST /api/auth/login sin body devuelve 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login con credenciales inexistentes devuelve 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: 'wrong123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it('GET /api/auth/me sin token devuelve 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
