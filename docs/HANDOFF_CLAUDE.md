# Handoff to Claude Code — 2026-07-23

Codex is near its context limit. Continue from this file, then read
`docs/RESUME_HERE.md`, `docs/ROADMAP_CHECKPOINT.md`, and
`docs/ENGINEERING_LOOP.md` before changing code.

## FACT

- Repository: `D:\sos-maintenance`, branch `main`.
- Before this handoff, worktree was clean at commit `1a88bb0`.
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

## BLOCKER FOUND

GitHub Actions run
`https://github.com/poppatompong-dev/sos-maintenance/actions/runs/29918222990`
failed before tests because `pnpm/action-setup@v4` has `version: 10`, while
`package.json` pins `packageManager: pnpm@10.34.5`.

This is a CI configuration mismatch, not a missing database secret. Fix the
workflow to use the exact pinned version `10.34.5` (or otherwise remove the
duplicate version declaration), then push and verify both `quality` and
`integration` jobs. Keep the existing integration order:

```text
prisma generate → pnpm db:setup → pnpm test:integration
```

## NEXT

1. Fix the pnpm version mismatch in `.github/workflows/ci.yml`.
2. Run local quality gates and push; inspect the new GitHub Actions run.
3. If CI passes, record the integration test total in the checkpoint.
4. For `/today` happy-path UAT, use a controlled non-production fixture or wait
   until the municipality creates a real work order: start → checklist/GPS →
   submit → `SUBMITTED`.
5. Keep public Vercel + no-login as a security exception until a private
   network boundary is established or explicitly accepted by the owner.
6. Neon credential rotation remains a release gate because the original
   credential was exposed during setup; handle it only through the account UI
   or a secure local environment.

## REVIEW

- The UI retry path reuses `mutationId` after the evidence write, preserving
  idempotency if the subsequent state transition fails.
- The current UI slice does not implement QR scan, IndexedDB offline mutation
  queue, photo attachments, or dashboard actions.
- Do not mark production complete from build/CI alone; require runtime and UAT
  evidence according to `docs/spec/06_DELIVERY_QA_UAT.md`.

