/**
 * middleware/requestLogger.js
 * ─────────────────────────────────────────────────────────────
 * Attaches a unique request ID to every incoming request and
 * logs structured completion info (method, path, status, ms).
 * ─────────────────────────────────────────────────────────────
 */

"use strict";

const crypto = require("crypto");  // built-in, no install needed
const logger = require("../utils/logger");

module.exports = function requestLogger(req, res, next) {
  // Generate unique ID for this request (useful for tracing errors)
  req.requestId = crypto.randomUUID();
  req.startTime = Date.now();

  // Expose the request ID to the caller in the response header
  res.setHeader("X-Request-ID", req.requestId);

  // Log after response finishes so we have the final status code
  res.on("finish", () => {
    const ms     = Date.now() - req.startTime;
    const level  = res.statusCode >= 500 ? "error"
                 : res.statusCode >= 400 ? "warn"
                 : "info";

    logger[level]({
      requestId: req.requestId,
      method   : req.method,
      path     : req.originalUrl,
      status   : res.statusCode,
      ms       : `${ms}ms`,
      ip       : req.ip || req.connection?.remoteAddress,
      userAgent: req.get("user-agent")?.slice(0, 60) || "-",
    });
  });

  next();
};
