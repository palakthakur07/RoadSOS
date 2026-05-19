/**
 * routes/police.js
 * ─────────────────────────────────────────────────────────────
 * GET /nearest-police
 *
 * Query params:
 *   lat      {number} required
 *   lng      {number} required
 *   limit    {number} optional  default 10
 *   radius   {number} optional  km, default 5
 *
 * Example:
 *   GET /nearest-police?lat=28.5672&lng=77.2100&limit=5
 * ─────────────────────────────────────────────────────────────
 */

const express = require("express");
const router  = express.Router();
const { fetchNearby } = require("../utils/locationService");

router.get("/", async (req, res, next) => {
  try {
    const { lat, lng, limit, radius } = req.query;
    const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "police", { limit, radiusKm: radius });
    res.json({ success: true, category: "police", emergencyNumber: "100", ...data });
  } catch (err) { next(err); }
});

module.exports = router;