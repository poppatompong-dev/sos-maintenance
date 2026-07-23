# SOS Maintenance — assistant onboarding

You are continuing an in-progress build. This file is read automatically; read it
fully before doing anything. It tells you what the project is, where things are,
the rules you must follow, and exactly what to do next.

## What this project is
A Thai-language internal **PWA to manage maintenance & readiness of 27 SOS
emergency poles** (EP01–EP27) for เทศบาลนครนครสวรรค์ (Nakhon Sawan City
Municipality). The core question it answers for executives: *which poles are
พร้อมใช้ / เฝ้าระวัง / ใช้งานไม่ได้ / ยังไม่ทราบ right now, with evidence?*

## Read these first, in this order
1. **`docs/RESUME_HERE.md`** — current state + the ordered next steps. START HERE.
2. **`docs/WORKLOG.md`** — chronological history + why each decision was made.
3. **`docs/ARCHITECTURE.md`** — how the code is organised (layers, modules, the
   readiness pipeline, ports/adapters).
4. **`docs/spec/`** — the original requirements pack (01–09). Source-of-truth
   order when things conflict: `spec/07` > `spec/01` & `spec/06` > `spec/03–05` >
   `spec/08` > prototype.
5. `docs/README.md` is the full index of all documentation.

## Current state (keep this section honest as you work)
- ✅ Sprint 1 (Foundation) · ✅ Sprint 2 (Domain layer) · ✅ Sprint 3 (UI + PWA) ·
  ✅ Sprint 4 (DB wiring)
- **182/182 unit tests passing** (22 files) + **43/43 DB-backed integration**
  (9 files); `typecheck` / `lint` / `build` / `git diff --check` green. CI pnpm
  version mismatch is **fixed** (DONE). (Prior CI-green baseline before this slice:
  167 unit + 41/41 integration, Actions run 29977349490, commit `8ae02f9`.)
- App runs with `pnpm dev` → `/` (control-centre dashboard) and `/today`
  (technician field shell). Data is the true initial state: all 27 poles UNKNOWN
  until surveyed (computed, not faked).
- **Local Docker Desktop + PostGIS is now healthy on this machine**, so hands-on
  `/today` workflow UAT ran against a real local DB. **Never fabricate production
  work orders** — the demo fixture is guarded, local-`sos`-only, and fail-closed.
- **Guarded local demo fixture DONE:** `pnpm db:seed:demo` creates one idempotent
  ASSIGNED demo work order `DEMO-LOCAL-EP01-MONTHLY` on EP01 (local `sos` DB only).
  Browser `/today` happy path verified on `http://localhost:3100/today`: one
  ASSIGNED demo with 10 real checklist items; `ASSIGNED→IN_PROGRESS` 200,
  `POST /api/inspections` 201, transition to `SUBMITTED` 200, no console errors. DB
  evidence: status `SUBMITTED` version 2, 10 responses under 1 `clientMutationId`,
  distance 0 m, 1 `UNKNOWN` `ReadinessSnapshot`, two `work_log` transitions. After
  submit, `/today` shows zero open work orders because `SUBMITTED` is excluded from
  the open-order bootstrap — verify via API/DB, not a persistent pill. See
  `docs/DEMO_RUNBOOK.md`.
- **Known gap (still open):** `ChecklistResponse.locationReason` **already exists**
  in the schema, but the GPS >100m *mandatory reason* DTO/service/UI wiring is
  missing — UAT case 8 is **not** complete.
- **Next slice:** with the guarded fixture in place, wire the GPS >100m mandatory
  reason (domain-first, with tests) and dashboard actions. Details in
  `docs/RESUME_HERE.md`.

## Code map
```
src/domain/**   pure business logic, NO IO / NO Prisma — fully unit-tested here
src/server/**   services (ports + submit-inspection), Zod DTOs, queries, db client
src/app/**      Next.js routes & server components (/, /today, /offline)
src/worker/     background scheduler
prisma/         schema (20+ entities), PostGIS SQL, 27-pole seed
infra/          Docker, Caddy, Keycloak realm, backup
```

## Rules you MUST follow (from the spec — non-negotiable)
- **Language:** Thai UI, consistent vocabulary — พร้อมใช้ / เฝ้าระวัง / ใช้งานไม่ได้ /
  ยังไม่ทราบ, ใบงาน, ผลตรวจ, ข้อขัดข้อง, งานซ่อม, ตรวจรับ.
- **Readiness is computed, never chosen.** Precedence DOWN > UNKNOWN > WATCH >
  READY; 7-day grace; every change writes an immutable ReadinessSnapshot. Logic
  lives in `src/domain/readiness` — do not bypass it.
- **`src/domain` stays pure** (no IO, no Prisma, no framework). Add new rules
  there first, **with tests**, then wire persistence via a port/adapter.
- **No fabricated data** — no fake people, statuses, coordinates, or hardware
  facts. Show the true state. Never invent official logo/credentials.
- **Security:** server-side RBAC on every endpoint & object (policy in
  `src/domain/authz`); a technician can never accept their own repair.
- **Offline:** idempotent mutation envelopes; never silent last-write-wins.
- **Free/OSS only** — no paid dependency in the core.
- **Time:** store UTC; display Asia/Bangkok + พ.ศ. (helpers in `src/domain/shared`).
- **UI:** premium & restrained. No gradient, glassmorphism, emoji icons,
  side-stripe borders, or KPI-card wall. Status always shows icon + text, not
  colour alone. WCAG 2.2 AA. See `docs/DESIGN.md`.
- Use `docs/spec/06_DELIVERY_QA_UAT.md` as the release gate; nothing is "done"
  on a passing build alone — show test evidence.

## How to work every session
1. `git pull` at the start (the user develops across machines — home ↔ office).
2. Work in **small vertical slices**; keep `pnpm test && pnpm typecheck &&
   pnpm lint && pnpm build` green.
3. **Update `docs/WORKLOG.md`** (and `docs/RESUME_HERE.md` if the next step
   changes) as you go.
4. `git add -A && git commit -m "..." && git push` at the end. Pushing is
   essential — it's how the work reaches the user's other machine.
   Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`.
5. Screenshots in the in-app browser pane may time out — verify UI with
   `read_page` (a11y tree) + a JS probe for computed styles/contrast instead.

## Commands
```
pnpm dev            # app (/, /today)
pnpm worker:dev     # background worker
pnpm test           # 182 unit tests (DB-free)
pnpm test:integration   # 43 DB-backed tests (need local sos PostGIS)
pnpm typecheck | pnpm lint | pnpm build
pnpm db:migrate | pnpm db:postgis | pnpm db:seed   # need Docker running
pnpm db:seed:demo   # guarded local-only demo work order (see docs/DEMO_RUNBOOK.md)
```

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Imported Claude Cowork project instructions

Project Overview:
You are working on sos-maintenance — a PWA web application for managing emergency SOS pole maintenance at Nakhon Sawan Municipality. The system tracks the status of 27 SOS poles (EP01–EP27) with readiness states: Available / Monitoring / Non-operational / Unknown, with full traceability to evidence.
Tech Stack:

Frontend: Next.js (App Router) + TypeScript + Service Worker + IndexedDB
Backend: Next.js API routes + Node.js
Database: PostgreSQL + PostGIS (geographic queries) + Prisma ORM
Auth: Keycloak (OIDC + TOTP MFA)
Maps: MapLibre/Leaflet + OpenStreetMap tiles
Reports: Playwright (PDF), ExcelJS
Deployment: Docker Compose + Caddy (reverse proxy)
Testing: Vitest + Playwright
Task Queue: PostgreSQL-backed background worker (Nodemailer for email)

Key Directories:

src/app/ — Next.js routes (role-aware shell, WIP)
src/domain/ — Pure business logic (no I/O): readiness engine, reason codes
src/server/ — Database client, background worker scheduler
prisma/ — Schema (20+ entities), seed data (27 poles), PostGIS setup
infra/ — Docker config, Keycloak realm, backup scripts
docs/ — Architecture (ARCHITECTURE.md), resume point (RESUME_HERE.md), tomorrow steps (START_TOMORROW.md), requirements (docs/spec/)

Current Status:
✅ Domain logic & readiness engine (182 unit tests passing, 22 files)
✅ UI shells (Dashboard A, Technician field app B)
✅ DB wiring & migrations (complete)
✅ REST APIs & database wiring; guarded local demo fixture + /today happy-path UAT (complete)
⏸️ Auth enforcement (Keycloak) — deferred; owner selected internal no-login mode
⏳ Remaining: offline mutation queue, reports, dashboard actions, QR/photo, GPS >100m mandatory-reason wiring
Prerequisites to Run Locally:

Node 22+, pnpm 10+
Docker Desktop (PostgreSQL, PostGIS, Keycloak, dev SMTP)

Quick Start (if Docker is running):
pnpm install
pnpm db:setup      # One-time: migrate + enable PostGIS + seed 27 poles
pnpm dev           # Next.js app at http://localhost:3000
pnpm worker:dev    # Background worker (separate terminal)
Common Tasks:

pnpm typecheck / lint / build — static checks
pnpm test / test:watch / test:coverage — Vitest
pnpm db:studio — Prisma Studio (data browser)
docker compose up -d — Start services (Postgres, Keycloak, dev mail)

Where to Start Reading:

docs/README.md — Doc index
docs/RESUME_HERE.md — Current sprint state + next steps
docs/ARCHITECTURE.md — System design
docs/START_TOMORROW.md — Ready-to-run prompts for continuation
docs/spec/ — Requirements (specs 01–08, source order: 07 > 01/06 > 03–05 > 08 > prototype)

Important Notes:

All domain logic in src/domain/ is pure (testable, no DB calls) — mutation testing friendly
Readiness state machine covers 7-day grace period + recurrence rules
27-pole seed data in prisma/seed.ts matches real SOS locations
RBAC roles tied to Keycloak groups (not yet enforced in routes)
Not production-ready until QA/UAT gate in docs/spec/06_DELIVERY_QA_UAT.md is passed
Evidence traceability via requirements-traceability.csv

Helpful Commands for Claude:

When debugging domain logic: pnpm test --reporter=verbose
When exploring data: pnpm db:studio
When checking code quality: pnpm typecheck && pnpm lint && pnpm build
To review requirements: check requirements-traceability.csv or open docs/spec/ folder
