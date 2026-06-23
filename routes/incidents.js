/**
 * routes/incidents.js
 * ─────────────────────────────────────────────────────────────
 * Road hazard / incident reporting, backed by Supabase Postgres.
 *
 * Replaces the old in-memory array, which lost all data on every
 * serverless cold start. Incidents now persist across deploys,
 * restarts, and invocations.
 * ─────────────────────────────────────────────────────────────
 */

"use strict";

const express = require("express");
const router = express.Router();
const { getClient, isConfigured } = require("../utils/db");
const logger = require("../utils/logger");

const TYPES = ["accident", "pothole", "road_block", "flood", "signal_fault", "debris", "other"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const MIN_DESCRIPTION_LENGTH = 10;

const HELP_NUMBERS = {
  ambulance: "102",
  police: "100",
  emergency: "112",
  nhaiTowing: "1033",
};

/* ── Guard: fail clearly if Supabase isn't configured yet ───── */
router.use((req, res, next) => {
  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      error: "Incident storage is not configured on this server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }
  next();
});

/* ── POST /incidents/report ──────────────────────────────────
   Body: { type, lat, lng, description, severity?, reporterName? }
*/
router.post("/report", async (req, res, next) => {
  try {
    const { type, lat, lng, description, severity, reporterName } = req.body || {};

    if (!type || !TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: "Invalid or missing 'type'.", valid: TYPES });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (lat === undefined || lng === undefined || isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ success: false, error: "'lat' and 'lng' are required and must be valid numbers." });
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ success: false, error: "'lat'/'lng' are out of valid geographic range." });
    }

    if (!description || typeof description !== "string" || description.trim().length < MIN_DESCRIPTION_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `'description' is required and must be at least ${MIN_DESCRIPTION_LENGTH} characters.`,
      });
    }

    const severityVal = severity && SEVERITIES.includes(severity) ? severity : "medium";

    const { data, error } = await getClient()
      .from("incidents")
      .insert({
        type,
        lat: latNum,
        lng: lngNum,
        description: description.trim(),
        severity: severityVal,
        reporter_name: (reporterName && String(reporterName).trim()) || "Anonymous",
        status: "reported",
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`[Incidents] Reported: ${data.id} (${type}, ${severityVal})`);

    return res.status(201).json({
      success: true,
      incident: toApiShape(data),
      helpNumbers: HELP_NUMBERS,
    });
  } catch (err) {
    next(err);
  }
});

/* ── GET /incidents ───────────────────────────────────────────
   Lists recent incidents, most recent first.
   Optional: ?limit=50 (default 50, max 200)
*/
router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const { data, error, count } = await getClient()
      .from("incidents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.json({
      success: true,
      total: count ?? data.length,
      results: data.map(toApiShape),
    });
  } catch (err) {
    next(err);
  }
});

/* ── GET /incidents/:id ───────────────────────────────────────
   Fetch a single incident by UUID. 404 if not found or if the
   id isn't a valid UUID shape (avoids a confusing DB error).
*/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id)) {
      return res.status(404).json({ success: false, error: "Incident not found." });
    }

    const { data, error } = await getClient()
      .from("incidents")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: "Incident not found." });
    }

    return res.json({ success: true, incident: toApiShape(data) });
  } catch (err) {
    next(err);
  }
});

/* ── Helper: map DB row (snake_case) → API shape (camelCase) ── */
function toApiShape(row) {
  return {
    id: row.id,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    severity: row.severity,
    reporterName: row.reporter_name,
    status: row.status,
    createdAt: row.created_at,
  };
}

module.exports = router;