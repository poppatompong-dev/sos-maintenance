# ระบบบริหารซ่อมบำรุงเสา SOS — เทศบาลนครนครสวรรค์

เว็บ PWA ภายในสำหรับสำรวจ ตรวจบำรุง ซ่อม ตรวจรับ และรายงานความพร้อมของเสาขอความ
ช่วยเหลือฉุกเฉิน (SOS) 27 จุด (EP01–EP27) ตอบได้ทันทีว่าเสาใด **พร้อมใช้ / เฝ้าระวัง /
ใช้งานไม่ได้ / ยังไม่ทราบ** พร้อมสืบย้อนกลับถึงหลักฐาน

> **Docs:** start at the [`docs/` index](docs/README.md) →
> [`RESUME_HERE`](docs/RESUME_HERE.md) (current state + next steps),
> [`ARCHITECTURE`](docs/ARCHITECTURE.md) (how the code fits together),
> [`START_TOMORROW`](docs/START_TOMORROW.md) (continue from another machine, with
> ready-to-use prompts). Requirements live in [`docs/spec/`](docs/spec)
> (source-of-truth order: 07 > 01/06 > 03–05 > 08 > prototype).

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

| Area | State |
|---|---|
| Domain logic — readiness, recurrence, geo/GPS, work state machine, fault, metrics, RBAC, offline sync, import, notifications | ✅ done · **129 tests** |
| Data model — Prisma schema (20+ entities), 27-pole seed, PostGIS | ✅ schema+seed · ⏳ migration run needs Docker |
| UI — control-centre Dashboard (A), Technician field shell (B), installable PWA | ✅ done · browser-verified (a11y + WCAG AA) |
| DB wiring — Prisma repositories behind the service ports, migrations | ⏳ Sprint 4 (needs Docker) |
| Auth — Keycloak OIDC/MFA + per-route RBAC enforcement | ⏳ Sprint 5 (policy done + tested) |
| REST API routes · offline IndexedDB sync · reports (PDF/Excel) · MapLibre map | ⏳ later sprints |

`pnpm test` → 129 passing; `typecheck` / `lint` / `build` green. Not production-ready
until the delivery gate in [`docs/spec/06_DELIVERY_QA_UAT.md`](docs/spec/06_DELIVERY_QA_UAT.md)
is met. Progress detail in [`requirements-traceability.csv`](requirements-traceability.csv).
