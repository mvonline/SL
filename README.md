# SthlmTransit — Stockholm Multimodal Transit System & BFF

SthlmTransit is a highly responsive, scalable, and resilient Single Page Application (SPA) designed to browse, route, and audit Stockholm's public transportation network. 

The architecture follows the **Antigravity** philosophy: lean, elegant, highly cohesive, and loosely coupled code with zero heavy dependencies or unnecessary boilerplate. The entire system runs **strictly inside Docker** with persistent storage, volatile caches, and daily rotated communication logs.

---

## 🏗️ Core System Architecture

### 1. Dual-Key Caching & Fallback Circuit Breaker
To prevent overloading Stockholm's central SL APIs and protect client-side bandwidth, the BFF gateway coordinates a dual-key Redis strategy:
- **`departures:live:${siteId}`** (15-second TTL): Protects SL servers by caching fresh timetables.
- **`departures:fallback:${siteId}`** (24-hour TTL): Acts as a historical archive to support graceful degradation.
- **Graceful Fail-safe:** If the external SL API experiences downtime, rate limits, or network errors, the circuit breaker intercepts the error, queries the 24h fallback cache key, and responds with `source: "cache_fallback"`. The React client displays a non-blocking amber warning alert in the UI to notify the user.

### 2. Spatial Progressive Map Rendering
Serving thousands of stations at once degrades map rendering performance. We implement a progressive zoom-based rendering query in SQLite:
- **Zoom < 12:** Queries and returns major transport hubs only (e.g. *T-Centralen*).
- **Zoom 12-13:** Includes subway, commuter rail links (*pendeltåg*), and light rail (*tvärbanan*).
- **Zoom >= 14:** Loads all stops (including minor street bus stops) strictly within the viewport's bounding box coordinates.

### 3. Winston Daily Rotated Logs & Cost Analyser
- Every external API connection (endpoint, status code, latency, and credit weights) is logged to `/var/log/transit/api-YYYY-MM-DD.log` inside a persisted volume.
- The **Cost Analyser** logs usage statistics into a SQLite `api_logs` table, exposing simulated credits costs (e.g., departures = 1 credit, routing = 5 credits, seeding = 10 credits) on the administrative dashboard.

### 4. Zero-Dependency JWT Authentication
To bypass Native C++ binding issues (such as `bcrypt` compilation crashes on Alpine images), SthlmTransit relies on **Node's native `crypto.scrypt`** hashing. Verified session signatures are tracked against a Redis-backed blacklist on logout.

---

## 📂 Codebase Directory Layout

```text
sl/
├── docker-compose.yml       # Docker multi-container orchestrator
├── README.md                # Comprehensive documentation
├── backend/
│   ├── Dockerfile           # Alpine Node.js TS compiler image
│   ├── package.json         # Fastify, better-sqlite3, ioredis, winston, node-cron
│   ├── tsconfig.json        # NodeNext modern TS compiler configuration
│   └── src/
│       ├── index.ts         # Fastify bootstrap & CORS registration
│       ├── db/              # SQLite connectors and WAL migrations schema
│       ├── middleware/      # JWT validation and Redis blacklist check guards
│       ├── services/        # Redis, Winston Logger, Cost Analyser, and Seed syncing
│       └── routes/          # Auth, Stations, Departures, Routing, and Admin portals
└── frontend/
    ├── Dockerfile           # Vite React hot-module reloading container
    ├── package.json         # React 18, Leaflet, TanStack Query, and Tailwind CSS v4
    ├── index.html           # HTML5 shell loading Outfit/Inter Google fonts & Leaflet CDN
    └── src/
        ├── index.css        # Tailwind v4 directives and custom glassmorphism styles
        ├── App.tsx          # Dashboard sidebar, Departures table, and warning overlays
        ├── components/      # Map.tsx (Programmatic marker clustering and progressive zooms)
        └── services/        # ApiClient fetch and token attachment helpers
```

---

## ⚡ Quick Start (Docker Composition)

Build and launch the complete stack (Fastify BFF, Redis, Vite Frontend, and SQLite volumes) in detached mode:

```bash
docker compose up --build -d
```

### Exposed Port Allocations
- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Backend BFF Gate:** [http://localhost:3000](http://localhost:3000)
- **Gate Health Check:** [http://localhost:3000/health](http://localhost:3000/health)

### Persistence & Volume Mappings
- **SQLite Database:** Mapped to volume `transit-sqlite-data` to preserve user profiles, seeded stations, and cost analyser metrics.
- **Daily Rotated Logs:** Mapped to volume `transit-logs` at host directory `/var/log/transit`.

---

## 🔌 Core API Endpoints

### Authentication
- `POST /api/auth/signup`: Registers username and password, returning JWT access token.
- `POST /api/auth/login`: Validates credentials, returning JWT access token.
- `POST /api/api/auth/logout` (Guard): Blacklists JWT token in Redis for its remaining time-to-live.

### Transit Operations
- `GET /api/stations` (Query: `minLat, maxLat, minLon, maxLon, zoom`): Retrieves progressive stations list based on zoom thresholds.
- `GET /api/departures/:siteId`: Retrieves live station departures (checks live cache, SL server, and fallback cache).
- `GET /api/routing` (Query: `fromLat, fromLon, toLat, toLon, mode`): Computes walking/driving routes (via OSRM) or color-coded public transport transit legs.

### Administrative Control
- `POST /api/admin/sync`: Triggers manual synchronization of SL static stations database.
- `GET /api/admin/stats`: Returns aggregated API logs, credit balances, average latencies, and cache-fallback incidents.
