/**
 * utils/logger.js
 * ─────────────────────────────────────────────────────────────
 * Centralised Winston logger used across the entire app.
 * Outputs:
 *   • Console  — coloured, human-readable in development
 *   • File     — ./logs/app.log   (all levels)
 *   • File     — ./logs/error.log (errors only)
 * ─────────────────────────────────────────────────────────────
 */

"use strict";

const { createLogger, format, transports } = require("winston");
const path = require("path");
const fs   = require("fs");

// Ensure log directory exists
const LOG_DIR = process.env.LOG_DIR || "./logs";
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ── Custom console format (coloured + aligned) ────────────────
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: "HH:mm:ss" }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? " " + JSON.stringify(meta)
      : "";
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// ── JSON format for log files (machine-readable) ─────────────
const fileFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",

  transports: [
    // All logs → console
    new transports.Console({ format: consoleFormat }),

    // All logs → app.log (if LOG_TO_FILE=true)
    ...(process.env.LOG_TO_FILE !== "false"
      ? [
          new transports.File({
            filename : path.join(LOG_DIR, "app.log"),
            format   : fileFormat,
            maxsize  : 5 * 1024 * 1024, // 5 MB per file
            maxFiles : 5,                // keep 5 rotated files
          }),
          // Errors only → error.log
          new transports.File({
            filename: path.join(LOG_DIR, "error.log"),
            level   : "error",
            format  : fileFormat,
            maxsize : 5 * 1024 * 1024,
            maxFiles: 3,
          }),
        ]
      : []),
  ],

  // Catch uncaught exceptions & unhandled promise rejections
  exceptionHandlers: [
    new transports.Console({ format: consoleFormat }),
    new transports.File({ filename: path.join(LOG_DIR, "exceptions.log"), format: fileFormat }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(LOG_DIR, "rejections.log"), format: fileFormat }),
  ],
});

module.exports = logger;
