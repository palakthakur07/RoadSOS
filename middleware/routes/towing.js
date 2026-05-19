/**
 * routes/towing.js
 * ─────────────────────────────────────────────────────────────
 * GET /nearest-towing
 *
 * Query params:
 *   lat      {number} required
 *   lng      {number} required
 *   limit    {number} optional  default 10
 *   radius   {number} optional  km, default 5
 *
 * Example:
 *   GET /nearest-towing?lat=28.5672&lng=77.2100
 * ─────────────────────────────────────────────────────────────
 */
const express = require("express");
const router  = express.Router();
const { fetchNearby } = require("../utils/locationService");

router.get("/", async (req, res, next) => {
  try {
    const { lat, lng, limit, radius } = req.query;
    const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "towing", { limit, radiusKm: radius });
    res.json({ success: true, category: "towing", nhaiFreeHelpline: "1033", ...data });
  } catch (err) { next(err); }
});

module.exports = router;