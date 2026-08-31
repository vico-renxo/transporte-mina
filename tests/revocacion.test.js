// Revocar sesiones al cambiar la contrasena.
// No necesita base: se mockea @prisma/client antes de cargar el service.

const HASHES = { u1: '$2b$10$AAAAAAAAAAAAAAAAAAAAAAcontrasenaVIEJA' };
let lecturas = 0;

jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    usuario = {
      findUnique: async ({ where }) => {
        lecturas++;
        const password = HASHES[where.id];
        return password ? { password, activo: true } : null;
      },
    };
  },
}));

const { huellaDe, huellaSigueValida, olvidarHuella } = require('../src/modules/auth/auth.service');

beforeEach(() => { lecturas = 0; olvidarHuella('u1'); HASHES.u1 = '$2b$10$AAAAAAAAAAAAAAAAAAAAAAcontrasenaVIEJA'; });

describe('revocacion por huella del hash', () => {
  test('un token con la huella actual sigue valido', async () => {
    const token = huellaDe(HASHES.u1);
    expect(await huellaSigueValida('u1', token)).toBe(true);
  });

  test('al cambiar la contrasena, el token viejo deja de valer', async () => {
    const tokenViejo = huellaDe(HASHES.u1);
    HASHES.u1 = '$2b$10$BBBBBBBBBBBBBBBBBBBBBBcontrasenaNUEVA';
    olvidarHuella('u1');                       // lo hace cambiarPassword
    expect(await huellaSigueValida('u1', tokenViejo)).toBe(false);
    // y el token nuevo si vale
    expect(await huellaSigueValida('u1', huellaDe(HASHES.u1))).toBe(true);
  });

  test('el cache evita una lectura por request', async () => {
    const token = huellaDe(HASHES.u1);
    await huellaSigueValida('u1', token);
    await huellaSigueValida('u1', token);
    await huellaSigueValida('u1', token);
    expect(lecturas).toBe(1);
  });

  test('un token sin huella (emitido antes del cambio) se acepta', async () => {
    // Si no, el deploy echaria a todos los que ya estaban logueados.
    expect(await huellaSigueValida('u1', undefined)).toBe(true);
    expect(lecturas).toBe(0);
  });

  test('un usuario inexistente o inactivo no pasa', async () => {
    expect(await huellaSigueValida('noexiste', 'loquesea')).toBe(false);
  });
});
