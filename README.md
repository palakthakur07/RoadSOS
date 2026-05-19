# 🚨 RoadSoS Backend API
### IIT Madras Road Safety Hackathon — Emergency Services Platform

> Real-time emergency location API for trauma centers, police stations, and towing services — powered by OpenStreetMap (free) with optional Google Maps upgrade.

---

## ⚡ Quick Start (3 commands)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # Edit .env — add Google Maps key (optional)

# 3. Start the server
npm start                   # → http://localhost:5000
# or with hot-reload:
npm run dev                 # requires: npm install -g nodemon
```

---

## 📁 Project Structure

```
roadsos-backend/
│
├── server.js                    # Main entry point — Express app setup
│
├── routes/
│   ├── hospitals.js             # GET /nearest-hospital
│   ├── police.js                # GET /nearest-police
│   ├── towing.js                # GET /nearest-towing
│   ├── challans.js              # GET /challans — fine calculator
│   └── incidents.js             # POST/GET /incidents
│
├── middleware/
│   ├── validateLocation.js      # lat/lng validation for all location routes
│   ├── requestLogger.js         # Structured request logging + request IDs
│   └── errorHandler.js          # Global error handler
│
├── utils/
│   ├── locationService.js       # Core: Google Maps → OSM → fallback logic
│   └── logger.js                # Winston logger (console + file)
│
├── data/
│   └── fallback.js              # Static emergency data (offline fallback)
│
├── logs/                        # Auto-created: app.log, error.log
├── tests/
│   └── api.test.js              # Integration tests (no deps)
│
├── .env.example                 # Environment variable template
├── .gitignore
└── package.json
```

---

## 🌐 API Endpoints

### Base URL: `http://localhost:5000`

---

### `GET /nearest-hospital`

Returns nearest trauma centers and hospitals sorted by distance.

**Query Parameters:**

| Param    | Type   | Required | Default | Description                   |
|----------|--------|----------|---------|-------------------------------|
| `lat`    | number | ✅ Yes   | —       | User latitude                 |
| `lng`    | number | ✅ Yes   | —       | User longitude                |
| `limit`  | number | No       | 10      | Max results (1–20)            |
| `radius` | number | No       | 5       | Search radius in km (max 25)  |

**Example Request:**
```
GET /nearest-hospital?lat=28.5672&lng=77.2100&limit=5
```

**Example Response:**
```json
{
  "success": true,
  "category": "hospital",
  "query": { "lat": 28.5672, "lng": 77.21, "radiusKm": 5, "limit": 5 },
  "meta": {
    "source": "openstreetmap",
    "total": 8,
    "returned": 5,
    "radiusKm": 5,
    "queriedAt": "2024-01-15T10:30:00.000Z"
  },
  "results": [
    {
      "id": "osm-123456",
      "name": "AIIMS Trauma Centre",
      "category": "hospital",
      "address": "Sri Aurobindo Marg, Ansari Nagar, New Delhi",
      "lat": 28.5672,
      "lng": 77.21,
      "distanceKm": 0.12,
      "distanceStr": "120 m",
      "phone": "011-2659-3800",
      "openingHours": "24×7",
      "source": "openstreetmap"
    }
  ]
}
```

---

### `GET /nearest-police`

Returns nearest police stations sorted by distance.

**Query Parameters:** Same as `/nearest-hospital`

**Example:**
```
GET /nearest-police?lat=28.5672&lng=77.2100
```

**Extra field in response:**
```json
{ "emergencyNumber": "100" }
```

---

### `GET /nearest-towing`

Returns nearest towing services, garages, and roadside assistance.

**Query Parameters:** Same as `/nearest-hospital`

**Example:**
```
GET /nearest-towing?lat=28.5672&lng=77.2100&radius=10
```

**Extra field in response:**
```json
{ "nhaiFreeHelpline": "1033" }
```

---

### `GET /challans`

Traffic fine calculator based on Motor Vehicles Amendment Act, 2019.

| Param       | Type   | Required | Description                             |
|-------------|--------|----------|-----------------------------------------|
| `violation` | string | No       | e.g. `speeding`, `drunk_driving`        |
| `vehicle`   | string | No       | `car`, `bike`, `truck`, `bus`, `auto`   |

**Without params** → Returns complete fine schedule.

**Violation codes:**
`speeding` · `drunk_driving` · `no_helmet` · `no_seatbelt` · `red_light`
`mobile_driving` · `wrong_side` · `no_insurance` · `no_licence` · `hit_run` · `overloading`

**Examples:**
```
GET /challans
GET /challans?violation=drunk_driving
GET /challans?violation=speeding&vehicle=bike
```

**Response (with violation + vehicle):**
```json
{
  "success": true,
  "results": [{
    "id": "drunk_driving",
    "label": "Drunk Driving (DUI)",
    "section": "Section 185 MV Act",
    "applicableFine": { "first": 10000, "repeat": 15000 },
    "imprisonment": "6 months (first), 2 years (repeat)",
    "licenceSuspend": true
  }]
}
```

---

### `POST /incidents/report`

Report a road incident (accident, pothole, breakdown, etc.)

**Request Body (JSON):**
```json
{
  "lat": 28.5672,
  "lng": 77.2100,
  "type": "accident",
  "description": "Head-on collision near NH-48 toll plaza, 2 vehicles",
  "severity": "high",
  "reporterPhone": "+91-9876543210"
}
```

| Field           | Required | Values                                                        |
|-----------------|----------|---------------------------------------------------------------|
| `lat`           | ✅       | -90 to 90                                                     |
| `lng`           | ✅       | -180 to 180                                                   |
| `type`          | ✅       | `accident` `breakdown` `road_hazard` `pothole` `flood` etc.   |
| `description`   | ✅       | 5–500 characters                                              |
| `severity`      | No       | `low` `medium` `high` `critical`                              |
| `reporterPhone` | No       | Contact number                                                |

**Response 201:**
```json
{
  "success": true,
  "message": "Incident reported successfully.",
  "incident": {
    "id": "a1b2c3d4-...",
    "type": "accident",
    "severity": "high",
    "status": "reported",
    "reportedAt": "2024-01-15T10:30:00Z"
  },
  "helpNumbers": { "emergency": "112", "police": "100" }
}
```

---

### `GET /incidents`

List recently reported incidents.

```
GET /incidents?type=accident&severity=high&limit=20
```

### `GET /incidents/:id`

Fetch a specific incident by UUID.

---

### `GET /health`

Server health check — used by monitoring tools.

```json
{
  "status": "healthy",
  "uptime": "3600s",
  "memory": { "heapUsed": "45 MB", "heapTotal": "70 MB" },
  "mapsSource": "OpenStreetMap (Overpass API)",
  "fallbackEnabled": true
}
```

---

## 🔑 Maps API Configuration

### Option A: No API Key (OpenStreetMap — Default)
Works out of the box. No signup needed.
Leave `GOOGLE_MAPS_API_KEY` blank in `.env`.

### Option B: Google Maps (Higher accuracy, more data)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Places API (Nearby Search)**
3. Create an API key
4. Add to `.env`:
   ```
   GOOGLE_MAPS_API_KEY=AIzaSy...yourkey...
   ```

> The server automatically switches to Google Maps when the key is present.

---

## 🛡️ Error Response Format

All errors return a consistent JSON shape:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "requestId": "uuid-for-tracing",
  "hint": "Optional guidance"
}
```

**HTTP Status Codes:**
| Code | Meaning                                   |
|------|-------------------------------------------|
| 200  | Success                                   |
| 201  | Created (incident reported)               |
| 400  | Bad request (invalid/missing params)      |
| 404  | Endpoint or resource not found            |
| 429  | Rate limit exceeded                       |
| 500  | Server error (check logs/)                |

---

## 📋 Environment Variables

```env
PORT=5000                          # Server port
NODE_ENV=development               # development | production

GOOGLE_MAPS_API_KEY=               # Optional — leave blank for OSM

ALLOWED_ORIGINS=http://localhost:3000   # CORS origins (prod)

DEFAULT_RADIUS_KM=5                # Default search radius
MAX_RESULTS=15                     # Max results per request
MAX_RADIUS_KM=25                   # Max allowed radius

LOG_LEVEL=info                     # error|warn|info|http|debug
LOG_TO_FILE=true                   # Write logs to ./logs/
```

---

## 🧪 Running Tests

```bash
# Terminal 1 — start the server
npm start

# Terminal 2 — run tests
npm test
```

Tests cover: root endpoint, health check, all 3 location APIs,
challan calculator, incident CRUD, validation errors, and 404 handling.

---

## 🔗 Connecting to the Frontend

In your RoadSoS React/HTML frontend:

```javascript
const API = "http://localhost:5000";

// Get nearest hospitals
const res = await fetch(`${API}/nearest-hospital?lat=${lat}&lng=${lng}&limit=5`);
const data = await res.json();
console.log(data.results);   // sorted by distance

// Report an incident
await fetch(`${API}/incidents/report`, {
  method : "POST",
  headers: { "Content-Type": "application/json" },
  body   : JSON.stringify({ lat, lng, type: "accident", description: "..." })
});
```

---

## 📡 Data Source Priority

```
Request received
      │
      ▼
┌─────────────────────────┐
│ GOOGLE_MAPS_API_KEY set? │──Yes──▶ Google Maps Places API
└─────────────────────────┘           (if fails, continue ↓)
      │ No
      ▼
┌──────────────────────────┐
│ OpenStreetMap Overpass   │──Success──▶ Return results
│ API (free, no key)       │
└──────────────────────────┘
      │ Fails (offline/timeout)
      ▼
┌──────────────────────────┐
│ Static JSON Fallback     │──Always works──▶ Return results
│ (data/fallback.js)       │
└──────────────────────────┘
```

---

## 🏆 Built For
**IIT Madras Road Safety Hackathon**
RoadSoS Project — Emergency Response Platform

Emergency Numbers (India):
- 🚨 **112** — National Emergency
- 🚑 **102** — Ambulance
- 🚓 **100** — Police
- 🔧 **1033** — NHAI Road Assistance
- 🚗 **1095** — Traffic Police
