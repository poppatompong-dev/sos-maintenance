# ▶ START HERE — resume the SOS maintenance build

> Continuing on a **different machine / location**? Read
> [`START_TOMORROW.md`](START_TOMORROW.md) — it walks through cloning fresh
> anywhere and getting a new Claude session up to speed.

_Always-current pointer. Read this first when you sit down at a machine._
_Last updated: 2026-07-23 (CI pnpm fix + DB integration confirmed green)._

**ดูสถานะ milestone และหลักฐานล่าสุด:** [`ROADMAP_CHECKPOINT.md`](ROADMAP_CHECKPOINT.md)

**เปิด Codex session ใหม่/เปลี่ยนบัญชี:** อ่าน [`SESSION_HANDOFF_CODEX.md`](SESSION_HANDOFF_CODEX.md)
แล้วส่งต่อ [`HANDOFF_CLAUDE.md`](HANDOFF_CLAUDE.md) ให้ Claude Code

## Where we are
- **Sprint 1 (Foundation)** ✅ · **Sprint 2 (Domain layer)** ✅ · **Sprint 3 (UI + PWA)** ✅ · **Sprint 4–6 wiring** ✅ — implementation is in the working tree and the DB-backed integration gate is green.
- **Tests:** `pnpm test` → **167 passing** (21 files); DB-backed integration is now **41/41 passing (8 files) confirmed green in CI** on the ephemeral PostGIS service (Actions run 29977349490, commit `8ae02f9`). `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check` are green. The **CI pnpm version mismatch is fixed (DONE)**.
- **This machine has neither Docker nor psql**, so hands-on `/today` workflow UAT still needs a controlled local/staging DB. Do **not** fabricate production work orders.
- **Current workflow slice:** `/today` now loads the real sync bootstrap, shows open field work orders, starts assigned work, captures GPS/checklist results, submits idempotent evidence, and advances the work order to `SUBMITTED`. Production shell/API smoke passed and post-change DB integration is **confirmed green in CI (41/41, 8 files)**; the only remaining item is interactive happy-path smoke, which still needs an open-work-order fixture on a non-production DB.
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

## ✅ DB verification complete / CI integration green
The DB-backed integration suite passes **41/41 in 8 files** on CI's ephemeral
PostGIS service (Actions run 29977349490, commit `8ae02f9`) — including
worker-claim concurrency, schedule approval SoD, legacy creator rejection, and
concurrent work-order code allocation. The Neon production branch was also
connected and verified earlier; do not commit the connection string — keep it in
deployment/local secret configuration only. **Neon credential rotation remains a
release gate** because the credential was exposed during setup communication.

## Known gap (blocks a release claim)
**GPS >100m mandatory reason is missing.** The review flag exists, but the
*required reason* for a position >100m from the asset is absent from the
schema/payload/UI, so **UAT case 8 (`docs/spec/06`) is not complete**. Do not
mark QA/UAT done until this is represented and tested.

## Next steps (in order)
1. **Next slice — safe test environment + guarded demo fixture:** provision a
   controlled local/staging DB (this machine has no Docker/psql), then implement
   a **production-safe, explicitly guarded** local demo work-order fixture so the
   owner can exercise `/today`. **Not yet implemented** — do not claim it is. Must
   never write a demo/fabricated work order to production.
2. **Workflow UAT:** with the guarded fixture on a non-production DB, run the
   `/today` happy path (start → checklist/GPS → submit → `SUBMITTED`), then wire
   dashboard actions to real inspection/sync/fault/work-order flows.
3. **GPS >100m reason:** add the mandatory reason to schema/payload/UI (domain
   first, with tests) to close UAT case 8.
4. **Security boundary:** `AUTH_MODE=internal` itself is owner-approved, but the
   **public Vercel URL remains an OPEN security exception** — every reachable
   caller gets full permissions. It must be restricted to the municipality's
   internal network / private access layer, or explicitly accepted by the owner
   in a future decision. It is **not** resolved and not yet owner-accepted.
5. **Security:** rotate the Neon password/connection secret before production,
   because the credential was exposed during setup communication.
6. **Release gate:** redeploy, run runtime smoke tests, then complete
   `docs/spec/06_DELIVERY_QA_UAT.md` with the internal-mode exception recorded.
7. **Later product depth:** reports, online MapLibre map (accessible list fallback
   already built), and optional Keycloak mode if policy changes.

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
