# Deployment (GitHub Pages)

The live app is a **static** React build: offline stations + browser calls to SL/OSRM APIs. No backend required for [https://map.vafa.one/](https://map.vafa.one/).

## Why local and production HTML look different

| | Local (`npm run dev`) | Production (GitHub Pages) |
|--|----------------------|---------------------------|
| JS | `/src/main.tsx` + Vite dev server | `/assets/index-*.js` (bundled) |
| Base path | `/` | Set at build time (`VITE_BASE_URL`) |

That difference is normal. A **blank page** on the web almost always means the **base path is wrong** (browser 404 on JS/CSS).

## Custom domain vs github.io

GitHub serves a **project** site on a custom domain at the **root**:

- `https://map.vafa.one/` → assets must be `/assets/...` → **`VITE_BASE_URL=/`**
- `https://<user>.github.io/SL/` → assets must be `/SL/assets/...` → **`VITE_BASE_URL=/SL/`**

If the build uses `/SL/` but you open `map.vafa.one`, the HTML loads but `/SL/assets/*.js` returns **404** and the app stays blank.

### Fix for map.vafa.one

1. Repo **Settings** → **Secrets and variables** → **Actions** → **Variables**
2. Add **`VITE_BASE_URL`** = `/` (just a slash)
3. Re-run **Deploy GitHub Pages** (or push a commit)

After deploy, view source should show:

```html
<script src="/assets/index-….js"></script>
```

not `/SL/assets/…`.

`frontend/public/CNAME` contains `map.vafa.one` so GitHub Pages keeps the custom domain.

## Deploy frontend

1. **Settings** → **Pages** → **Source**: **GitHub Actions**
2. Push to `main` / `master`
3. Optional variable: `VITE_BASE_URL` — `/` for custom domain root, or omit for default `/<repo-name>/`

## Local development

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Refresh offline stations

```bash
cd frontend
npm run generate:fallback-stations
```

Commit `public/stations-map-fallback.json`.

## Optional backend

`backend/` and Docker/GHCR workflows are only for self-hosting or local `docker compose` — not needed for GitHub Pages.
