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
- Local quality gate passed: `pnpm test` 167/167, typecheck, lint, build, and
  `git diff --check`.
- Production has no open work-order fixture. Do not fabricate one in production.

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
GitHub Actions run **29977349490** is green: `quality` success (47s),
`integration` success (1m0s) with **41/41 integration tests in 8 files** on the
ephemeral PostGIS service. The integration order is unchanged:

```text
prisma generate → pnpm db:setup → pnpm test:integration
```

### New known gap (do not fix silently; plan a slice)

GPS >100m review flag exists, but the **mandatory reason** for a position >100m
from the asset is **absent from schema/payload/UI**, so **UAT case 8
(`docs/spec/06`) is not complete**. This machine also has **no Docker/psql**, so
hands-on `/today` UAT needs a controlled local/staging DB — never fabricate a
production work order.

## NEXT

1. **Next slice:** provision a safe local/staging test DB, then implement a
   **production-safe, explicitly guarded** local demo work-order fixture so the
   owner can exercise `/today`. **Not yet implemented** — do not claim it is, and
   never write a demo/fabricated work order to production.
2. For `/today` happy-path UAT, use that controlled non-production fixture or wait
   until the municipality creates a real work order: start → checklist/GPS →
   submit → `SUBMITTED`.
3. Close the GPS >100m mandatory-reason gap in schema/payload/UI (domain first,
   with tests) to complete UAT case 8.
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
