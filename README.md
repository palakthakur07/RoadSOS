# RoadSoS — Emergency Road Safety Platform

RoadSoS is an emergency-response web platform built for Indian roads. It helps people
in a roadside emergency quickly find the nearest hospital, police station, or towing
service, report road hazards, and get instant access to national emergency helplines —
all from a single page, with no login required.

**Live app:** https://road-sos-taupe.vercel.app

---

## What it does

- **Emergency Map** — live map of nearby hospitals, police stations, and towing
  services, filterable by category, with distance and contact info for each.
- **Services tab** — one-tap access to emergency numbers (ambulance, police, NHAI
  towing, national helplines) with live response-time indicators.
- **AI Chatbot** — ask in plain language ("nearest hospital", "first aid for bleeding",
  "drunk driving fine") and get a relevant answer, using live location data where
  possible and falling back to a Gemini-powered or canned response otherwise.
- **Incident reporting** — report accidents, potholes, road blocks, flooding, and other
  hazards by location; reports persist in a real database (see below) and can be
  listed or looked up by ID.
- **Traffic fine lookup (challans)** — quick reference for common traffic violation
  fines in India.

---

## Tech stack

**Frontend:** Single-file HTML/CSS/JS (`roadsos.html`) using Leaflet.js for maps —
no build step, no framework, deploys as a static file.

**Backend:** Node.js + Express, deployed as Vercel serverless functions.

**Data sources (waterfall, in order):**
1. Google Maps Places API (optional — only used if `GOOGLE_MAPS_API_KEY` is set)
2. OpenStreetMap / Nominatim (free, no key required)
3. Static fallback dataset (`data/fallback.js`) — always available, even offline

**Persistence:** Supabase (Postgres) for incident reports. This is the only stateful
part of the app — everything else (nearby-place lookups, chat) is computed fresh on
each request.

**AI chat:** Google Gemini API (optional — falls back to canned responses if
`GEMINI_API_KEY` is not set).

---

## Project structure

```
.
├── roadsos.html              # Entire frontend — static, deployed as-is
├── server.js                  # Express app entry point
├── vercel.json                 # Vercel build/route config
├── package.json
├── routes/
│   ├── hospitals.js           # GET /nearest-hospital
│   ├── police.js              # GET /nearest-police
│   ├── towing.js               # GET /nearest-towing
│   ├── challans.js             # GET /challans — traffic fine lookup
│   ├── incidents.js            # POST /incidents/report, GET /incidents, GET /incidents/:id
│   └── chat.js                  # POST /chat — AI assistant
├── middleware/
│   ├── requestLogger.js        # Adds X-Request-ID + structured request logging
│   ├── errorHandler.js          # Centralised error response formatting
│   └── validateLocation.js      # lat/lng/radius/limit validation for nearby-place routes
├── utils/
│   ├── locationService.js       # Google/OSM/fallback waterfall fetcher + Haversine distance
│   ├── logger.js                 # Winston logger (console-only on Vercel)
│   └── db.js                      # Supabase client wrapper
├── data/
│   ├── fallback.js               # Static emergency-location dataset (Delhi region)
│   └── schema.sql                 # Postgres schema for the incidents table
└── tests/
    └── api.test.js                # Manual integration test suite (no framework)
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```dotenv
PORT=5000
NODE_ENV=development

# Required for incident persistence
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret

# Optional — live AI chat replies (falls back to canned responses if unset)
GEMINI_API_KEY=

# Optional — Tier-1 nearby-place lookups (falls back to OSM, then static data, if unset)
GOOGLE_MAPS_API_KEY=
```

**Getting Supabase credentials:**
1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** to find your Project URL and `service_role` secret key
3. Go to **SQL Editor**, paste the contents of `data/schema.sql`, and run it once to
   create the `incidents` table

> ⚠️ The `service_role` key bypasses Row Level Security. Never expose it to the
> frontend or commit it to git — it belongs only in `.env` (local) or your hosting
> provider's environment variable settings (production).

### 3. Run locally

```bash
npm run dev      # with nodemon (auto-restart on file changes)
# or
npm start        # plain node
```

The API runs on `http://localhost:5000` by default. Open `roadsos.html` directly in a
browser, or serve it with any static file server.

### 4. Run tests

```bash
npm test
```

Requires the server to already be running locally on the configured port.

---

## Deployment (Vercel)

This project is configured to deploy as-is via `vercel.json` — the HTML file is
served statically, and `server.js` runs as a serverless function handling all API
routes.

1. Push to GitHub
2. Import the repo in Vercel
3. Add the same environment variables from `.env` into **Vercel → Project →
   Settings → Environment Variables** (local `.env` files are never read in
   production)
4. Deploy — Vercel auto-deploys on every push to the connected branch

---

## API reference (quick)

| Method | Path                     | Description                              |
|--------|---------------------------|-------------------------------------------|
| GET    | `/nearest-hospital`        | Nearest hospitals (`?lat=&lng=&radius=&limit=`) |
| GET    | `/nearest-police`           | Nearest police stations                  |
| GET    | `/nearest-towing`            | Nearest towing services                  |
| GET    | `/challans`                  | Traffic fine schedule / lookup            |
| POST   | `/incidents/report`           | Report a road hazard                     |
| GET    | `/incidents`                   | List recent incident reports             |
| GET    | `/incidents/:id`                | Get a single incident by ID              |
| POST   | `/chat`                          | AI assistant / quick-answer endpoint     |
| GET    | `/health`                         | Health check                             |

---

## Known limitations / in progress

Being upfront about the current state rather than overstating it:

- **Rate limiting is not yet active.** `express-rate-limit` is a dependency and the
  `.env` has `RATE_LIMIT_GLOBAL` / `RATE_LIMIT_LOCATION` placeholders, but no
  middleware currently enforces them. Without this, the Gemini API key and
  OSM/Nominatim usage have no abuse protection.
- **`requestLogger.js` and `errorHandler.js` exist but are not wired into
  `server.js` yet.** Once connected, every response will include an `X-Request-ID`
  header and errors will return a consistent JSON shape.
- **ETAs shown on the frontend are estimates**, calculated from distance at an
  assumed ~28 km/h average speed — not real traffic-aware routing times.
- **No authentication or rate limiting on incident reporting** — currently anyone
  can submit a report; there's no spam/abuse protection beyond basic field
  validation.

---

## Emergency numbers (India) referenced in this app

| Service              | Number  |
|----------------------|---------|
| National Emergency    | 112    |
| Ambulance              | 102    |
| Police                  | 100    |
| Traffic Police            | 1095  |
| Women's Helpline            | 1091 |
| NHAI Highway Assistance      | 1033 |
| Road Accident Helpline         | 1073 |

---

## License

MIT
