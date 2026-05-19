/**
 * routes/challans.js
 * ─────────────────────────────────────────────────────────────
 * GET /challans
 *
 * Traffic fine calculator based on the Motor Vehicles
 * (Amendment) Act, 2019 — India.
 *
 * Query params:
 *   violation  {string} optional  e.g. "speeding", "drunk_driving"
 *   vehicle    {string} optional  e.g. "car", "bike", "truck"
 *
 * Without params → returns the complete fine schedule.
 * With params    → returns matching fine details.
 *
 * Example:
 *   GET /challans
 *   GET /challans?violation=drunk_driving&vehicle=car
 * ─────────────────────────────────────────────────────────────
 */

const express = require("express");
const router  = express.Router();

const FINES = {
  drunk_driving : { label:"Drunk Driving", car:10000, bike:10000, truck:10000, auto:10000, jail:"6 months" },
  speeding      : { label:"Over-speeding", car:2000,  bike:1000,  truck:4000,  auto:1500,  jail:null },
  no_helmet     : { label:"No Helmet",     car:null,  bike:1000,  truck:null,  auto:null,  jail:null },
  no_seatbelt   : { label:"No Seatbelt",   car:1000,  bike:null,  truck:1000,  auto:null,  jail:null },
  red_light     : { label:"Red Light Jump",car:5000,  bike:5000,  truck:5000,  auto:5000,  jail:"1 year" },
  no_license    : { label:"No License",    car:5000,  bike:5000,  truck:5000,  auto:5000,  jail:"3 months" },
  using_mobile  : { label:"Using Mobile",  car:1000,  bike:1000,  truck:1000,  auto:1000,  jail:null },
  hit_and_run   : { label:"Hit and Run",   car:200000,bike:200000,truck:200000,auto:200000,jail:"10 years" },
};

router.get("/violations", (_req, res) => {
  res.json({ success: true, violations: Object.keys(FINES).map(k => ({ code: k, ...FINES[k] })) });
});

router.get("/", (req, res) => {
  const { violation, vehicle } = req.query;
  if (!violation) return res.json({ success: true, schedule: FINES });
  if (!FINES[violation]) return res.status(404).json({ success: false, error: "Unknown violation" });
  const data = FINES[violation];
  const fine = vehicle ? data[vehicle] : data;
  res.json({ success: true, violation, label: data.label, vehicle: vehicle || "all", fine, jail: data.jail });
});

module.exports = router;
