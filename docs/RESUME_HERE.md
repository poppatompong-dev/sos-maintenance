# ▶ START HERE — resume the SOS maintenance build

_Always-current pointer. Read this first when you sit down at a machine._
_Last updated: 2026-07-21 (evening, autonomous session)._

## Where we are
- **Sprint 1 (Foundation)** ✅ and **Sprint 2 (Domain layer)** ✅ — done, tested, pushed.
- **Sprint 3 (UI)** 🚧 in progress (see WORKLOG for the live state).
- **Tests:** run `pnpm test` — everything committed is green.
- **Repo:** https://github.com/poppatompong-dev/sos-maintenance (private, branch `main`).

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
1. **Finish Sprint 3 UI** (no Docker needed): design tokens → Dashboard A shell →
   Technician B shell → build + browser screenshot. (live progress in WORKLOG)
2. **Sprint 4 — DB wiring** (needs Docker): Prisma repositories implementing the
   service ports (`src/server/services/*`), first migration, then run the
   `submitInspection` slice against a real DB; enable the CI `integration` job.
3. **Sprint 5 — Auth**: Keycloak realm wiring + OIDC login + server RBAC on routes
   (policy already in `src/domain/authz`).
4. **Sprint 6 — REST API routes** for the resources in doc 08 §Interface.

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
