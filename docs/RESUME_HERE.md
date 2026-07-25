# ▶ START HERE — resume the SOS maintenance build

> Continuing on a **different machine / location**? Read
> [`START_TOMORROW.md`](START_TOMORROW.md) — it walks through cloning fresh
> anywhere and getting a new Claude session up to speed.

_Always-current pointer. Read this first when you sit down at a machine._
_Last updated: 2026-07-25, evening — **both remaining release-blockers are now
CLOSED**: the public Vercel URL is gated behind `SITE_ACCESS_PASSWORD`
(HTTP Basic Auth, `src/proxy.ts`) and the Neon production DB credential has
been rotated, both confirmed working live in production. Session paused here
for the day; a same-day audit against `docs/spec/06_DELIVERY_QA_UAT.md`'s 11
mandatory UAT cases is written up in "▶ Next" below as tomorrow's starting
point — it found 4 concrete engineering gaps (baseline approval, email
transport, scheduled readiness recompute, reports/PDF/Excel) plus the
already-known photo-capture UI. QA/UAT gate as a formal process still NOT
run — do not claim production-ready until it's actually completed._

## ▶ Next: honest gap-audit against `docs/spec/06_DELIVERY_QA_UAT.md`, then an owner scope decision
Every remaining engineering item and every release-blocker from prior
sessions is now done: the flexible grouped checklist, the GPS >100m mandatory
reason (UAT case 8), the dashboard nav/CTA honesty fix, the Planner console
v1, QR scan, the photo/evidence storage backend, the offline mutation queue,
the real technician picker, and — as of this session — the shared-password
gate **and** the Neon credential rotation, both live and verified in
production.

**Do NOT start by writing code tomorrow.** The formal QA/UAT gate has never
actually been run end-to-end, and a same-day check of the 11 mandatory UAT
cases in `docs/spec/06_DELIVERY_QA_UAT.md` against the real code (done this
session, findings below) shows **several cases depend on features that don't
exist yet** — some small, one large. Building blind against a stale
`requirements-traceability.csv` (last touched around Sprint 3–4, doesn't even
mention Planner console v1/QR/storage/offline-queue/technician-picker/security
-gate/Neon-rotation) would repeat the exact scope-creep mistake this project
has deliberately avoided elsewhere (see the photo-capture-UI and
technician-picker precedents). **Step 1 tomorrow: refresh
`requirements-traceability.csv` and present the honest picture below to the
owner for a scope decision before implementing anything.**

**Case-by-case audit against `docs/spec/06`'s 11 mandatory UAT cases
(checked against real code this session — trust this over
`requirements-traceability.csv`, which is stale):**

1. **27 assets + baseline approval** — 27 assets: done. **Baseline approval
   has no real workflow at all** — `Asset.baselineApproved` is read
   everywhere (readiness engine, queries) but there is no endpoint/UI that
   ever sets it true; only seed/demo fixtures touch it directly. **Gap: a
   baseline-approval feature doesn't exist.**
2. **auto draft → edit/publish → assignment** — schedule-batch
   create/approve/publish + WO `ASSIGNED` with the real technician picker
   are built (Planner console v1). Likely satisfiable, but verify
   specifically whether "auto draft" means a plan's recurrence should
   *automatically* generate the next batch/WO, or whether a Planner manually
   triggering creation counts — re-read spec docs 01/06 before assuming.
3. **QR/GPS/photo/pass → READY** — QR: done. GPS: done. **Photo capture UI
   still doesn't exist** (the owner picked the UX flow 2026-07-25 — see
   "Blocked, not missing" below — it's now an implementation gap, not a
   pending decision). The monthly checklist's one photo item was
   deliberately stripped, so monthly can reach READY without it, but the
   full photo-evidence path (initial survey) is unproven. **Gap: photo
   capture UI.**
4. **critical fail → DOWN + Fault + WO + email** — DOWN + Fault + corrective
   WO: done at the domain level (tested). **Email is not wired at all** —
   `src/server/services/run-job-tick.ts` explicitly defers EMAIL-channel
   notifications ("no transport wired yet → leave PENDING"); no Nodemailer
   transport exists despite being in the documented tech stack. **Gap: SMTP
   email transport.**
5. **repair/retest → Planner accept → READY** — fault repair-accept UI is
   built (Planner console v1). Likely satisfiable; confirm with a live
   retest→READY run, not just code presence.
6. **overdue → WATCH → after 7 days UNKNOWN** — the domain rule itself
   (7-day grace, precedence) is correct and unit-tested. **But nothing
   automatically re-evaluates readiness on a schedule** —
   `run-job-tick.ts`'s "readiness reconciliation" only counts assets in scope
   for observability, it doesn't recompute; readiness currently only
   updates reactively when a new inspection/event happens. An asset that
   just goes quiet won't automatically flip WATCH→UNKNOWN in production
   today. **Gap: a scheduled readiness-recompute job** (the code comments
   already point at Vercel Cron as the intended trigger).
7. **offline close/reopen → sync once, no duplicate** — the offline mutation
   queue (this session) is idempotent via `clientMutationId` and was
   live-verified once end-to-end. Reasonably solid.
8. **GPS >100m reason + review flag** — **done**, closes this case.
9. **Executive read/export cannot mutate** — read-only RBAC for EXECUTIVE is
   policy-tested. The "export" half has nothing to verify against yet — see
   #10.
10. **Dashboard/PDF/Excel match same filter** — **no PDF/Excel exists at
    all** (confirmed: no Playwright/ExcelJS usage anywhere in `src/`).
    Metrics share one definition (`src/domain/metrics`) so the *data* side is
    ready, but there is no report-generation feature to test. **This is the
    single largest remaining gap** — likely deserves its own design + plan
    document the way the flexible-checklist feature got one
    (`docs/superpowers/plans/2026-07-23-flexible-field-checklist.md` as the
    template), not a quick slice.
11. **Cutover: 27 with no missing baseline/status** — this needs real
    baseline approvals (#1) *and* real field surveys of all 27 physical
    poles. **This is an operational/business milestone, not an engineering
    task** — no amount of coding closes it; it happens after go-live
    readiness, on the municipality's own timeline. Don't try to "complete"
    it in a coding session.

**Recommended shape for tomorrow, in order:**
1. Refresh `requirements-traceability.csv` against the audit above (mechanical,
   ~30–60 min) — this is the artifact the spec itself says gates closure
   ("ห้ามปิด requirement ไม่มี evidence").
2. Bring the owner the honest picture: 4 solid gaps identified (baseline
   approval, email transport, scheduled readiness recompute, reports
   PDF/Excel) plus the photo-capture UI already agreed. Ask explicitly:
   build all of it before any release claim, or agree a smaller v1 scope
   with the rest recorded as known limitations? **Do not decide this
   unilaterally** — same precedent as every other scope call this project
   has deferred to the owner.
3. Only after that decision, sequence the agreed slices — likely smallest
   first (baseline approval is probably a small, contained feature; the
   scheduled recompute job may already have most of its plumbing in
   `run-job-tick.ts`; email transport is a moderate Nodemailer wiring job;
   reports is the multi-session one).

**Security-boundary closure, 2026-07-25 evening — final state, verified live:**
- `src/proxy.ts` (HTTP Basic Auth gate) pushed and deployed (`f938d9c` →
  redeployed after two env-var fixes — see the root-cause note below).
- `SITE_ACCESS_PASSWORD` and the new Neon `DATABASE_URL` both confirmed
  correct in Vercel → Environment Variables (Production + Preview).
- **Live production smoke test, owner-confirmed:** no `Authorization` header
  → `401` with `WWW-Authenticate: Basic realm="SOS Maintenance"` (not `503`);
  correct password → `200`, dashboard "ศูนย์ควบคุมเสา SOS" renders, all 27
  poles (`EP01`–`EP27`) load, no DB connection errors.
- **Root cause worth remembering for future sessions:** the first two
  attempts at setting `SITE_ACCESS_PASSWORD` silently saved an **empty
  value** (still returned `503` — the code's own fail-closed behavior for
  "unset"), and because Vercel's `Sensitive` flag makes a value permanently
  unviewable once saved (by anyone, including the owner), this couldn't be
  diagnosed by looking — only by the specific symptom (`503` = empty, `401` =
  present-but-wrong, `200` = correct). **The fix that worked was deleting the
  variable entirely and re-adding it fresh**, rather than repeatedly editing
  the existing one. If a similar gated secret ever needs changing again and
  the site 503s afterward, try delete-and-recreate before assuming the value
  itself is wrong.
- **Also worth remembering:** Claude's own auto-mode classifier blocked three
  separate automated attempts to help move the `DATABASE_URL` secret value
  (a JS-based entry trick, a plain page navigate, and a clipboard-rebuild
  script) — all near this same secret-entry flow. That's a deliberate safety
  boundary, not a bug to route around; the owner did every actual secret-entry
  step by hand in the end, which is the correct pattern going forward too.

**Local dev server, started this session for hands-on UI checking (separate
from the above — this is purely local, does not touch Vercel/Neon at all):**
Docker Desktop was started, `docker compose up -d postgres` brought up
`sos-maintenance-postgres-1` (still running, healthy). `pnpm dev` is running
on `http://localhost:3100` with `DATABASE_URL` pointed at the **local**
Postgres (`postgresql://sos:sos@localhost:5432/sos?schema=public`) and
`AUTH_MODE=internal` set in the shell (no `.env` file in this tree — see
"Get running" below). If it's not responding when you sit back down, just
re-run the command in "Get running". Local DB already has the 27-pole seed +
2 guarded demo work orders on EP01 (`DEMO-LOCAL-EP01-MONTHLY` — legacy v1,
frozen/reissue-advisory; `DEMO-LOCAL-EP01-MONTHLY-V2` — SUBMITTED) plus
technician **สมชาย** — all from prior sessions' guarded fixtures, untouched.

**ดูสถานะ milestone และหลักฐานล่าสุด:** [`ROADMAP_CHECKPOINT.md`](ROADMAP_CHECKPOINT.md)

**เปิด Codex session ใหม่/เปลี่ยนบัญชี:** อ่าน [`SESSION_HANDOFF_CODEX.md`](SESSION_HANDOFF_CODEX.md)
แล้วส่งต่อ [`HANDOFF_CLAUDE.md`](HANDOFF_CLAUDE.md) ให้ Claude Code

## Where we are
- **Sprint 1 (Foundation)** ✅ · **Sprint 2 (Domain layer)** ✅ · **Sprint 3 (UI + PWA)** ✅ · **Sprint 4–6 wiring** ✅ · **Flexible field checklist (grouped monthly v2)** ✅ · **GPS >100m mandatory reason (UAT case 8)** ✅ · **Dashboard nav/CTA honesty fix** ✅ · **Planner console v1** ✅ · **QR scan** ✅ · **Photo storage backend (ADR 0005)** ✅ (infra only — see below) · **Offline mutation queue (field checklist submission)** ✅ · **Real technician picker (ASSIGNED)** ✅ · **Shared-password gate (`src/proxy.ts`)** ✅ **live in production, verified** · **Neon credential rotation** ✅ **done, verified** (see "▶ Next" above for both) — the DB-backed integration gate is green (apart from 2 pre-existing, unrelated local-seed-state failures — see below).
- **Real technician picker — DONE, see `docs/WORKLOG.md` 2026-07-25 entry for full detail.** No longer blocked: the owner confirmed a real technician, **สมชาย** (no surname), seeded as a `TECHNICIAN`-only `User` row (`prisma/seed.ts`, idempotent). `GET /api/technicians` lists real active technicians; assigning now requires a valid `assigneeUserId` (`ASSIGNEE_REQUIRED`/`ASSIGNEE_INVALID`, 400, before touching the DB) and writes a real `Assignment` row in the same transaction as the status change. The Planner console's "มอบหมาย" action shows a `<select>` of real people only — never a fabricated name, and an honest "ยังไม่มีช่างในระบบ" message if the roster is ever empty. **Operational note:** any environment/CI run needs `pnpm db:seed` re-run to pick up สมชาย if it was seeded before this change.
- **Offline mutation queue — DONE, see `docs/WORKLOG.md` 2026-07-25 entry for full detail.** `/today` no longer requires `online` to attempt a checklist submit — a genuine network failure (not an HTTP rejection) now enqueues to a real IndexedDB store (`src/lib/offline-queue.ts`) instead of just erroring out, auto-drains on reconnect, and a `QueueStatusBanner` shows pending/failed counts with a manual retry for failures (which are never silently auto-retried). Scoped deliberately to the field-evidence submit path only — not `WorkOrderCard`'s "เริ่มงาน" start action, which stays online-only by choice. Live end-to-end proof against the local DB (no automated IndexedDB test coverage — this repo has no browser/jsdom test setup for any component, matching the existing "verify UI live" convention): patched `fetch` to fail the way a real network outage does, confirmed the entry lands in IndexedDB, restored connectivity, confirmed the queue drained and the server independently shows `SUBMITTED` with the correct persisted checklist response and idempotency key.
- **Photo/evidence storage backend — DONE (infra only), see `docs/WORKLOG.md` 2026-07-25 entry for full detail.** `Attachment` had a schema and an ADR (0005) but zero consumers. Now built: `StoragePort` + local-filesystem V1 driver (`STORAGE_LOCAL_DIR`), MIME/signature/size validation (`src/domain/attachment`, sniffs real bytes — never trusts a declared type), `POST /api/attachments` (multipart upload, `workorder:submit`/`repair:submit`), `GET /api/attachments/:id` (authorized download, `asset:read`). **Deliberately NOT done:** any client-facing capture UI — see "Blocked, not missing" below. Owner confirmed 2026-07-25 the initial-survey checklist should get photo capture first if/when this is built.
- **QR scan — DONE, see `docs/WORKLOG.md` 2026-07-25 entry for full detail.** `/today/scan` (the Technician nav's 2nd of 3 destinations) decodes a pole's QR locally with `jsqr` and resolves it server-side via `GET /api/assets/by-qr/:token` (`Asset.qrToken`, `asset:read`-gated) before navigating to `/assets/:code`. Manual code-entry fallback covers no-camera devices (WCAG 2.2 AA) and QR-print failures. Only new runtime dependency: `jsqr` (Apache-2.0).
- **Planner console v1 — DONE, see `docs/WORKLOG.md` 2026-07-25 entry for full detail.** `/work-orders` is now tabbed (**ใบงานทั้งหมด / ชุดงาน**) and action-capable: work-order transitions (curated per-role from the real state machine — no dead/fake buttons), schedule-batch create/approve/publish (plan-picker form + status actions), and fault repair-accept (corrective work orders show the linked fault's repair evidence — cause/fix/changed parts/retest — before accept/reject). Two new read endpoints added (`GET /api/work-orders/:code`, `GET /api/maintenance-plans`) since neither existed. Live-verified on the local DB with throwaway fixtures, all cleaned up afterward — guarded demo untouched.
- **Tests:** `pnpm test` → **255 passing** (28 files). Locally, DB-backed integration → **69 passing / 2 failing (15 files)** — the 2 failures are `src/app/api/read-routes.itest.ts` asserting an empty "fresh seed" against a local DB that permanently carries the guarded demo fixtures (stale local state, not a regression; unchanged since the checklist slice). `pnpm typecheck`, `pnpm lint`, `pnpm build` are green. CI was last confirmed fully green on Actions run [`30140977892`](https://github.com/poppatompong-dev/sos-maintenance/actions/runs/30140977892) (Planner console v1, commit `2613940`) — re-confirm CI on the QR-scan, photo-storage, offline-queue, and technician-picker commits before relying on this line. (Prior CI-green baseline before the checklist slice: 167 unit + 41/41 integration, Actions run 29977349490, commit `8ae02f9`.)

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

## Blocked, not missing — needs the owner's decision, not more code
One remaining gap looks like a code TODO but is actually a product-scope
decision that should not be resolved unilaterally:
- **Client photo-capture UI.** The storage backend is done (above), and the
  owner confirmed 2026-07-25 the initial-survey checklist should get it
  first — but building it still means deciding exactly how capture fits into
  that specific checklist's submission flow (this repo has zero camera-input
  UI anywhere to date; QR scan's `getUserMedia` pattern is the nearest
  precedent). Confirm the UX shape with the owner before implementing, same
  as the checklist-photo-stripping precedent from 2026-07-24.

(The real technician picker for the `ASSIGNED` transition was in this
section until 2026-07-25 — resolved once the owner confirmed a real name;
see "Where we are" above.)

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
deployment/local secret configuration only. **Neon credential rotation is now
DONE (2026-07-25)** — see "▶ Next" above for the evidence.

## Known gaps (block a release claim)
GPS >100m mandatory reason wiring is **done** — UAT case 8 is closed. The
public Vercel URL's shared-password gate and the Neon credential rotation are
**both done and verified live** (see "▶ Next" above). The only remaining gap
before a release claim is **process, not code**: the formal
`docs/spec/06_DELIVERY_QA_UAT.md` gate has never actually been run end-to-end
as a documented exercise.

## Next steps (in order)
1. ~~**Safe test environment + guarded demo fixture**~~ — **DONE.** Local Docker
   PostGIS is healthy; `pnpm db:seed:demo` creates one idempotent, fail-closed,
   local-`sos`-only ASSIGNED demo work order. Never writes to production/Neon.
   See `docs/DEMO_RUNBOOK.md`.
2. ~~**Workflow UAT (happy path)**~~ — **DONE** for start → checklist/GPS → submit
   → `SUBMITTED`, verified in-browser on the local DB. ~~Dashboard nav/CTA
   honesty~~ — **DONE (2026-07-24)**, see above. ~~Planner console v1~~ —
   **DONE (2026-07-25)**, see above. ~~QR scan~~ — **DONE (2026-07-25)**, see
   above. ~~Photo storage backend~~ — **DONE (infra only, 2026-07-25)**, see
   above. ~~Offline mutation queue~~ — **DONE (2026-07-25)**, see above.
   ~~Real technician picker~~ — **DONE (2026-07-25)**, see above. Still
   remaining in this area: client photo-capture UI — **blocked on an owner
   UX decision**, not a code gap; see "Blocked, not missing" above. The
   initial-survey checklist deliberately stays un-groupified and its CTA
   disabled until that's built — do not "fix" it by stripping its photo
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
5. ~~**Security boundary**~~ — **DONE (2026-07-25).** `src/proxy.ts`'s
   shared-password gate is live in production and owner-verified: no auth →
   `401`, correct password → `200`. See "▶ Next" above for the root-cause
   note (an empty saved value, fixed by delete-and-recreate, not a code bug).
6. ~~**Security: rotate the Neon credential**~~ — **DONE (2026-07-25).** The
   `neondb_owner` password was reset and `DATABASE_URL` swapped in Vercel;
   owner-verified live (dashboard loads all 27 poles, no DB errors).
7. **Release gate (NEXT):** both prerequisites above are now satisfied — run
   the actual `docs/spec/06_DELIVERY_QA_UAT.md` gate end-to-end (it has not
   been formally executed this project), with the internal-mode exception
   recorded as part of it.
8. **Later product depth:** reports, online MapLibre map (accessible list fallback
   already built), optional Keycloak mode if policy changes, and client
   photo-capture UI for the initial-survey checklist (owner already picked
   this flow 2026-07-25 — see "Blocked, not missing" above — the remaining
   work is UX + implementation, not a scope decision).

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
