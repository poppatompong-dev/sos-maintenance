# ▶ START HERE — resume the SOS maintenance build

> Continuing on a **different machine / location**? Read
> [`START_TOMORROW.md`](START_TOMORROW.md) — it walks through cloning fresh
> anywhere and getting a new Claude session up to speed.

_Always-current pointer. Read this first when you sit down at a machine._
_Last updated: 2026-07-21 (late evening, autonomous session)._

## Where we are
- **Sprint 1 (Foundation)** ✅ · **Sprint 2 (Domain layer)** ✅ · **Sprint 3 (UI + PWA)** ✅ — all done, tested, pushed.
- **Tests:** `pnpm test` → **129 passing**. `pnpm typecheck`, `pnpm lint`, `pnpm build` all green.
- **Running app (no Docker needed):** `pnpm dev` → `/` control-centre dashboard, `/today` technician field shell (installable PWA).
- **Repo:** https://github.com/poppatompong-dev/sos-maintenance (private, branch `main`).
- **What works end-to-end today:** the whole domain (readiness, recurrence, geo,
  work state machine, fault, metrics, RBAC, sync, import, notifications) + two UI
  shells rendering the *true* initial state (27 poles UNKNOWN until surveyed).

## Get running
**On this (home) machine** — code is at `C:\dev\sos-maintenance`:
```powershell
cd C:\dev\sos-maintenance
git pull
pnpm install          # if deps changed
pnpm test             # confirm green
pnpm dev              # http://localhost:3000
```
**On a NEW machine (work PC):** follow `docs/DEVELOPING.md` →
```powershell
git clone https://github.com/poppatompong-dev/sos-maintenance.git C:\dev\sos-maintenance
cd C:\dev\sos-maintenance
pwsh ./scripts/bootstrap.ps1
```

## ⛔ One blocker to clear
**Docker Desktop is not installed yet.** Everything DB-backed is written but unrun
until Docker is available:
- `pnpm db:migrate` (create the first migration) → `pnpm db:postgis` → `pnpm db:seed`
- Keycloak / Caddy / integration + E2E tests
Install Docker Desktop, then `docker compose up -d` and the above.

## Next steps (in order)
1. **Sprint 4 — DB wiring** (needs Docker Desktop): install Docker →
   `docker compose up -d` → `pnpm db:migrate` (creates the first migration) →
   `pnpm db:postgis` → `pnpm db:seed`. Then implement Prisma repositories behind
   the service ports (`src/server/services/submit-inspection.ts` defines
   `InspectionPort` — write a Prisma adapter), point the dashboard query
   (`src/server/queries/readiness-overview.ts`) at the DB, and enable the CI
   `integration` job (flip `if: false` in `.github/workflows/ci.yml`).
2. **Sprint 5 — Auth**: Keycloak OIDC login + session; enforce the RBAC policy
   (`src/domain/authz/policy.ts`, already tested) on every route/server action.
3. **Sprint 6 — REST API routes** for doc 08 §Interface (assets, work-orders,
   faults, mobile sync…), each parsing with the Zod DTOs and calling a service.
4. **UI depth**: asset detail page, work-order list, Planner calendar (direction
   C), wire the online MapLibre map (accessible list fallback already built).

## Map of the code
- `src/domain/**` — pure business logic (readiness, recurrence, geo, work state
  machine, fault, checklist, metrics, authz, sync, thai-date) — fully unit-tested.
- `src/server/**` — services (ports + `submitInspection`), DTOs, Prisma client.
- `src/worker/main.ts` — background scheduler scaffold.
- `prisma/**` — schema, PostGIS SQL, 27-pole seed.
- `infra/**` — Docker/Caddy/Keycloak/backup.
- `docs/adr/**` — decisions · `requirements-traceability.csv` — req→test map.
- `docs/WORKLOG.md` — full chronological history + decisions.

## Daily habit
`git pull` at the start, `git push` at the end. The build is designed so nothing
but git needs to travel between machines.
