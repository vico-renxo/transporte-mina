const express = require('express');
const {
  listarRutas, listarRutasPublicas, obtenerRuta, crearRuta, actualizarRuta,
  iniciarRuta, finalizarRuta, reportarIncidencia,
  obtenerEjecucionesActivas, historialEjecuciones
} = require('./rutas.service');
const { authMiddleware, requireRol } = require('../../shared/middleware/auth');
const router = express.Router();

router.get('/', authMiddleware, async (req, res, next) => {
  try { res.json(await listarRutas()); } catch (err) { next(err); }
});

// PÚBLICO (sin auth): rutas y paraderos para el formulario de registro de pasajeros.
// Solo expone nombres/orden — ningún dato sensible.
router.get('/publicas', async (req, res, next) => {
  try { res.json(await listarRutasPublicas()); } catch (err) { next(err); }
});

router.get('/activas', authMiddleware, requireRol('ADMIN', 'SUPERVISOR', 'GERENCIA', 'PASAJERO', 'CONDUCTOR'), async (req, res, next) => {
  try { res.json(await obtenerEjecucionesActivas()); } catch (err) { next(err); }
});

router.get('/historial', authMiddleware, requireRol('ADMIN', 'SUPERVISOR', 'GERENCIA'), async (req, res, next) => {
  try { res.json(await historialEjecuciones(req.query)); } catch (err) { next(err); }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try { res.json(await obtenerRuta(req.params.id)); } catch (err) { next(err); }
});

router.post('/', authMiddleware, requireRol('ADMIN'), async (req, res, next) => {
  try { res.status(201).json(await crearRuta(req.body)); } catch (err) { next(err); }
});

router.patch('/:id', authMiddleware, requireRol('ADMIN'), async (req, res, next) => {
  try { res.json(await actualizarRuta(req.params.id, req.body)); } catch (err) { next(err); }
});

// Iniciar una ejecucion de ruta.
//
// Hay DOS caminos historicos hacia la misma operacion:
//   POST /rutas/:id/iniciar  <- el que usa el panel (web/src/lib/api.ts)
//   POST /rutas/iniciar      <- pensado para la app del conductor; hoy no lo
//                               llama nadie en este repo.
//
// Estaban escritos dos veces, con las mismas roles pero en distinto orden.
// Mientras sean dos textos separados, nada impide que manana uno sume un rol
// y el otro no, y que el agujero quede abierto justo en el que no miraste.
// Ahora la lista de roles y el handler existen UNA sola vez y se montan en
// los dos paths: divergir se volvio imposible.
//
// OJO, un cambio de comportamiento: el handler viejo de /:id/iniciar hacia
// { rutaId: req.params.id, ...req.body }, con el spread ULTIMO, asi que un
// rutaId mandado en el body le ganaba al de la URL. Ahora gana la URL, que es
// lo sensato. Nadie en este repo manda rutaId en el body, pero si algun
// cliente de afuera lo hacia, para el cambia.
//
// El path sin :id se conserva por si algun cliente afuera de este repo lo usa.
// Si se confirma que no, borrarlo es una linea.
const ROLES_INICIAR = ['ADMIN', 'SUPERVISOR', 'CONDUCTOR'];

const handlerIniciar = async (req, res, next) => {
  try {
    // rutaId sale de la URL cuando viene, del body cuando no.
    const rutaId = req.params.id || req.body.rutaId;
    res.json(await iniciarRuta({ ...req.body, rutaId }));
  } catch (err) { next(err); }
};

router.post('/:id/iniciar', authMiddleware, requireRol(...ROLES_INICIAR), handlerIniciar);
router.post('/iniciar',     authMiddleware, requireRol(...ROLES_INICIAR), handlerIniciar);

router.post('/:id/finalizar', authMiddleware, requireRol('CONDUCTOR', 'ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  try { res.json(await finalizarRuta(req.params.id)); } catch (err) { next(err); }
});

router.post('/:id/incidencia', authMiddleware, requireRol('CONDUCTOR'), async (req, res, next) => {
  try {
    const { mensaje } = req.body;
    if (!mensaje) throw { status: 400, message: 'Mensaje de incidencia requerido' };
    res.json(await reportarIncidencia(req.params.id, mensaje));
  } catch (err) { next(err); }
});

module.exports = router;
