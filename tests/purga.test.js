// El filtro de purgar-pruebas.js NO debe poder tocar un usuario real.
//
// Esto es lo unico que importa de ese script: borrar no tiene deshacer.
// Se prueba el predicado contra emails que un LIKE '%prueba%' habria
// borrado por error.

const PREFIJO = 'zz-prueba-';
const DOMINIO = '@prueba.local';
const esDePrueba = email => email.startsWith(PREFIJO) && email.endsWith(DOMINIO);

describe('filtro de purga', () => {
  test('acepta los que crea el seed', () => {
    expect(esDePrueba('zz-prueba-pas01@prueba.local')).toBe(true);
    expect(esDePrueba('zz-prueba-cond04@prueba.local')).toBe(true);
  });

  test.each([
    ['admin@empresa.com',              'el admin real'],
    ['pasajero1@empresa.com',          'un pasajero del seed viejo'],
    ['prueba@empresa.com',             'dice prueba pero es real'],
    ['juan.prueba@gmail.com',          'apellido parecido'],
    ['zz-prueba-pas01@empresa.com',    'prefijo correcto, dominio REAL'],
    ['otro@prueba.local',              'dominio correcto, prefijo ajeno'],
    ['zz-prueba@prueba.local',         'sin el guion del prefijo'],
    ['x@prueba.local.empresa.com',     'dominio embebido, no final'],
    ['ZZ-PRUEBA-pas01@prueba.local',   'mayusculas'],
  ])('NO borra %s (%s)', (email) => {
    expect(esDePrueba(email)).toBe(false);
  });

  test('un LIKE ingenuo si los habria borrado (por eso no se usa)', () => {
    const ingenuo = e => e.includes('prueba');
    expect(ingenuo('juan.prueba@gmail.com')).toBe(true);   // victima
    expect(esDePrueba('juan.prueba@gmail.com')).toBe(false); // salvado
  });
});
