# ▶ START HERE — resume the SOS maintenance build

> Continuing on a **different machine / location**? Read
> [`START_TOMORROW.md`](START_TOMORROW.md) — it walks through cloning fresh
> anywhere and getting a new Claude session up to speed.

_Always-current pointer. Read this first when you sit down at a machine._
_Last updated: 2026-07-22 (Sprint 4–6 wiring session)._

## Where we are
- **Sprint 1 (Foundation)** ✅ · **Sprint 2 (Domain layer)** ✅ · **Sprint 3 (UI + PWA)** ✅ · **Sprint 4–6 wiring** ✅ — implementation is in the working tree and the DB-backed integration gate is green.
- **Tests:** `pnpm test` → **166 passing**; `pnpm test:integration` → **41 passing** against Neon. `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check` are green.
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

## ✅ DB verification complete / next external gate
The supplied Neon production branch is connected and verified. Migration
`20260722090000_schedule_batch_created_by` was deployed, Prisma Client was
regenerated, and the full DB-backed integration suite passed (**41 tests in 8
files**), including worker-claim concurrency, schedule approval SoD, legacy
creator rejection, and concurrent work-order code allocation. Do not commit the
connection string; keep it in deployment/local secret configuration only.

## Next steps (in order)
1. **Release review:** review the complete working tree, update the CI/protected
   path as required, then create the controlled commit and push to `main`.
2. **Auth e2e:** run the real self-hosted Keycloak OIDC + TOTP flow (the accepted
   ADR 0002 choice) with live issuer/JWKS; server-side RBAC/object authorization
   remains mandatory.
3. **Vercel gate:** configure `DATABASE_URL`, `CRON_SECRET`, and the production
   deployment, then verify the deployed cron endpoint and smoke test.
4. **Security:** rotate the Neon password/connection secret before production,
   because the credential was exposed during setup communication.
5. **Later product depth:** reports, online MapLibre map (accessible list fallback
   already built), and remaining doc 08 interfaces.

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
