let Sentry;
try { Sentry = require('@sentry/node'); } catch (_e) { /* Sentry not installed */ }

function errorHandler(err, req, res, _next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);

  // Report to Sentry if configured
  if (Sentry && process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({ success: false, error: 'לא מורשה', code: 'UNAUTHORIZED' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, error: err.message, code: 'VALIDATION_ERROR' });
  }
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'שגיאת שרת' : err.message,
    code: 'INTERNAL_ERROR',
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
}

module.exports = { errorHandler, notFoundHandler };
