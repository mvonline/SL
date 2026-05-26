# Deployment (GitHub Pages + Backend)

GitHub hosts the **frontend** only. The **backend** runs on a cloud host (Render recommended) because it needs Node.js, SQLite, and Redis.

## Architecture

| Component | Host | URL pattern |
|-----------|------|-------------|
| Frontend | GitHub Pages (custom domain OK) | e.g. `https://vafa.one/SL/` or `https://<user>.github.io/<repo>/` |
| Backend API | Render (or GHCR + your server) | `https://sthlmtransit-api.onrender.com` |
| Redis | Render managed Redis | internal |

## 1. Deploy backend (Render)

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect the repository; Render reads `render.yaml`.
4. After deploy, open the **sthlmtransit-api** service and copy its URL (e.g. `https://sthlmtransit-api.onrender.com`).
5. In Render **Environment**, set:
   - `FRONTEND_URL` = your site **origin** (scheme + host only). Examples:
     - Custom domain: `https://vafa.one` (app lives at `https://vafa.one/SL/` — do **not** put `/SL/` in `FRONTEND_URL`; browsers send `Origin: https://vafa.one`)
     - GitHub Pages: `https://<username>.github.io` or the full project URL; the path is stripped automatically

Free tier: the API may sleep after inactivity; first request can take ~30s.

### Optional: GHCR Docker image

Workflow `.github/workflows/publish-backend-image.yml` publishes:

`ghcr.io/<owner>/<repo>/backend:latest` (image path is lowercased, e.g. `ghcr.io/mvonline/sl/backend:latest` for repo `SL`)

Pull and run with Redis URL and env vars from `render.yaml`.

## 2. Deploy frontend (GitHub Pages)

1. Repo **Settings** → **Pages** → **Source**: **GitHub Actions**.
2. Push to `main` / `master` — workflow `Deploy GitHub Pages` runs automatically.
3. Point the frontend at your API (pick one):
   - **Easiest:** edit `frontend/public/config.json` and set `apiBase` to `https://<your-render-service>.onrender.com/api`, then push (redeploys Pages).
   - **Optional:** repo **Settings** → **Secrets and variables** → **Actions** → **Variables** → `VITE_API_BASE` = same URL (overrides `config.json` at build time).

4. Re-run **Actions → Deploy GitHub Pages** (or push a commit).

Without a configured API URL, the site still shows **offline stations** on the map but routing, departures, and login need the backend.

The file `frontend/public/stations-map-fallback.json` must be committed to git (CI does not read the backend seed). To refresh it locally: `npm run generate:fallback-stations` from `frontend/` when the full monorepo is present.

## 3. Local development

```bash
docker compose up
```

- Frontend: http://localhost:5173  
- Backend: http://localhost:3000/api  

## 4. Verify

- Backend health: `https://<api-host>/health`
- Pages app loads at your URL (e.g. [https://vafa.one/SL/](https://vafa.one/SL/)); log in and run **Admin sync** once to seed stations.
