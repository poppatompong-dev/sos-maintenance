# Work Log

Chronological record of what was built, decisions taken, and what's next. Newest
entries at the top. See `RESUME_HERE.md` for the always-current start point.

---

## 2026-07-23 — Flexible field checklist: design approved + plan complete (docs-only handoff)

**FACT:** Design ของ flexible field checklist ได้รับ **owner approval** และ
**implementation plan เสร็จสมบูรณ์แล้ว** — แต่ **ยังไม่เริ่มลงมือ implement วันนี้**
(ยังไม่มีการแตะ code / schema / config / tests). งานวันนี้เป็น **docs-only**:
ปรับ end-of-day handoff (`RESUME_HERE.md`, `START_TOMORROW.md`, `WORKLOG.md`) ให้
ชี้ slice ถัดไปเป็น flexible field checklist ก่อนกลับไปทำ GPS >100m reason wiring,
แก้ path/port ที่ล้าสมัย (workspace ปัจจุบัน = `D:\sos-maintenance`, แอปใช้ port
**3100**; port 3000 เป็นของ `thai-memo-app` ที่ไม่เกี่ยวข้อง ห้ามแตะ), และย้ำ Docker
volume safety.

**DECISION:** slice ถัดไป = **flexible field checklist** (รัน
`docs/superpowers/plans/2026-07-23-flexible-field-checklist.md` จาก Task 1 ตามลำดับ,
test-first, commit ย่อย, Codex review คั่นระหว่าง task) แล้วจึงกลับไป GPS >100m
mandatory reason. Release blockers ทั้งหมดยังคงเปิดอยู่: **UAT case 8** (GPS >100m
reason), **public internal-mode Vercel URL** exposure, **Neon secret rotation**, และ
**final QA/UAT + redeploy**. ยังไม่ production-ready.

**EVIDENCE:** approved design commit **`762ce3d`** (`docs: design flexible field
checklist`); plan path **`docs/superpowers/plans/2026-07-23-flexible-field-checklist.md`**.
Baseline ที่วัดไว้ (ไม่ได้รันซ้ำวันนี้ เพราะเป็น docs-only): `pnpm test`
**182 passing (22 files)**, `pnpm test:integration` **43/43 (9 files)**. **ไม่มีการ
รัน runtime test สำหรับการแก้เอกสารรอบปิดวันนี้** — อย่ารายงานว่ารัน test แล้ว.

**NEXT:** session ถัดไปอ่าน AGENTS.md + RESUME + WORKLOG + approved design + plan,
แล้ว execute plan จาก Task 1 (test-first, small vertical commits); ใช้ local
Docker/PostGIS เท่านั้น (integration shell ปล่อย `AUTH_MODE`/`AUTH_DEV_BYPASS` ว่าง),
app port 3100 เท่านั้น.

**BLOCKER:** UAT case 8 (GPS >100m reason) ยังไม่ปิด; public Vercel URL ยังเป็น OPEN
security exception; ต้อง rotate Neon credential ก่อน release; final QA/UAT +
redeploy ยังไม่ทำ. Docker: มี volume `db-data` และ `keycloak-data` — **ห้าม
`docker compose down -v`**; ถ้าต้อง reset ให้ตาม Task 14 (ลบเฉพาะ literal
`sos-maintenance_db-data`, ไม่แตะ `keycloak-data`).

---

## 2026-07-23 — Guarded local demo fixture + `/today` browser UAT (local PostGIS)

**FACT:** Local Docker Desktop + PostGIS ใช้งานได้บนเครื่องนี้แล้ว. เพิ่ม guarded
demo fixture: `prisma/demo-fixture-guard.ts` (pure, fail-closed), `demo-fixture.ts`
(idempotent transaction), `seed-demo.ts` (CLI), tests, และ `docs/DEMO_RUNBOOK.md`;
`package.json` เพิ่ม `db:seed:demo`. `pnpm db:seed:demo` รันครั้งแรก `created`
ครั้งที่สอง `already present` (idempotent, local-`sos`-only, ไม่แตะ production/Neon).

**DECISION:** ENGINEERING_LOOP queue item 4 (safe test env + guarded fixture) =
**DONE**; item 5 (`/today` UAT happy path) = **DONE**. item 6 (GPS >100m reason) =
NEXT. **ยังไม่ production-ready.**

**NEXT:** wire GPS >100m mandatory reason (คอลัมน์ `ChecklistResponse.locationReason`
มีอยู่แล้ว — ขาด DTO/service/UI wiring, domain-first + tests) → ปิด UAT case 8;
แล้วต่อ dashboard actions.

**BLOCKER:** security exceptions ยังเปิดอยู่ — public Vercel URL = OPEN security
exception (ทุก caller ได้สิทธิ์เต็ม); ต้อง rotate Neon credential ก่อน release.

**EVIDENCE:** `pnpm test` **182/182 (22 files)**; `pnpm test:integration`
**43/43 (9 files)**; `pnpm typecheck` / `pnpm lint` / `pnpm build` /
`git diff --check` exit 0. Browser UAT `http://localhost:3100/today`: demo หนึ่งใบ
ASSIGNED + checklist จริง 10 รายการ; `ASSIGNED→IN_PROGRESS` 200,
`POST /api/inspections` 201, transition → `SUBMITTED` 200, ไม่มี console error. DB:
`WorkOrder.status=SUBMITTED` version 2; 10 `ChecklistResponse` ภายใต้ 1
`clientMutationId`; distance 0 m; 1 `ReadinessSnapshot` = `UNKNOWN`; work_log 2
transitions. หลัง submit `/today` open orders = 0 (SUBMITTED ถูกตัดจาก bootstrap;
ยืนยันผ่าน API/DB ไม่ใช่ pill).

**REVIEW:** guard ตรวจก่อนต่อ Prisma (confirmation, non-production, loopback host,
db=`sos`) และไม่ echo connection string; fixture idempotent พิสูจน์ด้วย
integration test ที่ใช้ `-ITEST` code แยกจาก demo จริง; ไม่แตะ `src/**`, schema,
`seed.ts`, workflows. ช่องว่างที่ยังเปิด: GPS >100m wiring, public URL boundary,
Neon rotation.

---

## 2026-07-23 — CI pnpm mismatch fixed; DB integration confirmed green

**FACT:** แก้ `.github/workflows/ci.yml` โดยลบ `version: 10` ที่ซ้ำออกจากทั้ง
`quality` และ `integration` job ให้ `pnpm/action-setup@v4` อ่าน
`packageManager: pnpm@10.34.5` จาก `package.json` (คงลำดับ job และ PostGIS service
เดิม). Commit `8ae02f9`.

**DECISION:** CI pnpm mismatch = **DONE**; post-change DB integration = **DONE**.
Sprint 4 (DB wiring) ปิดงานได้ตาม integration evidence.

**EVIDENCE:** GitHub Actions run 29977349490 — `quality` success (47s),
`integration` success (1m0s) โดย integration **41/41 tests ผ่านใน 8 files** (3.89s);
local `pnpm test` 167/167 (21 files), `pnpm typecheck` / `pnpm lint` / `pnpm build`
/ `git diff --check` exit 0.

**BLOCKER / ข้อจำกัดที่บันทึกไว้ตามจริง:**
- เครื่องนี้**ไม่มี Docker และไม่มี psql** — hands-on `/today` workflow UAT ยังต้อง
  ใช้ local/staging DB ที่ควบคุมได้ และ**ห้ามสร้างใบงานปลอมใน production**
- **GPS >100m gap ที่ยืนยันแล้ว:** review flag มีอยู่ แต่ *เหตุผลบังคับ (mandatory
  reason)* ยังไม่มีใน schema/payload/UI → **UAT case 8 ยังไม่ผ่าน**
- Security exception เดิมยังคงอยู่: `AUTH_MODE=internal` เป็น owner-approved แต่
  **public Vercel URL ยังเป็น OPEN security exception** (ยังไม่ได้ owner acceptance) ต้อง
  จำกัด network หรือให้ owner ยอมรับอย่างชัดเจนภายหลัง; และต้อง **rotate Neon credential**
  ก่อน release

**NEXT:** slice ถัดไป = จัดเตรียม safe test environment และ implement demo fixture
ที่ production-safe และ**มี guard ชัดเจน** ก่อนให้เจ้าของทดสอบ `/today` — **ยังไม่ได้
ทำ** อย่ารายงานว่าเสร็จ

---

## 2026-07-23 — Prepared cross-session/account handoff

**FACT:** เพิ่ม `SESSION_HANDOFF_CODEX.md` สำหรับเปิด Codex session ใหม่หรือเปลี่ยน
บัญชีโดยใช้ GitHub เป็นแหล่งความจริง และปรับ `START_TOMORROW.md`/`README.md` ที่ยัง
แสดงสถานะเก่า 129 tests กับ Sprint 4 เป็นงานถัดไป ทั้งที่ปัจจุบันมี 167 tests และ
อยู่ช่วง Workflow UI/CI verification แล้ว

**DECISION:** เปลี่ยนบัญชี Codex ได้หลัง push checkpoint แต่ต้องตรวจ GitHub access,
workspace เดิม และติดตั้ง `codex-claude-loop` ใน Windows profile ใหม่ถ้าจำเป็น
บทสนทนาเดิมและ context ของ session ไม่ใช่แหล่งความจริงหลัก

**NEXT:** session ใหม่อ่าน `RESUME_HERE.md` → `SESSION_HANDOFF_CODEX.md` →
`HANDOFF_CLAUDE.md`; จากนั้นแก้ pnpm mismatch ใน CI และตรวจ quality/integration
ต่อ โดยไม่นำ secret ไปแชตหรือ commit

---

## 2026-07-22 — Workflow UI `/today` slice implemented

**FACT:** พบ root cause ว่า `GET /api/sync/bootstrap` ส่งเฉพาะ work-order code แต่
`POST /api/inspections` ต้องใช้ database ID ทำให้ UI shell เดิมส่งผลตรวจจริงไม่ได้
เพิ่ม `id` ใน bootstrap response และเพิ่ม `TodayWorkspace` ที่โหลดใบงานจริง,
เริ่มงานผ่าน `IN_PROGRESS`, แสดง checklist, อ่าน GPS, ส่ง mutation envelope พร้อม
SHA-256 และเปลี่ยนสถานะเป็น `SUBMITTED` หลัง evidence write สำเร็จ

**DECISION:** สถานะ slice = **IN PROGRESS / CONDITIONAL PASS**. Commit `066f040`
ถูก push และ production shell/API smoke ผ่าน แต่ยังไม่มี fixture ใบงานเปิดให้ทดสอบ
happy path ใน browser และยังต้องตรวจ integration หลัง change

**EVIDENCE:** `pnpm test` 167/167, `pnpm typecheck`, `pnpm lint`, `pnpm build`
ผ่าน; diff ตรวจด้วย `git diff --check` ผ่านก่อนรอบสุดท้าย. `pnpm test:integration`
รันจริงแต่ติดที่เครื่องนี้ไม่มี `DATABASE_URL` ทำให้ 8 suites fail, 29 tests skip,
4 tests ผ่านจาก 41 tests ที่ถูก discover — ไม่ใช่ code assertion failure

**REVIEW:** retry ใช้ `mutationId` เดิมเพื่อรักษา idempotency; state transition ยัง
ผ่าน server/domain rules. QR scan, IndexedDB offline queue, photo attachment,
dashboard actions และ public-URL security boundary ยังไม่อยู่ใน slice นี้

**RUNTIME:** หลัง deployment ตรวจ `GET /today` = 200 พร้อม shell ใหม่,
`GET /api/sync/bootstrap` = 200 และ `workOrders=[]`, `GET /api/readiness/overview`
= 200, `source=db`, rollup 27 จุด. Empty result เป็นข้อมูลจริง ไม่ใช่ fixture ปลอม

**NEXT:** เพิ่ม/มอบหมายใบงานทดสอบใน environment ที่ควบคุมได้เพื่อทำ browser happy
path (start → checklist → GPS → submit → SUBMITTED) แล้วรัน integration บน
environment ที่มี database credential โดยไม่นำค่า secret เข้า log/chat

**BLOCKER:** post-change integration ต้องการ `DATABASE_URL`; production ยังคงมี
security exception เพราะ Vercel URL เป็น public และ internal mode ให้สิทธิ์เต็ม

---

## 2026-07-22 — Roadmap checkpoint and production blocker audit

Added [`ROADMAP_CHECKPOINT.md`](ROADMAP_CHECKPOINT.md) as the single progress
view for the project. It records milestone status, runtime evidence, owners,
critical-path work, and the Definition of Done for production. The checkpoint
was the pre-decision snapshot: database and authorized cron were working, while
the production readiness and technician APIs returned 401 because live Keycloak
configuration was not present. It was superseded by the later owner decision to
use explicit `AUTH_MODE=internal`.

---

## 2026-07-22 — Owner decision: internal no-login mode

The owner explicitly chose to remove the login requirement for the current
internal deployment. Added ADR 0011 and an explicit `AUTH_MODE=internal` path:
no bearer token/Keycloak is required, the internal operator has all application
permissions, and the domain validation/idempotency/readiness/workflow rules stay
active. This mode must not be presented as safe on a public URL; a trusted
network/private access boundary is required. Keycloak remains an optional future
mode rather than an active release blocker.

---

## 2026-07-22 — Internal mode deployed and smoke-tested

Commit `769370b` was pushed and the latest Vercel production deployment reached
`Ready`. `AUTH_MODE=internal` was configured in Production; obsolete
`AUTH_DEV_BYPASS` and `AUTH_SECRET` variables were removed. No-Authorization
runtime smoke passed: `/api/readiness/overview` **200** with DB source and 27
UNKNOWN poles, `/api/sync/bootstrap` **200**, `/api/assets` **200** with 27
assets, `/api/work-orders`, `/api/faults`, and `/api/schedule-batches` **200**;
invalid inspection POST reached validation and returned **400**. The Vercel URL
remains public, so this is recorded as a security exception until a private
network/access boundary is added. Local unit tests are **167/167**; the prior
Neon integration evidence remains 41/41, while a post-change local integration
rerun is pending because this machine has no `DATABASE_URL`.

---

## 2026-07-22 — Adopted sequential engineering loop

Added [`ENGINEERING_LOOP.md`](ENGINEERING_LOOP.md) as the shared development
method. Every slice now requires a checkpoint, measurable acceptance criteria,
current evidence, small implementation, quality gates, runtime smoke, self/team
review, checkpoint update, and commit/push. The loop has explicit recovery rules
to stop repeated retries and never mark work complete from build success alone.
Installed and adopted `codex-claude-loop` at
`C:\Users\poppa\.agents\skills\codex-claude-loop\SKILL.md`, with Claude Code
handling plan/implementation and Codex handling validation/review. The initial
review is CONDITIONAL PASS for the internal no-login slice: production smoke and
quality gates passed, while the public-URL security exception and post-change
integration rerun remain open.

---

## 2026-07-22 — Go-live handoff plan

Added [`GO_LIVE_HANDOFF.md`](GO_LIVE_HANDOFF.md) for the owner's 30-minute
departure window. It defines the critical-path sequence, secure handling rules,
runtime evidence required after Keycloak setup, the exact handoff report format,
stop conditions, and the production Definition of Done. The plan preserves the
original fail-closed Auth boundary; it was subsequently updated by the owner's
no-login internal-mode decision.

---

## 2026-07-22 — Verification follow-up: worker and schedule/batch gates

**Delivered in the working tree:** notification claiming now uses a compare-and-
set update so overlapping worker ticks cannot send the same notification twice.
Schedule batches persist `createdById`, reject self-approval and approval of
legacy rows with unknown creators, and release work orders only after a distinct
approver approves. Yearly work-order code allocation is serialized with a
transaction-scoped PostgreSQL advisory lock to prevent concurrent collisions.

**Verification:** migration `20260722090000_schedule_batch_created_by` deployed
to the supplied Neon branch and Prisma Client was regenerated. Schedule API
integration passed **10/10**, full unit tests passed **166/166**, and the complete
DB-backed integration suite passed **41/41 tests in 8 files**. `pnpm typecheck`,
`pnpm lint`, `pnpm build`, and `git diff --check` passed.

**Remaining gate:** live Keycloak OIDC/TOTP e2e, Vercel environment/cron smoke
test, secret rotation, documentation review, and the final commit/push remain.

---

## 2026-07-22 — Sprint 4–6: DB wiring, auth boundary, REST APIs

**Delivered in the working tree:** Prisma/PostGIS persistence adapter and DB-backed
queries, server-side auth boundary/RBAC checks, and REST routes for assets,
work-orders, faults, readiness overview, and inspections. The CI integration job
is enabled and now runs `prisma generate` → `pnpm db:setup` →
`pnpm test:integration`.

**Verification at that point:** `pnpm install --frozen-lockfile`,
`pnpm exec prisma generate`, `pnpm test` (136 tests), `pnpm typecheck`,
`pnpm lint`, and `pnpm build` pass. Later verification is recorded in the entry
above.
Against the supplied Neon production branch, `pnpm db:setup` completed migration,
PostGIS enablement, and seed (27 assets, 324 components, 52 checklist items, 3
plans). `pnpm test:integration` then passed **18 tests in 4 files** in 87.82s.

**Decision:** retain the accepted ADR 0002 choice of self-hosted Keycloak (OIDC +
TOTP MFA) for the real login provider. Neon/Vercel account setup and production
secrets remain an account-owner task.

**Next at that point:** implement the real Keycloak login/session path, deploy
with secrets configured outside Git, and complete the QA/UAT gate.

---

## 2026-07-21 (evening) — Sprint 3: UI (in progress)

**Goal:** Build the role-aware UI shells (Dashboard A control-centre, Technician B
today) wired to the domain, verifiable via build + browser without Docker.

Plan / order:
1. ✅ Design tokens + globals + status components (`src/app/globals.css`,
   `StatusBadge`, `StatusRail`, `AppRail`, `PoleTable`, icons). See `docs/DESIGN.md`.
2. ✅ Dashboard A shell (`src/app/page.tsx`) — control-centre: nav rail + header +
   continuous status rail + pole card with the accessible table (map fallback) +
   action ledger. Renders the *true* initial state: all 27 poles UNKNOWN, computed
   by the readiness engine (not faked) — a teaching first-run state.
3. 🚧 Technician B mobile "today" shell
4. Verify: `pnpm build` ✓. Browser-verified via read_page (a11y tree) + JS probe
   (screenshots time out in this pane; a11y tree is the reliable check):
   IBM Plex Sans Thai applied, `lang=th`, 27 rows, status-bar aria-label correct,
   Thai พ.ศ. timestamp working, **WCAG AA contrast measured** (ink 14.5:1, muted
   6.2:1, status chip 5.5:1, brand button 5.5:1), no console errors. Prototype QA
   findings (button-name, colour-contrast) resolved.

3. ✅ Technician B mobile "today" shell (`src/app/today/page.tsx`) — top bar, solid
   hero (no gradient), Thai weekday+พ.ศ. date, QR-scan CTA (≥48px), empty-state
   jobs, bottom nav. `SyncState` client component reflects real online/offline.
5. ✅ PWA — `app/manifest.ts` (installable, start_url `/today`), placeholder icon
   (`public/icon.svg`, NOT the official logo — pending), conservative prod-only
   service worker (`public/sw.js`, network-first navigation + `/offline` fallback),
   `ServiceWorkerRegister`. Verified: manifest.webmanifest, icon.svg, sw.js,
   /offline all serve 200 with correct content types.

Font: `IBM Plex Sans Thai` self-hosted via next/font (free/OSS). Home route `/` is
`force-dynamic`; data source is temporary (seed registry) until Sprint 4 DB wiring.

**Also added this session (pure domain, tested):**
- `src/domain/import` — CSV parser + asset-registry & health-observation row
  validation; `canCommit` only when zero errors (no silent partial overwrite). 11 tests.
- `src/domain/notification` — Thai message builders for ASSET_DOWN / REPAIR_REJECTED
  / SYNC_FAILED / IMPORT_FAILED with deterministic idempotency keys. 6 tests.

**End-of-session state:** 129 tests green; typecheck + lint + build clean; 11 commits
pushed. Sprint 1–3 complete.

_Next: Sprint 4 — DB wiring (needs Docker). See RESUME_HERE.md._

---

## 2026-07-21 — Sprint 2: Domain layer ✅

**Delivered (all pure, unit-tested — no DB needed; ADR 0001 keeps domain IO-free):**
- `src/domain/recurrence` — weekly/monthly/semiannual next-due on the Bangkok
  calendar, month-end clamp, working-day adjustment (skips weekends + holiday set).
- `src/domain/geo` — haversine distance + 100 m GPS-exception rule.
- `src/domain/work/state-machine` — full transition graph + role permissions +
  separation of duties (no self-accept); passing recurring PM may self-close.
- `src/domain/fault` — one fault per failed item, deterministic idempotency keys,
  corrective-WO keys; `checklist` bridge maps responses → critical results.
- `src/domain/metrics` — MTTA/MTTR, readiness rollup + %, Thai duration format
  (single definition shared by dashboard/PDF/Excel).
- `src/domain/authz/policy` — RBAC matrix (4 roles × permissions) + `assertCan`.
- `src/domain/sync/envelope` — mutation idempotency + version-conflict detection
  (never silent last-write-wins).
- `src/domain/shared/thai-date` — พ.ศ. + Bangkok formatting (store UTC, show TH).
- `src/server/services/submit-inspection` — real vertical slice composing RBAC +
  envelope idempotency + GPS + checklist→readiness + fault, tested via in-memory
  port. `src/server/dto` — Zod schemas.

**Verification:** 113 tests pass; typecheck + lint + build green. 5 commits pushed.

**Decisions:** domain uses local string-union types (no Prisma import) so it stays
framework-free; SoD enforced in the state machine (acceptor ≠ submitter).

---

## 2026-07-21 — Sprint 1: Foundation ✅

**Delivered:**
- Next.js 16.2.10 + TS + Tailwind v4 scaffold at `C:\dev\sos-maintenance`.
- `src/domain/readiness` — pure engine, precedence DOWN>UNKNOWN>WATCH>READY,
  7-day grace, Thai reason codes (17 tests).
- Prisma schema (20+ CMMS entities, PostGIS geography) + 27-pole seed (EP01–EP27)
  + seed-data integrity tests.
- Docker topology (dev + prod compose, Dockerfiles, Caddy, Keycloak realm,
  backup.sh); 10 ADRs; CI; `requirements-traceability.csv`; license inventory.

**Verification:** 22 tests; typecheck + lint + build green.

**Key decisions (logistics):**
- Code lives at `C:\dev\sos-maintenance` (local, NOT Google Drive — Drive would
  sync node_modules). Spec docs copied to `docs/spec/`.
- Multi-machine dev via **private GitHub repo** + git, not folder sync. Toolchain
  pinned (Node 22, pnpm 10.34.5). DB/node_modules/.env regenerate per machine.
- **Docker Desktop pending** — install to unblock DB/Keycloak/integration/E2E.
