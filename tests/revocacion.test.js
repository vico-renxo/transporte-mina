// Revocar sesiones al cambiar la contrasena.
// No necesita base: se mockea @prisma/client antes de cargar el service.
//
// OJO con jest.mock: su factory no puede referenciar variables de afuera,
// salvo que empiecen con "mock". Por eso mockHashes y mockLecturas.

const mockHashes = { u1: '$2b$10$AAAAAAAAAAAAAAAAAAAAAAcontrasenaVIEJA' };
const mockEstado = { lecturas: 0 };

jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    usuario = {
      findUnique: async ({ where }) => {
        mockEstado.lecturas++;
        const password = mockHashes[where.id];
        return password ? { password, activo: true } : null;
      },
    };
  },
}));

const { huellaDe, huellaSigueValida, olvidarHuella } = require('../src/modules/auth/auth.service');

beforeEach(() => {
  mockEstado.lecturas = 0;
  olvidarHuella('u1');
  mockHashes.u1 = '$2b$10$AAAAAAAAAAAAAAAAAAAAAAcontrasenaVIEJA';
});

describe('revocacion por huella del hash', () => {
  test('un token con la huella actual sigue valido', async () => {
    expect(await huellaSigueValida('u1', huellaDe(mockHashes.u1))).toBe(true);
  });

  test('al cambiar la contrasena, el token viejo deja de valer', async () => {
    const tokenViejo = huellaDe(mockHashes.u1);
    mockHashes.u1 = '$2b$10$BBBBBBBBBBBBBBBBBBBBBBcontrasenaNUEVA';
    olvidarHuella('u1');                       // lo hace cambiarPassword
    expect(await huellaSigueValida('u1', tokenViejo)).toBe(false);
    expect(await huellaSigueValida('u1', huellaDe(mockHashes.u1))).toBe(true);
  });

  test('el cache evita una lectura por request', async () => {
    const t = huellaDe(mockHashes.u1);
    await huellaSigueValida('u1', t);
    await huellaSigueValida('u1', t);
    await huellaSigueValida('u1', t);
    expect(mockEstado.lecturas).toBe(1);
  });

  test('un token sin huella (emitido antes del cambio) se acepta', async () => {
    // Si no, el deploy echaria a todos los que ya estaban logueados.
    expect(await huellaSigueValida('u1', undefined)).toBe(true);
    expect(mockEstado.lecturas).toBe(0);
  });

  test('un usuario inexistente no pasa', async () => {
    expect(await huellaSigueValida('noexiste', 'loquesea')).toBe(false);
  });
});
