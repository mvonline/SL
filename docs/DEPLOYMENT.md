# Deployment (GitHub Pages + Backend)

GitHub hosts the **frontend** only. The **backend** runs on a cloud host (Render recommended) because it needs Node.js, SQLite, and Redis.

## Architecture

| Component | Host | URL pattern |
|-----------|------|-------------|
| Frontend | GitHub Pages | `https://<user>.github.io/<repo>/` |
| Backend API | Render (or GHCR + your server) | `https://sthlmtransit-api.onrender.com` |
| Redis | Render managed Redis | internal |

## 1. Deploy backend (Render)

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect the repository; Render reads `render.yaml`.
4. After deploy, open the **sthlmtransit-api** service and copy its URL (e.g. `https://sthlmtransit-api.onrender.com`).
5. In Render **Environment**, set:
   - `FRONTEND_URL` = `https://<your-github-username>.github.io/<repo-name>/` (no trailing path after repo name unless you use one)

Free tier: the API may sleep after inactivity; first request can take ~30s.

### Optional: GHCR Docker image

Workflow `.github/workflows/publish-backend-image.yml` publishes:

`ghcr.io/<owner>/<repo>/backend:latest`

Pull and run with Redis URL and env vars from `render.yaml`.

## 2. Deploy frontend (GitHub Pages)

1. Repo **Settings** → **Pages** → **Source**: **GitHub Actions**.
2. Push to `main` / `master` — workflow `Deploy GitHub Pages` runs automatically.
3. **Settings** → **Secrets and variables** → **Actions** → **Variables**:
   - `VITE_API_BASE` = `https://sthlmtransit-api.onrender.com/api`  
     (use your real Render URL + `/api`)

Rebuild Pages after changing `VITE_API_BASE` (re-run workflow or push a commit).

## 3. Local development

```bash
docker compose up
```

- Frontend: http://localhost:5173  
- Backend: http://localhost:3000/api  

## 4. Verify

- Backend health: `https://<api-host>/health`
- Pages app loads map; log in and run **Admin sync** once to seed stations.
