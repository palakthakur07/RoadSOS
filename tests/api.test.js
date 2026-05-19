/**
 * tests/api.test.js
 * ─────────────────────────────────────────────────────────────
 * Manual integration tests for the RoadSoS API.
 * Uses only built-in Node.js http module — no test framework.
 *
 * Run: node tests/api.test.js
 *      (server must already be running on PORT 5000)
 * ─────────────────────────────────────────────────────────────
 */

"use strict";

const http = require("http");

const BASE     = `http://localhost:${process.env.PORT || 5000}`;
const PASS     = "\x1b[32m✓\x1b[0m";
const FAIL     = "\x1b[31m✗\x1b[0m";
const SECTION  = (t) => console.log(`\n\x1b[36m── ${t} ──\x1b[0m`);

let passed = 0, failed = 0;

// ── HTTP helper ───────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      method,
      hostname: "localhost",
      port    : process.env.PORT || 5000,
      path,
      headers : {
        "Content-Type"  : "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Assertion helper ──────────────────────────────────────────
function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n\x1b[1m  🚨  RoadSoS API Test Suite\x1b[0m");
  console.log(`  Target: ${BASE}\n`);

  // ── 1. Root & Health ──────────────────────────────────────
  SECTION("Root & Health");

  let r = await request("GET", "/");
  assert("GET / returns 200",            r.status === 200);
  assert("GET / has endpoints field",    typeof r.body.endpoints === "object");
  assert("GET / X-Request-ID header",    !!r.headers["x-request-id"]);

  r = await request("GET", "/health");
  assert("GET /health returns 200",      r.status === 200);
  assert("GET /health status=healthy",   r.body.status === "healthy");
  assert("GET /health has uptime",       !!r.body.uptime);

  // ── 2. /nearest-hospital ─────────────────────────────────
  SECTION("GET /nearest-hospital");

  r = await request("GET", "/nearest-hospital?lat=28.5672&lng=77.2100");
  assert("returns 200",                  r.status === 200);
  assert("success=true",                 r.body.success === true);
  assert("results is array",            Array.isArray(r.body.results));
  assert("results not empty",            r.body.results.length > 0);
  assert("first result has name",        !!r.body.results[0]?.name);
  assert("first result has distanceKm",  typeof r.body.results[0]?.distanceKm === "number");
  assert("first result has distanceStr", !!r.body.results[0]?.distanceStr);
  assert("meta.source is present",       !!r.body.meta?.source);
  assert("sorted by distance",           (() => {
    const d = r.body.results.map(x => x.distanceKm);
    return d.every((v, i) => i === 0 || v >= d[i - 1]);
  })());

  r = await request("GET", "/nearest-hospital?lat=28.5672&lng=77.2100&limit=3");
  assert("limit=3 returns ≤3 results",   r.body.results.length <= 3);

  r = await request("GET", "/nearest-hospital");
  assert("missing lat → 400",            r.status === 400);

  r = await request("GET", "/nearest-hospital?lat=999&lng=77.21");
  assert("invalid lat → 400",            r.status === 400);

  r = await request("GET", "/nearest-hospital?lat=abc&lng=xyz");
  assert("non-numeric lat/lng → 400",    r.status === 400);

  // ── 3. /nearest-police ───────────────────────────────────
  SECTION("GET /nearest-police");

  r = await request("GET", "/nearest-police?lat=28.5672&lng=77.2100");
  assert("returns 200",                  r.status === 200);
  assert("success=true",                 r.body.success === true);
  assert("has emergencyNumber field",    r.body.emergencyNumber === "100");
  assert("results not empty",            r.body.results.length > 0);

  // ── 4. /nearest-towing ───────────────────────────────────
  SECTION("GET /nearest-towing");

  r = await request("GET", "/nearest-towing?lat=28.5672&lng=77.2100");
  assert("returns 200",                  r.status === 200);
  assert("has nhaiFreeHelpline",         r.body.nhaiFreeHelpline === "1033");
  assert("results not empty",            r.body.results.length > 0);
  assert("first result has phone",       r.body.results[0]?.phone !== undefined);

  // ── 5. /challans ─────────────────────────────────────────
  SECTION("GET /challans");

  r = await request("GET", "/challans");
  assert("returns 200",                  r.status === 200);
  assert("fines is array",               Array.isArray(r.body.fines));
  assert("fines count > 5",             r.body.fines.length > 5);

  r = await request("GET", "/challans?violation=drunk_driving&vehicle=car");
  assert("specific fine returns 200",    r.status === 200);
  assert("has applicableFine",           !!r.body.results[0]?.applicableFine);

  r = await request("GET", "/challans?violation=speeding");
  assert("speeding fine returns 200",    r.status === 200);

  r = await request("GET", "/challans?violation=nonexistent_thing");
  assert("unknown violation → 404",      r.status === 404);

  // ── 6. /incidents ────────────────────────────────────────
  SECTION("POST /incidents/report + GET /incidents");

  r = await request("POST", "/incidents/report", {
    lat        : 28.5672,
    lng        : 77.2100,
    type       : "accident",
    description: "Head-on collision at NH-48 near toll plaza",
    severity   : "high",
  });
  assert("POST /report returns 201",     r.status === 201);
  assert("incident.id present",         !!r.body.incident?.id);
  assert("incident.status=reported",    r.body.incident?.status === "reported");
  assert("has helpNumbers in response",  typeof r.body.helpNumbers === "object");

  const createdId = r.body.incident?.id;

  r = await request("GET", "/incidents");
  assert("GET /incidents returns 200",   r.status === 200);
  assert("results is array",            Array.isArray(r.body.results));

  r = await request("GET", `/incidents/${createdId}`);
  assert("GET /incidents/:id returns 200", r.status === 200);
  assert("returns correct incident",    r.body.incident?.id === createdId);

  r = await request("GET", "/incidents/nonexistent-uuid");
  assert("unknown ID → 404",            r.status === 404);

  r = await request("POST", "/incidents/report", {
    lat: 28.5672, lng: 77.21,
    type: "invalid_type",
    description: "test",
  });
  assert("invalid type → 400",          r.status === 400);

  r = await request("POST", "/incidents/report", {
    lat: 28.5672, lng: 77.21, type: "accident",
    description: "hi",   // too short
  });
  assert("short description → 400",     r.status === 400);

  // ── 7. Edge Cases ─────────────────────────────────────────
  SECTION("Edge Cases");

  r = await request("GET", "/nonexistent-endpoint");
  assert("unknown route → 404",          r.status === 404);
  assert("404 has hint field",           !!r.body.hint);

  // ── Summary ───────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${"─".repeat(44)}`);
  console.log(`  Tests: ${total}  |  ${PASS} Passed: ${passed}  |  ${FAIL} Failed: ${failed}`);
  console.log(`${"─".repeat(44)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("\n\x1b[31mTest runner error:\x1b[0m", err.message);
  console.error("Make sure the server is running: npm start");
  process.exit(1);
});
