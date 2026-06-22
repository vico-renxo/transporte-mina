const { alertasService } = require('../src/modules/alertas/alertas.service');

// Mock de servicios externos
jest.mock('../src/modules/alertas/google-maps.service', () => ({
  calcularETA: jest.fn().mockResolvedValue({
    duracionSegundos: 240, duracionTexto: '4 min',
    distanciaMetros: 1200, distanciaTexto: '1.2 km'
  }),
  calcularETAMultiples: jest.fn().mockResolvedValue([])
}));

jest.mock('../src/modules/alertas/fcm.service', () => ({
  enviarPush: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
  enviarPushMultiple: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0 })
}));

jest.mock('../src/modules/alertas/sms.service', () => ({
  enviarSMS: jest.fn().mockResolvedValue({ sid: 'mock-sid' })
}));

describe('Alertas Service', () => {
  it('verificarProximidad con ID inexistente no lanza error', async () => {
    await expect(
      alertasService.verificarProximidad('id-inexistente', -12.04, -77.04)
    ).resolves.not.toThrow();
  });

  it('enviarAlertaEmergencia con ID inexistente no lanza error', async () => {
    await expect(
      alertasService.enviarAlertaEmergencia('id-inexistente', 'Test')
    ).resolves.not.toThrow();
  });
});
