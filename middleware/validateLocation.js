/**
 * middleware/validateLocation.js
 * ─────────────────────────────────────────────────────────────
 * Validates lat/lng query parameters before they reach routes.
 * Rejects clearly invalid or impossible coordinates early,
 * before any expensive API calls are made.
 * ─────────────────────────────────────────────────────────────
 */

"use strict";

const logger = require("../utils/logger");

/**
 * validateLatLng middleware
 * ─────────────────────────
 * Expects:  ?lat=<number>&lng=<number>
 * Optional: ?radius=<km>  ?limit=<n>
 */
function validateLatLng(req, res, next) {
  const { lat, lng, radius, limit } = req.query;

  // ── lat is required ──────────────────────────────────────
  if (lat === undefined || lat === "") {
    return res.status(400).json({
      success: false,
      error  : "Missing required query parameter: 'lat' (latitude).",
      example: `${req.path}?lat=28.5672&lng=77.2100`,
    });
  }

  // ── lng is required ──────────────────────────────────────
  if (lng === undefined || lng === "") {
    return res.status(400).json({
      success: false,
      error  : "Missing required query parameter: 'lng' (longitude).",
      example: `${req.path}?lat=28.5672&lng=77.2100`,
    });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  // ── Must be valid numbers ─────────────────────────────────
  if (isNaN(latNum) || isNaN(lngNum)) {
    return res.status(400).json({
      success: false,
      error  : "Parameters 'lat' and 'lng' must be valid numbers.",
      received: { lat, lng },
    });
  }

  // ── Must be within valid geographic bounds ────────────────
  if (latNum < -90 || latNum > 90) {
    return res.status(400).json({
      success: false,
      error  : `'lat' must be between -90 and 90. Received: ${latNum}`,
    });
  }

  if (lngNum < -180 || lngNum > 180) {
    return res.status(400).json({
      success: false,
      error  : `'lng' must be between -180 and 180. Received: ${lngNum}`,
    });
  }

  // ── Validate optional radius ──────────────────────────────
  if (radius !== undefined) {
    const r = parseFloat(radius);
    if (isNaN(r) || r <= 0 || r > 50) {
      return res.status(400).json({
        success: false,
        error  : "'radius' must be a number between 0 and 50 km.",
        received: radius,
      });
    }
    req.query.radiusKm = r;
  }

  // ── Validate optional limit ───────────────────────────────
  if (limit !== undefined) {
    const l = parseInt(limit);
    if (isNaN(l) || l < 1 || l > 20) {
      return res.status(400).json({
        success: false,
        error  : "'limit' must be an integer between 1 and 20.",
        received: limit,
      });
    }
  }

  // ── Attach parsed values so routes don't re-parse ─────────
  req.userLat = latNum;
  req.userLng = lngNum;

  logger.debug(`[validateLatLng] ✓ lat=${latNum}, lng=${lngNum}`);
  next();
}

module.exports = { validateLL: validateLatLng, validateLatLng };
