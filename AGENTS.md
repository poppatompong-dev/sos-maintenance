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
- ✅ Sprint 1 (Foundation) · ✅ Sprint 2 (Domain layer) · ✅ Sprint 3 (UI + PWA)
- **129 tests passing**; `typecheck` / `lint` / `build` green.
- App runs with `pnpm dev` → `/` (control-centre dashboard) and `/today`
  (technician field shell). Data is the true initial state: all 27 poles UNKNOWN
  until surveyed (computed, not faked).
- **Next: Sprint 4 = DB wiring** (needs Docker). Details in `docs/RESUME_HERE.md`.

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
pnpm test           # 129 tests
pnpm typecheck | pnpm lint | pnpm build
pnpm db:migrate | pnpm db:postgis | pnpm db:seed   # need Docker running
```

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
