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
| `AUTH_DEV_BYPASS` | *(leave UNSET, or `false`)* | ⛔ never `true` in production |
| `KEYCLOAK_ISSUER` | `https://<kc-host>/realms/sos` | OIDC issuer |
| `KEYCLOAK_CLIENT_ID` | `sos-web` | for per-client role claims |
| `KEYCLOAK_CLIENT_SECRET` | *(secret)* | if using confidential client |
| `AUTH_SECRET` | long random string | session/crypto |
| `APP_BASE_URL` | `https://<your-app>.vercel.app` | |
| `TZ` | `Asia/Bangkok` | |
| `READINESS_GRACE_DAYS` | `7` | |
| `GPS_EXCEPTION_METERS` | `100` | |
| `NEXT_PUBLIC_MAP_TILE_URL` | OSM tile URL | client-visible |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | `© OpenStreetMap contributors` | client-visible |

With `AUTH_DEV_BYPASS` unset, the app is **auth-secure by default**: every API
requires a valid Keycloak `Authorization: Bearer <jwt>` and denies otherwise.

## 4. Deploy & verify

- Push to `main` → Vercel builds & deploys.
- Smoke test (needs a real Keycloak token once auth is live):
  `GET /api/readiness/overview` → 200 with the 27-pole rollup;
  without a token → 401.

## 5. Hobby cron limitation and not-on-Vercel components

Vercel Hobby permits only one cron execution per day. The repository therefore
uses `0 0 * * *` for `/api/jobs/tick` (midnight UTC / 07:00 Asia/Bangkok). An
hourly schedule requires Vercel Pro or another scheduler such as GitHub Actions
calling the same endpoint with `CRON_SECRET`.

- **Background worker** (`pnpm worker`) — long-running; Vercel is serverless.
  The daily Hobby cron is available now; use a scheduled **GitHub Actions**
  workflow or Vercel Pro if hourly processing is required.
- **Keycloak** — needs an always-on host (JVM + its own DB). Run it somewhere
  persistent (or a hosted IdP) and point `KEYCLOAK_ISSUER` at it.
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
