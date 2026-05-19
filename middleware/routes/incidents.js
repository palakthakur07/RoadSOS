/**
 * routes/incidents.js  (overwrite)
 * ─────────────────────────────────────────────────────────────
 * POST /incidents/report   → submit a new road incident
 * GET  /incidents          → list incidents (filter by type/area)
 * GET  /incidents/:id      → fetch a single incident
 * ─────────────────────────────────────────────────────────────
 */
const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");

const incidents = [];
const TYPES = ["accident","pothole","road_block","flood","signal_fault","debris","other"];

router.post("/report", (req, res) => {
  const { type, lat, lng, description, severity, reporterName } = req.body;
  if (!type || !TYPES.includes(type)) return res.status(400).json({ success:false, error:"Invalid type", valid:TYPES });
  if (!lat || !lng) return res.status(400).json({ success:false, error:"lat and lng required" });
  const incident = { id:crypto.randomUUID(), type, lat:+lat, lng:+lng, description, severity:severity||"medium", reporterName:reporterName||"Anonymous", status:"open", createdAt:new Date().toISOString() };
  incidents.unshift(incident);
  res.status(201).json({ success:true, incident });
});

router.get("/", (req, res) => {
  res.json({ success:true, total:incidents.length, results:incidents.slice(0, 50) });
});

module.exports = router;