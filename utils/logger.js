"use strict";

const { createLogger, format, transports } = require("winston");

const ENV = process.env.NODE_ENV || "development";
const isVercel = process.env.VERCEL || false;

const consoleFmt = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: "HH:mm:ss" }),
  format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

// Only console logging on Vercel (no file system access)
const loggerTransports = [
  new transports.Console({ format: consoleFmt }),
];

const logger = createLogger({
  level: ENV === "production" ? "info" : "debug",
  defaultMeta: { service: "roadsos-api" },
  transports: loggerTransports,
});

module.exports = logger;