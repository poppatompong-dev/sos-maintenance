# ระบบบริหารซ่อมบำรุงเสา SOS — เทศบาลนครนครสวรรค์

เว็บ PWA ภายในสำหรับสำรวจ ตรวจบำรุง ซ่อม ตรวจรับ และรายงานความพร้อมของเสาขอความ
ช่วยเหลือฉุกเฉิน (SOS) 27 จุด (EP01–EP27) ตอบได้ทันทีว่าเสาใด **พร้อมใช้ / เฝ้าระวัง /
ใช้งานไม่ได้ / ยังไม่ทราบ** พร้อมสืบย้อนกลับถึงหลักฐาน

> Requirements & decisions live in the project's `docs/` handoff pack (01–09).
> Source-of-truth order: doc 07 (latest decision) > 01/06 > 03–05 > 08 > prototype.

## Stack (free / open-source core — no paid dependency)
Next.js (App Router) + TypeScript · PostgreSQL + PostGIS (Prisma) · Keycloak
(OIDC + TOTP MFA) · Service Worker + IndexedDB offline · MapLibre/Leaflet + OSM
online tiles · Playwright PDF · ExcelJS · Nodemailer/SMTP · PostgreSQL-backed
worker · Docker Compose + Caddy · Vitest + Playwright.

## Prerequisites
- Node 22+ and pnpm 10+
- Docker Desktop (for Postgres/PostGIS, Keycloak, dev SMTP)

## Quick start (local dev)
```bash
cp .env.example .env            # placeholders only — no secrets
pnpm install
docker compose up -d            # postgres-postgis, keycloak, mailpit
pnpm db:setup                   # migrate + enable PostGIS + seed 27 poles
pnpm dev                        # http://localhost:3000
pnpm worker:dev                 # background worker (separate terminal)
```
Dev mail UI: http://localhost:8025 · Keycloak: http://localhost:8080 (admin/admin)

> First run needs the initial migration: `pnpm db:migrate` (creates it from the
> schema), then `pnpm db:postgis && pnpm db:seed`. `pnpm db:setup` chains
> deploy+postgis+seed for subsequent runs/CI.

## Scripts
| Script | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js app |
| `pnpm worker` / `pnpm worker:dev` | background job worker |
| `pnpm typecheck` · `pnpm lint` | static checks |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm db:migrate` · `pnpm db:postgis` · `pnpm db:seed` | DB lifecycle |
| `pnpm db:setup` | migrate deploy + postgis + seed (CI/prod) |
| `pnpm db:studio` | Prisma Studio |

## Project structure
```
src/
  app/                 Next.js routes (role-aware shell — WIP)
  domain/              pure business logic, no IO
    readiness/         readiness engine + reason codes + tests
    shared/            pure helpers (dates)
  server/
    db/client.ts       Prisma singleton
  worker/main.ts       background scheduler
prisma/
  schema.prisma        20+ entities (generic CMMS core)
  sql/                 PostGIS setup (geography + GiST)
  seed.ts, seed-data/  27-pole registry + checklists + plans
infra/                 Dockerfiles, Caddyfile, Keycloak realm, backup.sh
docs/adr/              architecture decision records
requirements-traceability.csv   requirement -> impl -> test -> evidence
```

## Testing
`pnpm test` runs Vitest (domain + seed-data). The readiness engine has full
coverage of every status transition and the 7-day grace boundary. DB-backed
integration/E2E come online in later sprints (see `.github/workflows/ci.yml`).

## Deployment
`docker-compose.prod.yml` runs caddy + app + worker + postgres-postgis + keycloak
+ daily backup. Copy `.env.prod.example` → `.env.prod` (real secrets, never
committed) and: `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d`.

## Status
Sprint 1 (Foundation) — see `requirements-traceability.csv`. Not production-ready
until the delivery gate in `docs/06_DELIVERY_QA_UAT.md` is met.
