# Deploying to Vercel (free) + Neon Postgres

The Next.js app deploys to **Vercel Hobby (free)** against **Neon Postgres +
PostGIS**. This is the app only — the background **worker is not on Vercel**
(see the bottom).

> Hobby is non-commercial; a real municipal production deployment may later need
> a paid Vercel plan. Fine for build / UAT / demo.

## 1. One-time: prepare the database (Neon)

Neon gives two connection strings for the same database:

| Use | Host | Notes |
|---|---|---|
| **Runtime** (the app) | `...-pooler...` (pooled) | add `?sslmode=require&pgbouncer=true` — pooled + Prisma-safe |
| **Migrations** (`prisma migrate deploy`) | non-pooler (direct) | add `?sslmode=require` |

Run migrations + PostGIS + seed **once** from your machine/CI against the
**direct** URL:

```bash
DATABASE_URL="postgresql://<user>:<pw>@<project>.<region>.aws.neon.tech/neondb?sslmode=require" \
  pnpm db:setup      # = prisma migrate deploy && db:postgis && db:seed
```

PostGIS is available on Neon — the init migration already runs
`CREATE EXTENSION IF NOT EXISTS "postgis"`, and `db:postgis` adds the generated
`geog` columns + GiST indexes.

## 2. Import the repo into Vercel

Vercel auto-detects Next.js. `vercel.json` in this repo pins:
- `buildCommand: "prisma generate && next build"` — generates the Prisma client
  on every build (required; Vercel caches `node_modules`).
- `regions: ["iad1"]` — US East, co-located with Neon `us-east-1` for low DB
  latency.

Node is pinned to 22 via `engines` + `.nvmrc`.

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** URL + `?sslmode=require&pgbouncer=true` | runtime DB |
| `AUTH_MODE` | `internal` | no-login mode; use only behind a trusted internal network/private deployment |
| `KEYCLOAK_ISSUER` | optional | used only when `AUTH_MODE=keycloak` |
| `KEYCLOAK_CLIENT_ID` | optional | used only when `AUTH_MODE=keycloak` |
| `KEYCLOAK_CLIENT_SECRET` | optional secret | used only when `AUTH_MODE=keycloak` |
| `AUTH_SECRET` | optional | not used by `AUTH_MODE=internal` |
| `APP_BASE_URL` | `https://<your-app>.vercel.app` | |
| `TZ` | `Asia/Bangkok` | |
| `READINESS_GRACE_DAYS` | `7` | |
| `GPS_EXCEPTION_METERS` | `100` | |
| `NEXT_PUBLIC_MAP_TILE_URL` | OSM tile URL | client-visible |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | `© OpenStreetMap contributors` | client-visible |

With `AUTH_MODE=internal`, the app has **no login screen and no bearer-token
requirement**. Every request runs as the internal operator and receives all
application permissions. This is acceptable only when the deployment is
network-restricted; a public Vercel URL is not an internal network boundary.

## 4. Deploy & verify

- Push to `main` → Vercel builds & deploys.
- Smoke test in the current internal mode:
  `GET /api/readiness/overview` → 200 with the 27-pole rollup;
  `GET /api/sync/bootstrap` → 200 with the open field work package.

## 5. Hobby cron limitation and not-on-Vercel components

Vercel Hobby permits only one cron execution per day. The repository therefore
uses `0 0 * * *` for `/api/jobs/tick` (midnight UTC / 07:00 Asia/Bangkok). An
hourly schedule requires Vercel Pro or another scheduler such as GitHub Actions
calling the same endpoint with `CRON_SECRET`.

- **Background worker** (`pnpm worker`) — long-running; Vercel is serverless.
  The daily Hobby cron is available now; use a scheduled **GitHub Actions**
  workflow or Vercel Pro if hourly processing is required.
- **Keycloak** — optional while `AUTH_MODE=internal`; it remains available for
  a later protected deployment if policy changes.
- **File storage** — local `var/uploads` in V1; move to S3-compatible for a
  serverless host (no domain change — `STORAGE_DRIVER`).

## Optional: make `prisma migrate` use a direct URL automatically

Add a `directUrl` to `prisma/schema.prisma` so migrations never go through the
pooler:

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")   // pooled at runtime
  directUrl  = env("DIRECT_URL")     // non-pooler, for migrate
  extensions = [postgis]
}
```

Then set `DIRECT_URL` (non-pooler) alongside `DATABASE_URL` wherever you run
migrations.
