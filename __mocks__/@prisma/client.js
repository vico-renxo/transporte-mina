// Mock automatico de @prisma/client para los tests.
//
// Jest usa esta carpeta __mocks__/ sola, sin que ningun test llame a
// jest.mock('@prisma/client'), porque @prisma/client es un modulo de
// node_modules. Ver: https://jestjs.io/docs/manual-mocks
//
// POR QUE EXISTE: sin esto, los suites que cargan la app (auth, health)
// o un service (alertas) intentan levantar Prisma de verdad y fallan por
// el entorno, no por el codigo. Fallaban por DOS motivos distintos segun
// donde se corrieran:
//   - en Windows sin .env: no hay DATABASE_URL;
//   - en Linux: node_modules/.prisma/client solo trae el engine de
//     Windows (query_engine-windows.dll.node), asi que Prisma ni llega a
//     mirar la URL.
// Con este mock los tests dejan de depender de donde se ejecutan.
//
// COMPORTAMIENTO POR DEFECTO: base vacia. findUnique/findFirst devuelven
// null y findMany devuelve []. Es justo lo que necesitan los tests
// actuales, que verifican que un id inexistente da 401 o no explota.
//
// PARA SEMBRAR DATOS en un test:
//   const { __db } = require('@prisma/client');
//   __db.usuario.push({ id: 'u1', email: 'a@b.c', password: '...' });
//   __db.reset();   // en afterEach
//
// LIMITE IMPORTANTE: esto NO es Prisma. No valida el schema, no resuelve
// include/select anidados ni claves foraneas. Sirve para probar la logica
// que rodea a la consulta, no la consulta. Si algun dia necesitas probar
// queries de verdad, hace falta una base de prueba, no un mock mas grande.

const MODELOS = [
  'usuario', 'conductor', 'vehiculo', 'ruta', 'paradero', 'pasajero',
  'rutaEjecucion', 'coordenada', 'estadoTurno', 'checkin', 'calificacion',
];

const __db = { reset() { MODELOS.forEach(m => { __db[m].length = 0; }); } };
MODELOS.forEach(m => { __db[m] = []; });

// Comparacion superficial: alcanza para { where: { id } } o { where: { email } }.
const coincide = (fila, where = {}) =>
  Object.entries(where).every(([k, v]) =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? true : fila[k] === v);

function modelo(nombre) {
  const filas = () => __db[nombre] || [];
  return {
    findUnique: async ({ where = {} } = {}) => filas().find(f => coincide(f, where)) || null,
    findFirst:  async ({ where = {} } = {}) => filas().find(f => coincide(f, where)) || null,
    findMany:   async ({ where = {} } = {}) => filas().filter(f => coincide(f, where)),
    count:      async ({ where = {} } = {}) => filas().filter(f => coincide(f, where)).length,
    create:     async ({ data = {} } = {}) => { const f = { id: 'mock-' + (filas().length + 1), ...data }; filas().push(f); return f; },
    update:     async ({ where = {}, data = {} } = {}) => {
      const f = filas().find(x => coincide(x, where));
      if (!f) { const e = new Error('Registro no encontrado (mock)'); e.code = 'P2025'; throw e; }
      return Object.assign(f, data);
    },
    upsert:     async ({ where = {}, create = {}, update = {} } = {}) => {
      const f = filas().find(x => coincide(x, where));
      if (f) return Object.assign(f, update);
      const nuevo = { id: 'mock-' + (filas().length + 1), ...create };
      filas().push(nuevo); return nuevo;
    },
    delete:     async ({ where = {} } = {}) => {
      const i = filas().findIndex(x => coincide(x, where));
      if (i < 0) { const e = new Error('Registro no encontrado (mock)'); e.code = 'P2025'; throw e; }
      return filas().splice(i, 1)[0];
    },
    deleteMany: async ({ where = {} } = {}) => {
      const antes = filas().length;
      __db[nombre] = filas().filter(f => !coincide(f, where));
      return { count: antes - __db[nombre].length };
    },
    aggregate: async () => ({}),
    groupBy:   async () => [],
  };
}

class PrismaClient {
  constructor() {
    MODELOS.forEach(m => { this[m] = modelo(m); });
  }
  async $connect() {}
  async $disconnect() {}
  // Prisma acepta las dos formas: un callback o un array de promesas.
  async $transaction(arg) { return typeof arg === 'function' ? arg(this) : Promise.all(arg); }
  async $queryRaw() { return []; }
  async $executeRaw() { return 0; }
}

module.exports = { PrismaClient, Prisma: { PrismaClientKnownRequestError: Error }, __db };
