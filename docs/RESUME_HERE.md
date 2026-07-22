# ▶ START HERE — resume the SOS maintenance build

> Continuing on a **different machine / location**? Read
> [`START_TOMORROW.md`](START_TOMORROW.md) — it walks through cloning fresh
> anywhere and getting a new Claude session up to speed.

_Always-current pointer. Read this first when you sit down at a machine._
_Last updated: 2026-07-22 (Sprint 4–6 wiring session)._

## Where we are
- **Sprint 1 (Foundation)** ✅ · **Sprint 2 (Domain layer)** ✅ · **Sprint 3 (UI + PWA)** ✅ · **Sprint 4–6 wiring** ✅ — implementation landed; live DB verification remains.
- **Tests:** `pnpm test` → **136 passing**. `pnpm typecheck`, `pnpm lint`, `pnpm build` all green.
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

## ⛔ External verification blocker
The DB-backed implementation is wired, but this machine has no configured
`DATABASE_URL` / live Postgres+PostGIS. Integration tests therefore fail at Prisma
initialization until a real DB is available. Docker remains the local option; Neon
is the planned free-cloud option.

## Next steps (in order)
1. **Live DB verification:** set `DATABASE_URL` to a real Postgres/PostGIS,
   run `pnpm db:setup`, then `pnpm test:integration` and capture the evidence.
2. **Sprint 5 auth completion:** implement the real self-hosted Keycloak OIDC +
   TOTP session path (the accepted ADR 0002 choice), replacing the deny-by-default
   provider stub while keeping server-side RBAC/object authorization.
3. **Sprint 6 completion:** extend REST coverage for mobile sync and remaining
   doc 08 interfaces, each using the Zod DTOs and a service.
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
