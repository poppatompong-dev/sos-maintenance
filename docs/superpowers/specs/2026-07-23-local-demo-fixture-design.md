# Local Demo Work-Order Fixture Design

## Goal

Let the owner exercise the connected `/today` workflow against a disposable
local PostGIS database without creating fabricated work orders in Neon or any
production environment.

## Decision

Add one explicit CLI command, `pnpm db:seed:demo`, that creates exactly one
clearly labelled local demo work order. The command is fail-closed and must
validate its environment before constructing or using a Prisma client.

The fixture uses existing reference data created by `pnpm db:setup`:

- asset `EP01`;
- the published monthly-field checklist and its maintenance plan;
- the stable `internal-operator` actor.

It creates work order `DEMO-LOCAL-EP01-MONTHLY` in `ASSIGNED` status and assigns
it to the internal actor. Re-running the command leaves the existing work order
unchanged and ensures no duplicate assignment exists.

## Safety boundary

All of these checks must pass before any database access:

1. `LOCAL_DEMO_CONFIRM` equals the exact value `SOS_LOCAL_DEMO`.
2. `NODE_ENV` is not `production`.
3. `DATABASE_URL` is present, parseable, and uses `postgres:` or `postgresql:`.
4. The database host is exactly `localhost`, `127.0.0.1`, `[::1]`, or `::1`.
5. The database name is exactly `sos`, matching the repository's development
   Docker Compose service.

Any failed check exits non-zero with a message that explains the safe recovery
without printing the connection string. The command never accepts a general
override for remote hosts.

## Components

- `prisma/demo-fixture-guard.ts`: pure environment validation, with unit tests.
- `prisma/demo-fixture.ts`: Prisma transaction that resolves seeded references
  and idempotently creates the work order and assignment.
- `prisma/seed-demo.ts`: thin CLI entry point that validates first, connects,
  creates the fixture, reports the demo code, and disconnects.
- `prisma/demo-fixture.itest.ts`: real-Postgres integration proof that two calls
  produce one work order and one assignment.
- `package.json`: exposes `db:seed:demo`.
- `docs/DEMO_RUNBOOK.md`: exact local start, seed, test, and stop procedure.

## Data flow

`docker compose up -d postgres` starts local PostGIS. `pnpm db:setup` applies
migrations and reference seed data. With the explicit confirmation variable set,
`pnpm db:seed:demo` validates the environment, resolves the seeded EP01/monthly
records, and commits the work order plus assignment atomically.

The owner then opens `/today`, starts the assigned work, answers every checklist
item, permits GPS, submits the inspection, and verifies that the card changes to
`SUBMITTED`. The existing mutation ID behavior remains responsible for retry
idempotency.

## Error handling

- Missing reference data: fail with an instruction to run `pnpm db:setup`.
- Partial fixture creation: Prisma transaction rolls back.
- Existing fixture: return it unchanged; do not reset completed evidence or
  workflow state.
- Remote or production-like configuration: fail before Prisma connects.

## Verification

- Unit tests cover every guard rejection and the three loopback host forms.
- Integration test calls the fixture twice and asserts one work order and one
  assignment with the correct asset, checklist, plan, actor, and status.
- Full gates: unit, integration, typecheck, lint, build, and diff check.
- Browser verification covers `/today` load, `ASSIGNED → IN_PROGRESS`,
  checklist/GPS submission, and `IN_PROGRESS → SUBMITTED`.
- Database verification confirms one mutation/evidence set and the final work
  order status.

## Non-goals

- No production or Neon demo data.
- No changes to readiness, work-state, inspection, or authorization rules.
- No automatic reset of a submitted demo work order.
- No QR, photo, or offline queue implementation in this slice.
- No GPS mandatory-reason fix in this slice. The database already has
  `ChecklistResponse.locationReason`, but the DTO/service/UI path does not yet
  collect or persist it; UAT case 8 remains open.

## Alternatives considered

1. **Local guarded fixture — selected.** Fast, isolated, reproducible, and does
   not require a new account or secret.
2. **Wait for a real production work order.** Safest for production data but
   leaves the owner unable to test the workflow now.
3. **Dedicated cloud staging database.** Useful later, but adds account,
   secret-management, and deployment work that is unnecessary for this slice.
