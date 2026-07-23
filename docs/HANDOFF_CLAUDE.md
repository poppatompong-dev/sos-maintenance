# Handoff to Claude Code — 2026-07-23

Codex is near its context limit. Continue from this file, then read
`docs/RESUME_HERE.md`, `docs/ROADMAP_CHECKPOINT.md`, and
`docs/ENGINEERING_LOOP.md` before changing code.

## FACT

- Repository: `D:\sos-maintenance`, branch `main`.
- The implementation checkpoint was clean at commit `1a88bb0`; newer commits may
  contain only handoff/checkpoint documentation, so always run `git log -5` first.
- `/today` workflow code is in `src/components/TodayWorkspace.tsx`.
- `GET /api/sync/bootstrap` now includes the work-order database `id`; the UI
  can load work, start `ASSIGNED/REOPENED` work, capture checklist + GPS, submit
  an idempotent inspection envelope, then transition to `SUBMITTED`.
- Latest production smoke on 2026-07-23:
  - `/today` = 200
  - `/api/sync/bootstrap` = 200, `workOrders=[]`
  - `/api/readiness/overview` = 200, `source=db`, 27 assets
  - `/api/assets` = 200, 27 assets, first `EP01`
- Local quality gate passed: `pnpm test` **182/182 (22 files)**,
  `pnpm test:integration` **43/43 (9 files)**, typecheck, lint, build, and
  `git diff --check`. (Prior CI-green baseline: 167 unit + 41/41 integration.)
- Production has no open work-order fixture. Do not fabricate one in production.
- **Guarded local demo fixture DONE:** `pnpm db:seed:demo` (fail-closed,
  local-`sos`-only) creates one idempotent ASSIGNED `DEMO-LOCAL-EP01-MONTHLY`.
  `/today` happy-path UAT verified on `http://localhost:3100/today`:
  `ASSIGNED→IN_PROGRESS` 200, `POST /api/inspections` 201, → `SUBMITTED` 200; DB
  shows status `SUBMITTED` v2, 10 responses / 1 `clientMutationId`, distance 0 m,
  1 `UNKNOWN` `ReadinessSnapshot`, two work_log transitions. After submit `/today`
  shows zero open orders (SUBMITTED excluded from bootstrap). See
  `docs/DEMO_RUNBOOK.md`.

## DECISION

- Keep the owner-approved `AUTH_MODE=internal` no-login mode for internal use.
- Do not send or commit `DATABASE_URL`, Neon password, cookies, or tokens.
- Normal CI integration should use the ephemeral PostGIS service in
  `.github/workflows/ci.yml`; it does not need the Neon secret.

## BLOCKER FOUND — RESOLVED (2026-07-23)

The prior CI failure (run `29918222990`) was a pnpm configuration mismatch:
`pnpm/action-setup@v4` had `version: 10` while `package.json` pins
`packageManager: pnpm@10.34.5`. **Fixed in commit `8ae02f9`** by removing the
duplicate `version:` declaration from both jobs so action-setup reads the pin.
GitHub Actions run **29977349490** was green (baseline before this slice):
`quality` success (47s), `integration` success (1m0s) with **41/41 integration
tests in 8 files** on the ephemeral PostGIS service. The integration order is
unchanged:

```text
prisma generate → pnpm db:setup → pnpm test:integration
```

### Known gap (do not fix silently; plan a slice)

GPS >100m review flag exists and the schema column
`ChecklistResponse.locationReason` **already exists**, but the **DTO/service/UI
wiring** that collects and persists the mandatory reason for a position >100m from
the asset is **not yet wired**, so **UAT case 8 (`docs/spec/06`) is not complete**.
This is a wiring slice, not a schema change. (Local Docker Desktop + PostGIS is now
healthy on this machine; `/today` UAT ran against a real local DB via the guarded
fixture — never fabricate a production work order.)

## NEXT

1. ~~Safe test DB + guarded demo fixture~~ — **DONE.** `pnpm db:seed:demo` is
   fail-closed and local-`sos`-only; never writes a demo work order to
   production/Neon. See `docs/DEMO_RUNBOOK.md`.
2. ~~`/today` happy-path UAT~~ — **DONE** (start → checklist/GPS → submit →
   `SUBMITTED`), verified in-browser on the local DB (evidence in FACT above).
3. **Next slice:** close the GPS >100m mandatory-reason gap by adding the missing
   DTO/service/UI wiring (domain first, with tests) — the `locationReason` column
   already exists — to complete UAT case 8. Then wire dashboard actions.
4. Keep public Vercel + no-login as a security exception until a private
   network boundary is established or explicitly accepted by the owner.
5. Neon credential rotation remains a release gate because the original
   credential was exposed during setup; handle it only through the account UI
   or a secure local environment.

## REVIEW

- The UI retry path reuses `mutationId` after the evidence write, preserving
  idempotency if the subsequent state transition fails.
- The current UI slice does not implement QR scan, IndexedDB offline mutation
  queue, photo attachments, or dashboard actions.
- Do not mark production complete from build/CI alone; require runtime and UAT
  evidence according to `docs/spec/06_DELIVERY_QA_UAT.md`.
