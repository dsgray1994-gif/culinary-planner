# Culinary Planner (Coolify)

This project is configured for **Coolify** deployment using `docker-compose.yml`.

## Services

- `db`: Postgres 16
- `api`: FastAPI backend (`/health`, `/projects`, `/discover/search`, `/ai/step`)
- `web`: React/Vite static app served by nginx and proxied to API under `/api`

## Local run with Docker

```bash
docker compose up --build
```

Open: `http://localhost:8080`

## Required environment variables

Copy `.env.example` to `.env` and set:

- `POSTGRES_PASSWORD`
- `OPENAI_API_KEY` (optional for placeholder AI step, but recommended)
- `CORS_ORIGINS` (default `*`)
- `VITE_API_BASE` (default `/api`)

## Coolify deployment (recommended)

1. Push repository to GitHub.
2. In Coolify, create a new **Docker Compose** resource from this repo.
3. Use `docker-compose.yml` in repo root.
4. Add environment variables from `.env.example`.
5. Deploy.
6. Attach your domain to the `web` service.
7. Verify health:
   - `https://<api-domain>/health`
   - `https://<web-domain>`

## Windows automation script

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-all.ps1 \
  -RepoUrl "https://github.com/dsgray1994-gif/culinary-planner.git" \
  -CoolifyUrl "https://app.coolify.io" \
  -ApiBase "https://<api-domain>" \
  -WebBase "https://<web-domain>"
```

## Smoke check script

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\render-check.ps1 \
  -ApiBase "https://<api-domain>" \
  -WebBase "https://<web-domain>"
```
