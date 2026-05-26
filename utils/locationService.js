/**
 * utils/locationService.js
 * ─────────────────────────────────────────────────────────────
 * Central engine that fetches & normalises emergency locations.
 *
 * Fetch priority (waterfall):
 *   Tier 1 → Google Maps Places API  (if GOOGLE_MAPS_API_KEY set)
 *   Tier 2 → OpenStreetMap Overpass  (free, no key needed)
 *   Tier 3 → Static JSON fallback    (always works, even offline)
 *
 * All tiers return the SAME normalised place shape so routes
 * never need to know which source was used.
 *
 * Exported:
 *   fetchNearby(lat, lng, category, options) → { results, meta }
 *   haversineKm(lat1, lng1, lat2, lng2)     → number
 * ─────────────────────────────────────────────────────────────
 */

"use strict";

const https        = require("https");
const http         = require("http");
const logger       = require("./logger");
const fallbackData = require("../data/fallback");

/* ═══════════════════════════════════════════════════════════════
   HAVERSINE DISTANCE
   Returns the great-circle distance in kilometres between two
   coordinate pairs. Used for sorting results by proximity.
   ═══════════════════════════════════════════════════════════════ */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;                                  // Earth radius (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const toRad = (deg) => (deg * Math.PI) / 180;

/* ═══════════════════════════════════════════════════════════════
   GENERIC HTTP GET  (native https — no axios needed)
   Resolves with parsed JSON or rejects with a descriptive Error.
   Timeout: 8 seconds.
   ═══════════════════════════════════════════════════════════════ */
function httpGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const options = {
      headers: {
        "User-Agent": "RoadSoS-IITMadras-Hackathon/1.0 (roadsos@iitm.ac.in)",
        "Accept"        : "application/json",
        "Accept-Language": "en",
        "Referer"       : "http://localhost:5500",
        ...extraHeaders,
      },
    };

    const req = lib.get(url, options, (res) => {
      let raw = "";
      res.on("data",  (chunk) => (raw += chunk));
      res.on("end",   () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error(`Non-JSON response from ${url.split("?")[0]}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode} from ${url.split("?")[0]}: ${raw.slice(0, 120)}`));
        }
      });
    });

   req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error(`Request timed out after 8 s: ${url.split("?")[0]}`));
    });

    req.on("error", (err) => reject(new Error(`Network error: ${err.message}`)));
  });
}

/* ═══════════════════════════════════════════════════════════════
   TIER 1 — GOOGLE MAPS PLACES API
   Docs: https://developers.google.com/maps/documentation/places
   Requires: GOOGLE_MAPS_API_KEY in .env
   ═══════════════════════════════════════════════════════════════ */

/* Map our category names → Google Places 'type' values */
const GOOGLE_TYPES = {
  hospital : "hospital",
  police   : "police",
  towing   : "car_repair",
};

async function fetchFromGoogle(lat, lng, category, radiusM) {
  const key  = process.env.GOOGLE_MAPS_API_KEY;
  const type = GOOGLE_TYPES[category];
  if (!type) throw new Error(`No Google type mapping for: ${category}`);

  const url = [
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    `?location=${lat},${lng}`,
    `&radius=${radiusM}`,
    `&type=${type}`,
    `&key=${key}`,
  ].join("");

  logger.info(`[Google] category=${category} radius=${radiusM}m`);
  const data = await httpGet(url);

  /* Google returns various status strings; only OK / ZERO_RESULTS are valid */
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API error: ${data.status} — ${data.error_message || "unknown"}`);
  }

  return (data.results || []).map((p) => normaliseGoogle(p, lat, lng, category));
}

function normaliseGoogle(place, userLat, userLng, category) {
  const loc  = place.geometry?.location ?? {};
  const dist = haversineKm(userLat, userLng, loc.lat ?? 0, loc.lng ?? 0);

  return {
    id          : `google-${place.place_id}`,
    name        : place.name,
    category,
    address     : place.vicinity || "Address not available",
    lat         : loc.lat,
    lng         : loc.lng,
    distanceKm  : +dist.toFixed(2),
    distanceStr : dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`,
    phone       : null,                       // Needs Place Details API call (extra quota)
    emergency   : null,
    openingHours: place.opening_hours?.open_now ? "Currently Open" : "Hours unknown",
    rating      : place.rating ?? null,
    placeId     : place.place_id,
    source      : "google_maps",
  };
}

/* ═══════════════════════════════════════════════════════════════
   TIER 2 — OPENSTREETMAP OVERPASS API
   Docs: https://overpass-api.de/
   Free, no key, rate-limited (be respectful).
   ═══════════════════════════════════════════════════════════════ */

/* Map our category → OSM amenity tag values */
const OSM_AMENITIES = {
  hospital : ["hospital", "clinic", "doctors", "pharmacy"],
  police   : ["police"],
  towing   : ["car_repair", "tyres", "fuel", "vehicle_inspection"],
};
async function fetchFromOSM(lat, lng, category, radiusM) {
  // Step 1: Get area name from coordinates
  let areaName = 'delhi';
  try {
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12`;
    const place = await httpGet(reverseUrl);
    const addr = place.address || {};
areaName = addr.suburb || addr.neighbourhood || addr.village || addr.city || 'delhi';
// Remove "Tehsil" and other administrative terms
areaName = areaName.replace(/tehsil/gi, '').replace(/district/gi, '').trim();
    logger.info(`[Nominatim] Area detected: ${areaName}`);
  } catch(e) {
    logger.warn(`[Nominatim] Reverse geocode failed: ${e.message}`);
  }

  // Step 2: Search using area name
 const searchTerm = {
    hospital: `hospital ${areaName}`,
    police  : `police ${areaName}`,
   towing: `puncture repair shop ${areaName}`,
  };

  const query = searchTerm[category];
  const url = `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}&` +
    `format=json&limit=15&countrycodes=in`;

  logger.info(`[Nominatim] Searching: '${query}'`);
  const data = await httpGet(url);

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No results for: ${query}`);
  }

  const results = data
    .filter(p => p.lat && p.lon)
    .map(p => {
      const dist = haversineKm(lat, lng, parseFloat(p.lat), parseFloat(p.lon));
      return {
        id          : `nom-${p.place_id}`,
        name        : p.display_name.split(',')[0],
        category,
        address     : p.display_name.split(',').slice(0,3).join(','),
        lat         : parseFloat(p.lat),
        lng         : parseFloat(p.lon),
        distanceKm  : +dist.toFixed(2),
        distanceStr : dist < 1 ? `${Math.round(dist*1000)} m` : `${dist.toFixed(1)} km`,
        phone       : null,
        openingHours: '24×7',
        source      : 'nominatim',
      };
    })
   .filter(p => p.distanceKm < 20)
.filter(p => !p.name.toLowerCase().includes('road') && 
             !p.name.toLowerCase().includes('street') &&
             !p.name.toLowerCase().includes('marg') &&
             !p.name.toLowerCase().includes('nagar') &&
             p.name.length > 3)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  logger.info(`[OSM] ✓ ${results.length} results for '${category}'`);
  return results;
}
function normaliseOSM(el, userLat, userLng, category) {
  const tags = el.tags || {};
  const dist = haversineKm(userLat, userLng, el.lat, el.lon);

  /* Build a human-readable address from OSM addr:* tags */
  const address = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"] || tags["addr:village"],
    tags["addr:city"],
    tags["addr:state"],
  ].filter(Boolean).join(", ") || tags["addr:full"] || "Address not available";

  return {
    id          : `osm-${el.id}`,
    name        : tags.name,
    category,
    address,
    lat         : el.lat,
    lng         : el.lon,
    distanceKm  : +dist.toFixed(2),
    distanceStr : dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`,
    phone       : tags.phone       || tags["contact:phone"]   || tags["contact:mobile"] || null,
    emergency   : tags.emergency   || null,
    openingHours: tags.opening_hours || "24×7",
    website     : tags.website     || tags["contact:website"] || null,
    wheelchair  : tags.wheelchair  || null,
    source      : "openstreetmap",
  };
}

/* ═══════════════════════════════════════════════════════════════
   TIER 3 — STATIC JSON FALLBACK
   Reads from data/fallback.js — always works even without internet.
   Adds real-time distance based on user coords.
   ═══════════════════════════════════════════════════════════════ */
function fetchFromFallback(lat, lng, category, limit) {
  logger.warn(`[Fallback] Using static data for category=${category} — API unavailable`);
  const records = fallbackData[category] || [];

  return records
    .map((item) => {
      const dist = haversineKm(lat, lng, item.lat, item.lng);
      return {
        ...item,
        distanceKm  : +dist.toFixed(2),
        distanceStr : dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`,
        source      : "fallback_static",
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORTED FUNCTION
   ═══════════════════════════════════════════════════════════════

   fetchNearby(lat, lng, category, options)
   ─────────────────────────────────────────
   @param  {number} lat        User latitude
   @param  {number} lng        User longitude
   @param  {string} category   "hospital" | "police" | "towing"
   @param  {object} options    { limit, radiusKm }
   @returns {object}           { results: [], meta: {} }
*/
async function fetchNearby(lat, lng, category, options = {}) {
  const limit    = Math.min(parseInt(options.limit)   || 10, 20);
  const radiusKm = Math.min(parseFloat(options.radiusKm) || 5, 50);
  const radiusM  = Math.round(radiusKm * 1000);

  let results = [];
  let source  = "unknown";
  let apiError = null;

  /* ── Tier 1: Google Maps ───────────────────────────────── */
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      results = await fetchFromGoogle(lat, lng, category, radiusM);
      source  = "google_maps";
      logger.info(`[Google] ✓ ${results.length} results for '${category}'`);
    } catch (err) {
      apiError = err.message;
      logger.warn(`[Google] ✗ ${err.message} — trying OSM next`);
    }
  }

  /* ── Tier 2: OpenStreetMap ─────────────────────────────── */
  if (!results.length) {
    try {
      results = await fetchFromOSM(lat, lng, category, radiusM);
      source  = "openstreetmap";
      logger.info(`[OSM] ✓ ${results.length} results for '${category}'`);
    } catch (err) {
      apiError = (apiError ? apiError + " | " : "") + err.message;
      logger.warn(`[OSM] ✗ ${err.message} — falling back to static data`);
    }
  }

  /* ── Tier 3: Static fallback ───────────────────────────── */
  if (!results.length) {
    results = fetchFromFallback(lat, lng, category, limit);
    source  = "fallback_static";
  }

  /* Sort all results by distance (closest first) */
  results.sort((a, b) => a.distanceKm - b.distanceKm);

  const sliced = results.slice(0, limit);

  return {
    results: sliced,
    meta: {
      source,
      total    : results.length,
      returned : sliced.length,
      radiusKm,
      queriedAt: new Date().toISOString(),
      /* surface any API errors transparently (non-breaking) */
      ...(apiError && source === "fallback_static" ? { warning: `Live API unavailable: ${apiError}` } : {}),
    },
  };
}

module.exports = { fetchNearby, haversineKm };
