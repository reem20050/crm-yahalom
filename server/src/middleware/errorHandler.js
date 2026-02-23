// Sentry integration (gracefully handles if @sentry/node is not installed)
let Sentry;
try { Sentry = require('@sentry/node'); } catch (e) { /* Sentry not installed */ }

/**
 * Central error handling middleware
 * Logs errors, reports to Sentry if configured, and returns appropriate response
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Report to Sentry if configured
  if (Sentry && process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Send error response
  res.status(statusCode).json({
    error: statusCode === 500 ? 'שגיאה בשרת' : err.message,
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

module.exports = errorHandler;
