function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor';

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${status}] ${req.method} ${req.path} — ${message}`);
    if (status === 500) console.error(err.stack);
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
