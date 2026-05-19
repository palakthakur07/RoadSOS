/**
 * middleware/errorHandler.js
 * ─────────────────────────────────────────────────────────────
 * Global Express error handler — catches any error thrown inside
 * route handlers and returns a clean, consistent JSON response.
 *
 * Must be registered as the LAST middleware in server.js.
 * ─────────────────────────────────────────────────────────────
 */

"use strict";

const logger = require("../utils/logger");

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  // Don't re-send if headers already sent (streaming response, etc.)
  if (res.headersSent) return next(err);

  const status  = err.status || err.statusCode || 500;
  const isProd  = process.env.NODE_ENV === "production";

  // Log full stack in development; only message in production
  if (status >= 500) {
    logger.error({
      requestId : req.requestId,
      message   : err.message,
      stack     : err.stack,
      path      : req.originalUrl,
      method    : req.method,
    });
  } else {
    logger.warn({
      requestId: req.requestId,
      message  : err.message,
      path     : req.originalUrl,
    });
  }

  res.status(status).json({
    success  : false,
    error    : err.message || "An unexpected error occurred.",
    requestId: req.requestId,
    // Only expose stack trace in development
    ...(isProd ? {} : { stack: err.stack }),
  });
};
