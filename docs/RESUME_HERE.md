# ▶ START HERE — resume the SOS maintenance build

> Continuing on a **different machine / location**? Read
> [`START_TOMORROW.md`](START_TOMORROW.md) — it walks through cloning fresh
> anywhere and getting a new Claude session up to speed.

_Always-current pointer. Read this first when you sit down at a machine._
_Last updated: 2026-07-23 (end-of-day handoff — flexible field checklist design **owner-approved** and its **implementation plan is complete**; **no implementation started today**)._

## ▶ Next slice is planned and ready to execute
The **flexible field checklist** is the next ordered slice. Its design is
**owner-approved** and its implementation plan is **complete** — but **no code has
been written yet**. Read both before touching anything:
- **Approved design:** [`docs/superpowers/specs/2026-07-23-flexible-field-checklist-design.md`](superpowers/specs/2026-07-23-flexible-field-checklist-design.md)
- **Implementation plan (execute from Task 1, in order):** [`docs/superpowers/plans/2026-07-23-flexible-field-checklist.md`](superpowers/plans/2026-07-23-flexible-field-checklist.md)

The approved design was committed as `762ce3d` (`docs: design flexible field
checklist`). It is the plan's base commit.

**ดูสถานะ milestone และหลักฐานล่าสุด:** [`ROADMAP_CHECKPOINT.md`](ROADMAP_CHECKPOINT.md)

**เปิด Codex session ใหม่/เปลี่ยนบัญชี:** อ่าน [`SESSION_HANDOFF_CODEX.md`](SESSION_HANDOFF_CODEX.md)
แล้วส่งต่อ [`HANDOFF_CLAUDE.md`](HANDOFF_CLAUDE.md) ให้ Claude Code

## Where we are
- **Sprint 1 (Foundation)** ✅ · **Sprint 2 (Domain layer)** ✅ · **Sprint 3 (UI + PWA)** ✅ · **Sprint 4–6 wiring** ✅ — implementation is in the working tree, the DB-backed integration gate is green, and the `/today` happy path is now verified end-to-end against a local DB.
- **Tests:** `pnpm test` → **182 passing** (22 files); DB-backed integration → **43/43 passing (9 files)**. `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check` are green. The **CI pnpm version mismatch is fixed (DONE)**. (Prior CI-green baseline before this slice: 167 unit + 41/41 integration, Actions run 29977349490, commit `8ae02f9`.)
- **Local Docker Desktop + PostGIS is now healthy on this machine**, so hands-on `/today` workflow UAT ran against a real local DB. Do **not** fabricate production work orders — the demo fixture is guarded, local-`sos`-only, and fail-closed.
- **Current workflow slice — DONE for the happy path:** `/today` loads the real sync bootstrap, shows open field work orders, starts assigned work, captures GPS/checklist results, submits idempotent evidence, and advances the work order to `SUBMITTED`. Verified in-browser on `http://localhost:3100/today` against the guarded demo fixture: one ASSIGNED demo with 10 real checklist items; `ASSIGNED→IN_PROGRESS` 200, `POST /api/inspections` 201, transition to `SUBMITTED` 200, no console errors. DB evidence: status `SUBMITTED` version 2, 10 responses under 1 `clientMutationId`, distance 0 m, 1 `UNKNOWN` `ReadinessSnapshot`, two `work_log` transitions. **After submit, `/today` correctly shows zero open work orders** — `SUBMITTED` is excluded from the open-order bootstrap; confirm success via API/DB, not a persistent pill.
- **Running app (no Docker needed):** `pnpm dev` → `/` control-centre dashboard, `/today` technician field shell (installable PWA).
- **Repo:** https://github.com/poppatompong-dev/sos-maintenance (private, branch `main`).
- **What works end-to-end today:** the whole domain (readiness, recurrence, geo,
  work state machine, fault, metrics, RBAC, sync, import, notifications) + two UI
  shells rendering the *true* initial state (27 poles UNKNOWN until surveyed).

## Get running
**On this machine** — the current workspace is `D:\sos-maintenance`:
```powershell
cd D:\sos-maintenance
git pull
pnpm install          # if deps changed
pnpm test             # confirm green (baseline 182 unit tests, 22 files)
pnpm dev -- -p 3100   # http://localhost:3100  (see port note below)
```
**On a NEW machine:** follow `docs/DEVELOPING.md`, then clone to a local path and
run `pwsh ./scripts/bootstrap.ps1`.

> **Port note (do not get this wrong):** this SOS app uses **port 3100**. Port
> **3000 belongs to the unrelated `thai-memo-app`** and must **not** be touched.
> All local browser/demo checks use `http://localhost:3100`.

## ✅ DB verification complete / CI integration green
The DB-backed integration suite passes **41/41 in 8 files** on CI's ephemeral
PostGIS service (Actions run 29977349490, commit `8ae02f9`) — including
worker-claim concurrency, schedule approval SoD, legacy creator rejection, and
concurrent work-order code allocation. The Neon production branch was also
connected and verified earlier; do not commit the connection string — keep it in
deployment/local secret configuration only. **Neon credential rotation remains a
release gate** because the credential was exposed during setup communication.

## Known gap (blocks a release claim)
**GPS >100m mandatory reason wiring is missing.** The schema column
`ChecklistResponse.locationReason` **already exists** (and the review flag works),
but the DTO/service/UI path that *collects and persists* a required reason when the
captured position is >100m from the asset is **not yet wired**, so **UAT case 8
(`docs/spec/06`) is not complete**. Do not mark QA/UAT done until this wiring is
represented and tested. This is a wiring slice, not a schema change.

## Next steps (in order)
1. ~~**Safe test environment + guarded demo fixture**~~ — **DONE.** Local Docker
   PostGIS is healthy; `pnpm db:seed:demo` creates one idempotent, fail-closed,
   local-`sos`-only ASSIGNED demo work order `DEMO-LOCAL-EP01-MONTHLY`. Never
   writes to production/Neon. See `docs/DEMO_RUNBOOK.md`.
2. ~~**Workflow UAT (happy path)**~~ — **DONE** for start → checklist/GPS → submit
   → `SUBMITTED`, verified in-browser on the local DB (evidence above). Still
   remaining in this area: wire dashboard actions to real
   inspection/sync/fault/work-order flows, plus offline queue / QR / photo.
3. **Flexible field checklist (NEXT — design owner-approved, plan complete, not
   started).** Execute
   [`docs/superpowers/plans/2026-07-23-flexible-field-checklist.md`](superpowers/plans/2026-07-23-flexible-field-checklist.md)
   from **Task 1 in order**, test-first, in small vertical commits with Codex
   review between meaningful tasks. It turns the monthly field inspection into
   five outcome-oriented Thai groups (plus one optional note) defined entirely by
   versioned data, with a pure server-authoritative canonicalization — no
   readiness/auth/offline change. This slice does **not** close UAT case 8 (below)
   and does **not** claim the QA/UAT gate.
4. **GPS >100m reason (after the checklist slice):** the
   `ChecklistResponse.locationReason` column already exists — add the missing
   DTO/service/UI wiring (domain first, with tests) to collect and persist the
   mandatory reason and close **UAT case 8**. Still an open release blocker.
5. **Security boundary:** `AUTH_MODE=internal` itself is owner-approved, but the
   **public Vercel URL remains an OPEN security exception** — every reachable
   caller gets full permissions. It must be restricted to the municipality's
   internal network / private access layer, or explicitly accepted by the owner
   in a future decision. It is **not** resolved and not yet owner-accepted.
6. **Security:** rotate the Neon password/connection secret before production,
   because the credential was exposed during setup communication. Never print or
   store the secret; no production/Neon writes.
7. **Release gate:** redeploy, run runtime smoke tests, then complete
   `docs/spec/06_DELIVERY_QA_UAT.md` with the internal-mode exception recorded.
8. **Later product depth:** reports, online MapLibre map (accessible list fallback
   already built), and optional Keycloak mode if policy changes.

**Docker safety (local only):** the dev compose declares **two** named volumes,
`db-data` **and** `keycloak-data`. **Never run `docker compose down -v`** — it
would destroy both. If a DB reset is genuinely required, follow the plan's
**Task 14** fail-closed procedure that removes only the literal
`sos-maintenance_db-data` volume and **never** removes `keycloak-data`.

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
