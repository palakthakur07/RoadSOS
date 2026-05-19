/**
 * routes/hospitals.js
 * ─────────────────────────────────────────────────────────────
 * GET /nearest-hospital
 *
 * Query params:
 *   lat      {number} required   User latitude
 *   lng      {number} required   User longitude
 *   limit    {number} optional   Max results (default 10, max 20)
 *   radius   {number} optional   Search radius in km (default 5)
 *
 * Example:
 *   GET /nearest-hospital?lat=28.5672&lng=77.2100&limit=5
 *   GET /nearest-hospital?lat=28.5672&lng=77.2100&radius=10
 *
 * Response 200:
 *   {
 *     success: true,
 *     category: "hospital",
 *     query: { lat, lng, radiusKm, limit },
 *     meta: { source, total, returned, queriedAt },
 *     results: [ { id, name, address, lat, lng, distanceKm, distanceStr,
 *                  phone, emergency, openingHours, beds, ... } ]
 *   }
 * ─────────────────────────────────────────────────────────────
 */

const express = require("express");
const router  = express.Router();
const { fetchNearby } = require("../utils/locationService");

router.get("/", async (req, res, next) => {
  try {
    const { lat, lng, limit, radius } = req.query;
    const data = await fetchNearby(parseFloat(lat), parseFloat(lng), "hospital", { limit, radiusKm: radius });
    res.json({ success: true, category: "hospital", ...data });
  } catch (err) { next(err); }
});

module.exports = router;