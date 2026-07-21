# Work Log

Chronological record of what was built, decisions taken, and what's next. Newest
entries at the top. See `RESUME_HERE.md` for the always-current start point.

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

Font: `IBM Plex Sans Thai` self-hosted via next/font (free/OSS). Home route `/` is
`force-dynamic`; data source is temporary (seed registry) until Sprint 4 DB wiring.

_Next: Technician B shell._

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
