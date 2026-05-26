# Deployment (GitHub Pages only)

SthlmTransit runs entirely in the browser on **GitHub Pages** — no backend server required.

| Piece | Where |
|-------|--------|
| Frontend | GitHub Pages (e.g. [https://vafa.one/SL/](https://vafa.one/SL/)) |
| Station database | `frontend/public/stations-map-fallback.json` (offline, committed) |
| Live data | Browser → [SL Transport API](https://transport.integration.sl.se/v1), [SL Journey Planner](https://journeyplanner.integration.sl.se/v2), OSRM |

## Deploy frontend

1. Repo **Settings** → **Pages** → **Source**: **GitHub Actions**.
2. Push to `main` / `master` — workflow **Deploy GitHub Pages** runs automatically.
3. Custom domain (optional): point `vafa.one` at GitHub Pages; build uses `VITE_BASE_URL=/SL/` when the repo is named `SL`.

Production builds set `VITE_STATIC_MODE=true` so the app never calls a BFF.

## Refresh offline stations

From `frontend/` when the full monorepo is present:

```bash
npm run generate:fallback-stations
```

Commit the updated `public/stations-map-fallback.json`.

## Local development

**Static (same as Pages):**

```bash
cd frontend
npm install
npm run dev:static
```

**With optional backend** (docker compose + BFF):

```bash
docker compose up
cd frontend && npm run dev
```

Set `VITE_STATIC_MODE=false` and `VITE_API_BASE=http://localhost:3000/api` to use the backend locally.

## Optional backend (Render / GHCR)

The `backend/` folder and `render.yaml` are optional for self-hosting or local dev. They are **not** required for GitHub Pages.
