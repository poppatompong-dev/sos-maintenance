# ▶ START HERE — resume the SOS maintenance build

> Continuing on a **different machine / location**? Read
> [`START_TOMORROW.md`](START_TOMORROW.md) — it walks through cloning fresh
> anywhere and getting a new Claude session up to speed.

_Always-current pointer. Read this first when you sit down at a machine._
_Last updated: 2026-07-25 (Planner console v1 **implemented**; QR scan
**implemented**; photo capture and offline queue in progress this session —
QA/UAT gate as a whole still NOT closed — do not claim production-ready)._

## ▶ Next: security boundary + Neon credential rotation (need the account owner)
The engineering backlog that didn't need the account owner is now done: the
flexible grouped checklist, the GPS >100m mandatory reason (UAT case 8), the
dashboard nav/CTA honesty fix, the Planner console v1 (WO transitions +
schedule batches + fault repair-accept), and QR scan. What's left on the
release-blocker list is **not code** — it needs the project owner's direct
action:
1. **Network boundary for the public Vercel URL** — `AUTH_MODE=internal` gives
   every reachable caller full permissions; the deployed URL must be restricted
   (VPN / IP allowlist / Vercel deployment protection) or the exposure must be
   explicitly, formally accepted as a risk. Not resolved.
2. **Rotate the Neon production DB credential** — it was exposed during a prior
   setup communication. Requires the owner's Neon dashboard access.

Once both land, the remaining step is a redeploy + the formal
`docs/spec/06_DELIVERY_QA_UAT.md` gate with the internal-mode exception
recorded (see "Next steps" below).

**ดูสถานะ milestone และหลักฐานล่าสุด:** [`ROADMAP_CHECKPOINT.md`](ROADMAP_CHECKPOINT.md)

**เปิด Codex session ใหม่/เปลี่ยนบัญชี:** อ่าน [`SESSION_HANDOFF_CODEX.md`](SESSION_HANDOFF_CODEX.md)
แล้วส่งต่อ [`HANDOFF_CLAUDE.md`](HANDOFF_CLAUDE.md) ให้ Claude Code

## Where we are
- **Sprint 1 (Foundation)** ✅ · **Sprint 2 (Domain layer)** ✅ · **Sprint 3 (UI + PWA)** ✅ · **Sprint 4–6 wiring** ✅ · **Flexible field checklist (grouped monthly v2)** ✅ · **GPS >100m mandatory reason (UAT case 8)** ✅ · **Dashboard nav/CTA honesty fix** ✅ · **Planner console v1** ✅ · **QR scan** ✅ — implementation is in the working tree, the DB-backed integration gate is green (apart from 2 pre-existing, unrelated local-seed-state failures — see below).
- **QR scan — DONE, see `docs/WORKLOG.md` 2026-07-25 entry for full detail.** `/today/scan` (the Technician nav's 2nd of 3 destinations) decodes a pole's QR locally with `jsqr` and resolves it server-side via `GET /api/assets/by-qr/:token` (`Asset.qrToken`, `asset:read`-gated) before navigating to `/assets/:code`. Manual code-entry fallback covers no-camera devices (WCAG 2.2 AA) and QR-print failures. Only new runtime dependency: `jsqr` (Apache-2.0).
- **Planner console v1 — DONE, see `docs/WORKLOG.md` 2026-07-25 entry for full detail.** `/work-orders` is now tabbed (**ใบงานทั้งหมด / ชุดงาน**) and action-capable: work-order transitions (curated per-role from the real state machine — no dead/fake buttons), schedule-batch create/approve/publish (plan-picker form + status actions), and fault repair-accept (corrective work orders show the linked fault's repair evidence — cause/fix/changed parts/retest — before accept/reject). Two new read endpoints added (`GET /api/work-orders/:code`, `GET /api/maintenance-plans`) since neither existed. Live-verified on the local DB with throwaway fixtures, all cleaned up afterward — guarded demo untouched. **Known gap, not fixed this slice:** `ASSIGNED` only flips status; there's an `Assignment` table but nothing writes to it yet, so there's no real technician picker — see "Blocked, not missing" below for why.
- **Tests:** `pnpm test` → **237 passing** (26 files, unchanged by QR scan — no new domain logic). Locally, DB-backed integration → **59 passing / 2 failing (14 files)** — the 2 failures are `src/app/api/read-routes.itest.ts` asserting an empty "fresh seed" against a local DB that permanently carries the guarded demo fixtures (stale local state, not a regression; unchanged since the checklist slice). `pnpm typecheck`, `pnpm lint`, `pnpm build` are green. CI was last confirmed fully green on Actions run [`30140977892`](https://github.com/poppatompong-dev/sos-maintenance/actions/runs/30140977892) (Planner console v1, commit `2613940`) — re-confirm CI on the QR-scan commit before relying on this line. (Prior CI-green baseline before the checklist slice: 167 unit + 41/41 integration, Actions run 29977349490, commit `8ae02f9`.)
- **Dashboard nav/CTA honesty fix — DONE (commit `efba3c3`).** `AppRail` and the
  `/today` bottom nav previously rendered every item as a dead `href="#"`, and
  "active" was hardcoded per item rather than derived from the real route (so
  "ภาพรวม" showed active even on `/work-orders`/asset-detail pages). Fixed:
  real hrefs for destinations that exist (`/`, `/work-orders`, `/today`) with
  `aria-current` computed per page; items with no destination yet (map,
  calendar, reports, QR scan, "งานของฉัน", "แจ้งเตือน") render **disabled**
  with a "เร็วๆ นี้" label — never a silent no-op. The dashboard's
  "เริ่มสำรวจตั้งต้น" CTA is also now honestly disabled: the initial-survey
  checklist is photo-evidence by nature (5 of its 13 items require a photo,
  `prisma/seed.ts` `INITIAL_SURVEY`), photo capture doesn't exist yet, and the
  owner explicitly chose (2026-07-24) **not** to strip that requirement the
  way the checklist slice did for the monthly checklist's one photo item
  (`m_exterior`) — so the button must not pretend a survey can be completed.
  This is a UI-honesty fix only; it does not touch schema, domain, or APIs.
  `pnpm test` 231/231 unchanged, typecheck/lint/build clean, verified live
  against the running dev server.
- **GPS >100m mandatory reason — DONE, see `docs/WORKLOG.md` 2026-07-24 entry for full detail.** `submitInspection` now rejects (`GPS_REASON_REQUIRED`, 400) a >100m capture with no non-blank reason, before persisting anything; a reason is persisted to `ChecklistResponse.locationReason` alongside the existing `distanceMeters`/`locationException`/`reviewFlag`; `/today` reveals a required reason field client-side as UX guidance once GPS is captured, but the server remains authoritative. Live-server end-to-end proof (throwaway fixture, cleaned up, guarded demo untouched): no reason → 400; with reason → 201 + persisted evidence with `reviewFlag`/`locationException` both `true`. **This closes UAT case 8** (`docs/spec/06`).
- **Local Docker Desktop + PostGIS is now healthy on this machine**, so hands-on `/today` workflow UAT ran against a real local DB. Do **not** fabricate production work orders — the demo fixture is guarded, local-`sos`-only, and fail-closed.
- **Flexible field checklist — DONE, see `docs/WORKLOG.md` 2026-07-24 entry for full detail.** Monthly checklist v2 (5 Thai outcome-oriented groups + 1 optional note) is now the active definition (`pnpm db:checklist:v2`, chained into `pnpm db:setup`); legacy v1 stays frozen/untouched and renders a Thai reissue advisory. Server-side canonicalization (`src/domain/checklist/canonicalize.ts`) means the client can no longer supply criticality/function keys. Browser-verified end-to-end on `http://localhost:3100/today` against the new `DEMO-LOCAL-EP01-MONTHLY-V2` demo: card render → `เริ่มงาน` (200) → all 5 groups `ปกติ` → submit → `POST /api/inspections` 201 → `SUBMITTED`, no console errors, no PASS/FAIL/enum leakage in the accessibility tree. DB evidence: 10 `ChecklistResponse` rows under 1 `clientMutationId`, 1 fresh `ReadinessSnapshot` (status `UNKNOWN`/`NO_APPROVED_BASELINE` — expected, unrelated to this slice: EP01's baseline was never approved). **This slice does NOT close UAT #3/#4/#8** — see the WORKLOG entry for exactly what it does and doesn't prove.
- **Prior workflow slice (v1, still valid history):** `/today` loads the real sync bootstrap, shows open field work orders, starts assigned work, captures GPS/checklist results, submits idempotent evidence, and advances the work order to `SUBMITTED`. **After submit, `/today` correctly shows zero open work orders for that WO** — `SUBMITTED` is excluded from the open-order bootstrap; confirm success via API/DB, not a persistent pill.
- **Running app (no Docker needed):** `pnpm dev` → `/` control-centre dashboard, `/today` technician field shell (installable PWA). **No `.env` file exists in this working tree** — a fresh `pnpm dev`/`pnpm db:*` needs `DATABASE_URL` (and for `/today` runtime, `AUTH_MODE=internal`) set explicitly in the shell; see `docs/DEMO_RUNBOOK.md`.
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

## Known gaps (block a release claim)
GPS >100m mandatory reason wiring is **done** (see above) — UAT case 8 is
closed. What remains before a release claim is entirely non-code: the public
Vercel URL's network boundary and Neon credential rotation, both below.

## Next steps (in order)
1. ~~**Safe test environment + guarded demo fixture**~~ — **DONE.** Local Docker
   PostGIS is healthy; `pnpm db:seed:demo` creates one idempotent, fail-closed,
   local-`sos`-only ASSIGNED demo work order. Never writes to production/Neon.
   See `docs/DEMO_RUNBOOK.md`.
2. ~~**Workflow UAT (happy path)**~~ — **DONE** for start → checklist/GPS → submit
   → `SUBMITTED`, verified in-browser on the local DB. ~~Dashboard nav/CTA
   honesty~~ — **DONE (2026-07-24)**, see above. ~~Planner console v1~~ —
   **DONE (2026-07-25)**, see above. ~~QR scan~~ — **DONE (2026-07-25)**, see
   above. Still remaining in this area: offline queue and photo capture (in
   progress this session — check the latest WORKLOG entries above this list
   for current status). The initial-survey checklist deliberately stays
   un-groupified and its CTA disabled until photo capture exists (owner
   decision, 2026-07-24) — do not "fix" it by stripping its photo
   requirements without asking first.
3. ~~**Flexible field checklist**~~ — **DONE (2026-07-24).** All 16 tasks of
   [`docs/superpowers/plans/2026-07-23-flexible-field-checklist.md`](superpowers/plans/2026-07-23-flexible-field-checklist.md)
   executed test-first in small vertical commits. Monthly field inspection is now
   five outcome-oriented Thai groups (plus one optional note) defined entirely by
   versioned data, with a pure server-authoritative canonicalization — no
   readiness/auth/offline change. Full detail + exact test evidence in
   `docs/WORKLOG.md` (2026-07-24 entry). This slice does **not** close UAT case 8
   (below) and does **not** claim the QA/UAT gate.
4. ~~**GPS >100m reason**~~ — **DONE (2026-07-24).** Domain-first with tests;
   closes **UAT case 8**. Full detail + exact test evidence in
   `docs/WORKLOG.md` (2026-07-24 entry).
5. **Security boundary (NEXT — needs the account owner, not code):** `AUTH_MODE=internal` itself is owner-approved, but the
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
   already built), optional Keycloak mode if policy changes, and a real
   technician picker for the `ASSIGNED` work-order transition (the `Assignment`
   table exists in the schema but nothing writes to it yet — see the Planner
   console v1 entry in `docs/WORKLOG.md`, 2026-07-25).

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
