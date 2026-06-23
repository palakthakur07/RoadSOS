/**
 * utils/db.js
 * ─────────────────────────────────────────────────────────────
 * Supabase (Postgres) client, shared across routes.
 *
 * Uses the SERVICE ROLE key, not the anon key, because this file
 * only ever runs server-side (inside Vercel functions) and needs
 * to bypass Row Level Security for inserts/reads made on behalf
 * of anonymous users. NEVER expose the service_role key to the
 * browser/frontend — it must only live in Vercel's server env vars.
 *
 * Required environment variables (set in Vercel dashboard, and
 * locally in a .env file — see .env.example):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * ─────────────────────────────────────────────────────────────
 */

"use strict";

const { createClient } = require("@supabase/supabase-js");
const logger = require("./logger");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }, // serverless — no session to persist between requests
  });
  logger.info("[Supabase] Client initialised");
} else {
  logger.warn("[Supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — DB features will fail until configured.");
}

/**
 * isConfigured()
 * Lets routes check before attempting a query, so we can return a
 * clear 503 instead of a confusing crash if env vars are missing
 * (e.g. in local dev before .env is set up).
 */
function isConfigured() {
  return supabase !== null;
}

function getClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return supabase;
}

module.exports = { getClient, isConfigured };