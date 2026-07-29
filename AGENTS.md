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
2. **`docs/DEVELOPMENT_GUIDE.md`** — how to actually build a slice here: the
   non-negotiable principles and *why*, a fully worked example across every
   layer, the testing strategy (and why a green suite is not enough), the traps
   that have already cost time, the definition of done, and the specific
   starting point for each remaining gap. **Read before writing code.**
3. **`docs/WORKLOG.md`** — chronological history + why each decision was made.
4. **`docs/ARCHITECTURE.md`** — how the code is organised (layers, modules, the
   readiness pipeline, ports/adapters).
5. **`docs/spec/`** — the original requirements pack (01–09). Source-of-truth
   order when things conflict: `spec/07` > `spec/01` & `spec/06` > `spec/03–05` >
   `spec/08` > prototype.
6. `docs/README.md` is the full index of all documentation.

## Current state
See `docs/RESUME_HERE.md` — kept current every session; do not rely on a
hardcoded snapshot here, it goes stale immediately. The one deliberate
exception is the dated pointer under "What to work on next" below, which exists
so a session knows what to do without a second file read — it is explicitly
marked as a snapshot and must be updated when the next slice changes.

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
   changes) as you go. When a slice finishes, also update
   `requirements-traceability.csv` with **observed** evidence, and refresh the
   dated "What to work on next" pointer at the bottom of this file. Stale
   onboarding docs are a recurring hazard here — on 2026-07-26 three separate
   files were still instructing the next session to redo finished work or run a
   command that fails.
4. `git add -A && git commit -m "..." && git push` at the end. Pushing is
   essential — it's how the work reaches the user's other machine.
   Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`.
5. Screenshots in the in-app browser pane may time out — verify UI with
   `read_page` (a11y tree) + a JS probe for computed styles/contrast instead.

## Start of session — copy/paste

```powershell
git pull                       # always first: the user develops home ↔ office
pnpm install                   # only if deps changed
pnpm test                      # unit — needs no Docker, no env vars
```

**Anything that touches the database** (`pnpm dev` with real data,
`pnpm test:integration`, `pnpm db:*`) additionally needs Docker up **and** the
env vars set **in the same shell** — there is no `.env` file in this tree:

```powershell
docker compose up -d postgres  # wait until healthy (~15-30s)
$env:DATABASE_URL = "postgresql://sos:sos@localhost:5432/sos?schema=public"
$env:AUTH_MODE = "internal"    # needed for /today and for write APIs
pnpm dev -p 3100               # http://localhost:3100
```

**Three ways to get this wrong — all have cost time already:**
- ❌ `pnpm dev -- -p 3100` — the `--` is passed through as a positional arg and
  the server dies with `Invalid project directory provided, no such directory:
  ...\-p`. Write `pnpm dev -p 3100`.
- ❌ Port **3000** is the unrelated `thai-memo-app`. **Never touch it.** This
  app is 3100 only.
- ❌ `docker compose down -v` would destroy the named volumes. **Never run it.**
  To stop cleanly use `docker compose stop postgres`.

## Other commands
```
pnpm test:integration   # DB-backed tests, need local sos PostGIS (see above)
pnpm db:setup           # migrate + postgis + seed (fresh database)
pnpm db:migrate | pnpm db:postgis | pnpm db:seed
pnpm db:seed:demo       # guarded local-only demo work order (docs/DEMO_RUNBOOK.md)
```
Everything else (`typecheck`, `lint`, `build`, `worker:dev`, etc.) is a standard
script — see `package.json`.

## What to work on next

**Snapshot — 2026-07-29. `docs/RESUME_HERE.md` wins if these disagree; go read
it, and update the line below whenever the next slice changes.**

Four agreed release gaps are code-verified (299 unit tests passing, build clean):
Gap 1 (`ASSET-06` baseline approval) · Gap 2 (`RDY-06` scheduled recompute) · Gap 3 (`OPS-05` SMTP transport) · Gap 5 (`RPT-02` Reports PDF/Excel export).
`UI-03` has the capture component and server validation, but the current
`TodayWorkspace` does not consume `PhotoCaptureInput`; browser integration is
still open.

> **Next slice: `UI-03` integration, then `QA-01`.** Connect the photo capture
> flow to initial-survey groups, pass attachment IDs through the inspection
> envelope, and then run the formal
> `docs/spec/06_DELIVERY_QA_UAT.md` gate end-to-end, recording the `AUTH_MODE=internal`
> exception as part of evidence.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
