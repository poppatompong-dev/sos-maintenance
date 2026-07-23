# Local Demo Work-Order Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: before executing this plan you
> MUST read and follow the `executing-plans` sub-skill. Work top-to-bottom, one
> checkbox at a time, and do not tick a box until its stated command produces the
> stated result. Stop and report if any RED step fails to fail or any GREEN step
> fails to pass. Never write to a remote/production database. Never print a
> connection string. Use the exact file paths and code below — no placeholders.

## Goal

Give the owner a way to click through the **connected** `/today` workflow against
a disposable local PostGIS database, without ever creating a fabricated work order
in Neon or any production environment. Add one fail-closed CLI command,
`pnpm db:seed:demo`, that (a) validates the environment is a confirmed local `sos`
database before any database access, then (b) idempotently creates exactly one
clearly labelled demo work order `DEMO-LOCAL-EP01-MONTHLY` on the seeded EP01
asset, wired to the seeded monthly checklist/plan and assigned to the seeded
internal-operator actor. This closes ENGINEERING_LOOP queue item **4** ("Safe test
env + guarded demo fixture") and unblocks item **5** ("Workflow UI `/today` UAT").
It does **not** touch item **6** (GPS >100m mandatory reason), which stays out of
scope — see §11.

## Architecture

- **Guard (pure, no IO):** `prisma/demo-fixture-guard.ts` validates the
  environment and returns a discriminated `DemoGuardResult`. It runs BEFORE any
  Prisma client is constructed and never echoes the connection string. Unit-tested
  in the DB-free `pnpm test` run.
- **Fixture (transactional IO):** `prisma/demo-fixture.ts` resolves seeded
  reference data (EP01, the monthly checklist/plan, the internal actor) and
  idempotently creates one work order + one assignment inside a single Prisma
  transaction. It throws a clear `MissingReferenceError` if `pnpm db:setup` has not
  been run. The work-order code is parameterised so tests can use a distinct code
  while the CLI always uses the owner-visible default.
- **CLI (composition):** `prisma/seed-demo.ts` calls the guard first, then the
  fixture with the public default code, reports the result, and disconnects. It
  reads `process.env` directly and does NOT auto-load `.env` (tsx does not
  auto-load dotenv), so the runbook sets environment variables explicitly.
- **Ports/adapters boundary is unchanged:** no `src/**`, no schema, no readiness /
  work-state / inspection / authz logic is touched.

## Tech Stack

- Node 22+, pnpm 10.34.5, TypeScript, `tsx` for the CLI entry point.
- Prisma 6 + PostgreSQL/PostGIS (`postgis/postgis:16-3.4` via Docker Compose,
  database `sos` on `localhost:5432`).
- Vitest — unit config (`vitest.config.ts`, includes `prisma/**/*.{test,spec}.ts`)
  and integration config (`vitest.integration.config.ts`, includes
  `prisma/**/*.itest.ts`, `fileParallelism: false`, 30s timeouts).
- Next.js 16 App Router for the `/today` field shell used in browser verification.

---

### Plan metadata

- **Spec:** `docs/superpowers/specs/2026-07-23-local-demo-fixture-design.md`
- **Repo / branch:** sos-maintenance / `main` (base commit `486c99d`,
  Asia/Bangkok, 2026-07-23).
- **Approach:** TDD (red → green → refactor). Quality gates: `pnpm test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`. Integration
  gate: `pnpm test:integration`.
- **Commit trailer (required):** `Co-Authored-By: Claude <noreply@anthropic.com>`
- **Out of scope:** GPS >100m mandatory reason (UAT case 8 — schema already has
  `ChecklistResponse.locationReason`; only DTO/service/UI wiring is absent);
  readiness/work-state/inspection/authz rule changes; QR/photo/offline queue; any
  production or Neon demo data.
- **Success criteria:** guard rejects every non-local / non-confirmed environment
  before any Prisma connection (DB-free unit tests); `pnpm db:seed:demo` on a local
  `sos` DB creates exactly one ASSIGNED `DEMO-LOCAL-EP01-MONTHLY` on EP01 with the
  monthly checklist/plan and one assignment, idempotent on re-run; integration
  proof shows two calls → one work order + one assignment; browser `/today`
  ASSIGNED → เริ่มงาน → checklist + (mocked-at-EP01) GPS → ส่งผลตรวจ → SUBMITTED;
  all gates green; docs/checkpoints updated; branch pushed; CI `quality` +
  `integration` jobs green.

---

## 0. Reconciliation and verified facts

This slice is additive and reversible. The guard is pure and TDD-proven in the
DB-free unit run; the fixture's correctness/idempotency is proven against a live
PostGIS in the integration run; the browser check proves the connected `/today`
happy path on a local DB.

### Verified facts this plan is built on (read-only, already confirmed)
- `prisma/schema.prisma` `ChecklistResponse.locationReason` **already exists**
  (line ~461); the DTO/service/UI path does not yet collect or persist it. That
  is UAT case 8 and is **explicitly out of scope here**.
- `prisma/seed.ts` creates: internal actor `INTERNAL_ACTOR_ID =
  '00000000-0000-0000-0000-000000000001'` (username `internal-operator`);
  `AssetType` key `SOS_POLE`; 27 assets `EP01..EP27`; `ChecklistTemplate`
  `MONTHLY_FIELD` → version 1 → items; and a `MaintenancePlan` unique on
  `{ kind: MONTHLY_FIELD, assetTypeKey: SOS_POLE }` carrying `checklistVersionId`.
- `WorkOrder` requires `code` (unique), `kind`, `assetId`; `planId` and
  `checklistVersionId` are optional but **required for `/today` to render the
  checklist** (`src/server/queries/sync.ts` selects `checklistVersion.items`).
- `Assignment` has `@@unique([workOrderId, userId])` → compound key
  `workOrderId_userId` for idempotent upsert.
- Internal mode: `getSyncBootstrap(userId=null)` returns **all** open field work
  orders (statuses `PUBLISHED|ASSIGNED|IN_PROGRESS|REOPENED`), so the demo order
  surfaces in `/today` even though we also (realistically) assign it.
- `docker-compose.yml` provides local `postgres` (postgis/postgis:16-3.4) with
  `POSTGRES_USER/PASSWORD/DB = sos` on `localhost:5432`. `.env.example` ships
  `AUTH_MODE=internal` + `DATABASE_URL=postgresql://sos:sos@localhost:5432/sos?schema=public`.
- Unit config (`vitest.config.ts`) includes `prisma/**/*.{test,spec}.ts` →
  `prisma/demo-fixture-guard.test.ts` runs under `pnpm test` (DB-free).
- Integration config (`vitest.integration.config.ts`) includes
  `prisma/**/*.itest.ts`, `fileParallelism: false`, 30s timeouts →
  `prisma/demo-fixture.itest.ts` runs under `pnpm test:integration`.
- CI `integration` job runs `pnpm exec prisma generate → pnpm db:setup →
  pnpm test:integration` against an ephemeral `sos` PostGIS service, so the
  fixture's seeded references exist there.

## 1. Files this plan creates or edits (exact paths)

Create:
- `prisma/demo-fixture-guard.ts` — pure environment validation (no IO).
- `prisma/demo-fixture-guard.test.ts` — unit tests for every guard rejection +
  the loopback host forms (runs in `pnpm test`).
- `prisma/demo-fixture.ts` — Prisma transaction that resolves seeded references
  and idempotently creates the work order + assignment.
- `prisma/seed-demo.ts` — thin CLI entry point: validate → connect → create →
  report → disconnect.
- `prisma/demo-fixture.itest.ts` — real-Postgres integration proof (two calls →
  one work order, one assignment).
- `docs/DEMO_RUNBOOK.md` — exact local start / seed / test / stop procedure.

Edit:
- `package.json` — add `"db:seed:demo": "tsx prisma/seed-demo.ts"`.
- `docs/RESUME_HERE.md` — flip "Next slice" fixture status once green.
- `docs/ROADMAP_CHECKPOINT.md` — record the fixture + evidence.
- `docs/WORKLOG.md` — append a dated entry.
- `docs/ENGINEERING_LOOP.md` — move queue item 4 to DONE with evidence.

Do **not** edit anything under `src/**`, `prisma/schema.prisma`,
`prisma/seed.ts`, `.github/workflows/**`, or `.env.example`.

## 2. Preconditions (run once, before any step)

- [ ] `git pull` on `main`; confirm clean tree: `git status --short` prints
      nothing.
- [ ] Confirm base: `git rev-parse HEAD` (record as the rollback point).
- [ ] `pnpm install` (only if deps drifted; nothing new is added by this plan).
- [ ] Confirm the fixture's data identities are still true — read
      `prisma/seed.ts` and verify `INTERNAL_ACTOR_ID`, `ASSET_TYPE_KEY='SOS_POLE'`,
      the `MONTHLY_FIELD` checklist key, and the `MaintenancePlan` compound
      unique `kind_assetTypeKey`. If any changed, stop and report before coding.

---

## 3. Step A — Guard (pure, unit-tested): RED → GREEN → REFACTOR

The guard is pure and must be provable in the **DB-free** `pnpm test` run. Write
the test first (RED), then the implementation (GREEN).

### A.1 RED — write the failing guard unit test

- [ ] Create `prisma/demo-fixture-guard.test.ts` with the full content below.

```ts
// prisma/demo-fixture-guard.test.ts
import { describe, expect, it } from 'vitest';
import {
  evaluateDemoGuard,
  REQUIRED_CONFIRM,
  REQUIRED_DB_NAME,
  type DemoGuardEnv,
} from './demo-fixture-guard';

const LOCAL_URL = 'postgresql://sos:sos@localhost:5432/sos?schema=public';

/** A fully valid local-demo environment; individual tests override one key. */
function baseEnv(overrides: Partial<DemoGuardEnv> = {}): DemoGuardEnv {
  return {
    LOCAL_DEMO_CONFIRM: REQUIRED_CONFIRM,
    NODE_ENV: 'development',
    DATABASE_URL: LOCAL_URL,
    ...overrides,
  };
}

describe('evaluateDemoGuard', () => {
  it('accepts a confirmed local sos database', () => {
    const result = evaluateDemoGuard(baseEnv());
    expect(result.ok).toBe(true);
  });

  it('rejects a missing confirmation variable', () => {
    const result = evaluateDemoGuard(baseEnv({ LOCAL_DEMO_CONFIRM: undefined }));
    expect(result.ok).toBe(false);
  });

  it('rejects a wrong confirmation value', () => {
    const result = evaluateDemoGuard(baseEnv({ LOCAL_DEMO_CONFIRM: 'yes' }));
    expect(result.ok).toBe(false);
  });

  it('rejects NODE_ENV=production', () => {
    const result = evaluateDemoGuard(baseEnv({ NODE_ENV: 'production' }));
    expect(result.ok).toBe(false);
  });

  it('rejects NODE_ENV=PRODUCTION case-insensitively', () => {
    const result = evaluateDemoGuard(baseEnv({ NODE_ENV: 'PRODUCTION' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a missing DATABASE_URL', () => {
    const result = evaluateDemoGuard(baseEnv({ DATABASE_URL: undefined }));
    expect(result.ok).toBe(false);
  });

  it('rejects an unparseable DATABASE_URL', () => {
    const result = evaluateDemoGuard(baseEnv({ DATABASE_URL: 'not a url' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a non-postgres protocol', () => {
    const result = evaluateDemoGuard(
      baseEnv({ DATABASE_URL: 'mysql://sos:sos@localhost:5432/sos' }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a remote host', () => {
    const result = evaluateDemoGuard(
      baseEnv({ DATABASE_URL: 'postgresql://u:p@db.neon.tech:5432/sos' }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a non-sos database name', () => {
    const result = evaluateDemoGuard(
      baseEnv({ DATABASE_URL: 'postgresql://sos:sos@localhost:5432/prod' }),
    );
    expect(result.ok).toBe(false);
  });

  it.each([
    'postgresql://sos:sos@localhost:5432/sos',
    'postgres://sos:sos@127.0.0.1:5432/sos',
    'postgresql://sos:sos@[::1]:5432/sos',
  ])('accepts loopback host form %s', (url) => {
    const result = evaluateDemoGuard(baseEnv({ DATABASE_URL: url }));
    expect(result.ok).toBe(true);
  });

  it('never leaks the connection string in a rejection reason', () => {
    const secret = 'postgresql://sos:supersecret@db.neon.tech:5432/prod';
    const result = evaluateDemoGuard(baseEnv({ DATABASE_URL: secret }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).not.toContain('supersecret');
      expect(result.reason).not.toContain('db.neon.tech');
      expect(result.reason).not.toContain(secret);
    }
  });

  it('exposes the required constants used by callers and docs', () => {
    expect(REQUIRED_CONFIRM).toBe('SOS_LOCAL_DEMO');
    expect(REQUIRED_DB_NAME).toBe('sos');
  });
});
```

- [ ] Run the RED command and confirm it fails to **compile/resolve** (the module
      does not exist yet):

```
pnpm test -- prisma/demo-fixture-guard.test.ts
```

Expected RED: the run errors with `Failed to resolve import "./demo-fixture-guard"`
(module not found). This is the intended failing state.

### A.2 GREEN — implement the guard

- [ ] Create `prisma/demo-fixture-guard.ts` with the full content below.

```ts
// prisma/demo-fixture-guard.ts
//
// Pure, IO-free environment validation for the LOCAL demo fixture. This module
// imports nothing from Prisma and must be safe to unit-test in the DB-free
// `pnpm test` run. It is the fail-closed gate that runs BEFORE any database
// client is constructed. It never returns or logs the connection string.

/** The subset of environment variables the guard inspects. */
export type DemoGuardEnv = Record<string, string | undefined> & {
  LOCAL_DEMO_CONFIRM?: string;
  NODE_ENV?: string;
  DATABASE_URL?: string;
};

export interface DemoGuardOk {
  readonly ok: true;
}

export interface DemoGuardRejected {
  readonly ok: false;
  /** Human-safe reason. MUST NOT contain the connection string. */
  readonly reason: string;
}

export type DemoGuardResult = DemoGuardOk | DemoGuardRejected;

/** Exact confirmation value the operator must set to run the demo seed. */
export const REQUIRED_CONFIRM = 'SOS_LOCAL_DEMO';

/** Only this database name is accepted — matches the dev Docker Compose service. */
export const REQUIRED_DB_NAME = 'sos';

/** Accepted Postgres URL schemes. */
const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

/**
 * Accepted loopback hosts. WHATWG `URL.hostname` returns IPv6 literals wrapped
 * in brackets (`[::1]`); we also accept the bracketless `::1` after stripping.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function reject(reason: string): DemoGuardRejected {
  return { ok: false, reason };
}

/**
 * Validate that the current environment is an explicitly confirmed, non-production,
 * local `sos` Postgres database. Returns `{ ok: true }` only when EVERY check
 * passes. Reasons explain safe recovery and never echo the connection string.
 */
export function evaluateDemoGuard(env: DemoGuardEnv): DemoGuardResult {
  // 1. Explicit operator confirmation.
  if (env.LOCAL_DEMO_CONFIRM !== REQUIRED_CONFIRM) {
    return reject(
      `Refusing to run: set LOCAL_DEMO_CONFIRM=${REQUIRED_CONFIRM} to confirm a LOCAL demo seed.`,
    );
  }

  // 2. Never in production (case-insensitive: `production`, `PRODUCTION`, …).
  if ((env.NODE_ENV ?? '').toLowerCase() === 'production') {
    return reject('Refusing to run: NODE_ENV=production is not allowed for the demo seed.');
  }

  // 3. DATABASE_URL present and parseable.
  const raw = env.DATABASE_URL;
  if (!raw) {
    return reject('Refusing to run: DATABASE_URL is not set.');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return reject('Refusing to run: DATABASE_URL is not a parseable URL.');
  }

  // 3b. Postgres scheme only.
  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    return reject('Refusing to run: DATABASE_URL must use postgres: or postgresql:.');
  }

  // 4. Loopback host only. `hostname` omits the port; accept bracketed + bare ::1.
  const host = url.hostname;
  const bareHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (!LOOPBACK_HOSTS.has(host) && !LOOPBACK_HOSTS.has(bareHost)) {
    return reject(
      'Refusing to run: DATABASE_URL host must be localhost, 127.0.0.1, or ::1 (local only).',
    );
  }

  // 5. Database name must be exactly `sos`.
  const dbName = url.pathname.replace(/^\//, '');
  if (dbName !== REQUIRED_DB_NAME) {
    return reject(
      `Refusing to run: DATABASE_URL database name must be "${REQUIRED_DB_NAME}".`,
    );
  }

  return { ok: true };
}
```

- [ ] Run the GREEN command and confirm all guard tests pass:

```
pnpm test -- prisma/demo-fixture-guard.test.ts
```

Expected GREEN: 1 test file, **15 tests passed** (the `it.each` counts as its 3
loopback cases), exit code 0.

### A.3 REFACTOR

- [ ] Re-read `prisma/demo-fixture-guard.ts` for clarity; keep every rejection
      string free of the connection string. No behavioural change. Re-run the
      command in A.2 to confirm still green.

---

## 4. Step B — Fixture transaction: implementation + wiring

The fixture's correctness is proven by the integration test in §5; here we write
the transaction and the CLI, and prove the CLI is fail-closed with a fast local
smoke that needs no database.

### B.1 Implement the idempotent fixture

- [ ] Create `prisma/demo-fixture.ts` with the full content below.

```ts
// prisma/demo-fixture.ts
//
// Idempotent LOCAL demo fixture. Resolves reference data created by
// `pnpm db:setup` (asset EP01, the monthly checklist/plan, the internal actor)
// and creates exactly one clearly labelled demo work order plus its assignment
// inside a single transaction. Re-running leaves the existing work order and
// assignment unchanged. This module performs IO and must only ever be invoked
// after `evaluateDemoGuard` has returned ok (enforced by prisma/seed-demo.ts).

import { MaintenanceKind, WorkOrderStatus, type PrismaClient } from '@prisma/client';

/** Public, stable identifiers for the demo fixture (also used by docs/tests). */
export const DEMO_WORK_ORDER_CODE = 'DEMO-LOCAL-EP01-MONTHLY';
export const DEMO_ASSET_CODE = 'EP01';
export const DEMO_ASSET_TYPE_KEY = 'SOS_POLE';
export const INTERNAL_ACTOR_ID = '00000000-0000-0000-0000-000000000001';

export interface DemoFixtureResult {
  readonly workOrderId: string;
  readonly workOrderCode: string;
  readonly status: WorkOrderStatus;
  readonly assetCode: string;
  readonly assignedUserId: string;
  /** false when a pre-existing fixture was returned unchanged (idempotent replay). */
  readonly created: boolean;
}

export interface CreateDemoFixtureOptions {
  /**
   * Override the work-order code. The CLI always uses the public default
   * `DEMO_WORK_ORDER_CODE`; the integration test passes a distinct code so its
   * cleanup can never touch the owner-visible demo work order or any submitted
   * immutable evidence.
   */
  readonly workOrderCode?: string;
}

export class MissingReferenceError extends Error {
  constructor(what: string) {
    super(`Missing reference data (${what}). Run \`pnpm db:setup\` first, then re-run.`);
    this.name = 'MissingReferenceError';
  }
}

/**
 * Create (or return unchanged) the single local demo work order on EP01, wired
 * to the seeded monthly checklist/plan and assigned to the internal actor.
 * Throws MissingReferenceError if `pnpm db:setup` has not populated references.
 */
export async function createDemoFixture(
  prisma: PrismaClient,
  options: CreateDemoFixtureOptions = {},
): Promise<DemoFixtureResult> {
  const workOrderCode = options.workOrderCode ?? DEMO_WORK_ORDER_CODE;
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({ where: { code: DEMO_ASSET_CODE } });
    if (!asset) throw new MissingReferenceError('asset EP01');

    const plan = await tx.maintenancePlan.findUnique({
      where: {
        kind_assetTypeKey: {
          kind: MaintenanceKind.MONTHLY_FIELD,
          assetTypeKey: DEMO_ASSET_TYPE_KEY,
        },
      },
    });
    if (!plan) throw new MissingReferenceError('monthly maintenance plan');

    const actor = await tx.user.findUnique({ where: { id: INTERNAL_ACTOR_ID } });
    if (!actor) throw new MissingReferenceError('internal-operator actor');

    const existing = await tx.workOrder.findUnique({
      where: { code: workOrderCode },
    });

    const workOrder =
      existing ??
      (await tx.workOrder.create({
        data: {
          code: workOrderCode,
          kind: MaintenanceKind.MONTHLY_FIELD,
          assetId: asset.id,
          planId: plan.id,
          checklistVersionId: plan.checklistVersionId,
          status: WorkOrderStatus.ASSIGNED,
        },
      }));

    // Idempotent assignment: unique on (workOrderId, userId).
    await tx.assignment.upsert({
      where: {
        workOrderId_userId: { workOrderId: workOrder.id, userId: actor.id },
      },
      update: {},
      create: { workOrderId: workOrder.id, userId: actor.id },
    });

    return {
      workOrderId: workOrder.id,
      workOrderCode: workOrder.code,
      status: workOrder.status,
      assetCode: asset.code,
      assignedUserId: actor.id,
      created: existing === null,
    };
  });
}
```

### B.2 Implement the fail-closed CLI entry point

- [ ] Create `prisma/seed-demo.ts` with the full content below.

```ts
// prisma/seed-demo.ts
//
// CLI entry point for `pnpm db:seed:demo`. Validates the environment FIRST with
// the pure guard; only if it passes does it construct a Prisma client, create the
// idempotent fixture, report the demo code, and disconnect. Fails closed with a
// non-zero exit and a safe message (no connection string) on any guard failure.

import { PrismaClient } from '@prisma/client';
import { evaluateDemoGuard } from './demo-fixture-guard';
import { createDemoFixture, DEMO_WORK_ORDER_CODE } from './demo-fixture';

async function main(): Promise<void> {
  const guard = evaluateDemoGuard(process.env);
  if (!guard.ok) {
    console.error(`✖ Local demo seed refused. ${guard.reason}`);
    process.exit(1);
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await createDemoFixture(prisma);
    console.log(
      `✔ Demo work order ${result.workOrderCode} on ${result.assetCode} ` +
        `is ${result.status} (${result.created ? 'created' : 'already present'}).`,
    );
    console.log(`  Open /today to start it. Demo code: ${DEMO_WORK_ORDER_CODE}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('✖ Demo seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
```

### B.3 Wire the package script

- [ ] Edit `package.json`: inside `"scripts"`, add the demo seed immediately
      after the existing `"db:seed"` line so related commands stay grouped.

Change (exact):

```json
    "db:seed": "prisma db seed",
    "db:seed:demo": "tsx prisma/seed-demo.ts",
```

- [ ] Confirm valid JSON and the script is registered:

```
pnpm run db:seed:demo --help
```

Expected: `pnpm` lists/attempts the script (it exists). It is fine if the guard
then aborts — see B.4 for the deterministic fail-closed proof.

### B.4 GREEN (no DB) — prove the CLI fails closed

This proves the safety boundary blocks a remote/unconfirmed run **before** any
Prisma connection, and needs no database.

- [ ] Run with NO confirmation set and confirm it refuses:

```
pnpm db:seed:demo
```

Expected: stderr line `✖ Local demo seed refused. Refusing to run: set
LOCAL_DEMO_CONFIRM=SOS_LOCAL_DEMO ...`, process exits non-zero (`echo $?` → `1`
in Bash, `$LASTEXITCODE` → `1` in PowerShell). No connection attempt.

- [ ] Run with confirmation set but a **remote** URL and confirm it still refuses
      before connecting (PowerShell form):

```powershell
$env:LOCAL_DEMO_CONFIRM = 'SOS_LOCAL_DEMO'
$env:DATABASE_URL = 'postgresql://u:p@db.neon.tech:5432/sos'
pnpm db:seed:demo
$env:LOCAL_DEMO_CONFIRM = $null
$env:DATABASE_URL = $null
```

Expected: stderr `✖ Local demo seed refused. Refusing to run: DATABASE_URL host
must be localhost, 127.0.0.1, or ::1 (local only).`; exit code `1`; the string
`db.neon.tech` appears only in the input we set, never echoed by the tool.

### B.5 Static gates for the new source

- [ ] `pnpm typecheck` → exit 0 (verifies enum/type consistency of
      `MaintenanceKind`, `WorkOrderStatus`, `DemoFixtureResult`,
      `CreateDemoFixtureOptions`, and the guard types).
- [ ] `pnpm lint` → exit 0.
- [ ] `pnpm test` → all unit tests pass, now including
      `prisma/demo-fixture-guard.test.ts` (total = previous 167 + 15 new = **182**
      tests). Record the exact number the run prints.
- [ ] `pnpm build` → exit 0.
- [ ] `git diff --check` → no whitespace errors.

---

## 5. Step C — Integration proof (real Postgres)

The fixture's idempotency is proven against a live PostGIS via
`pnpm test:integration`. This requires a local database (see §6) or the CI
`integration` job. The **precondition is `pnpm db:setup`** — the test does NOT
fabricate fallback reference data; it asserts the seeded references exist and
fails fast with a clear message if they do not. It uses a **distinct work-order
code** (`DEMO-LOCAL-EP01-MONTHLY-ITEST`) so its cleanup can never collide with the
owner-visible `DEMO-LOCAL-EP01-MONTHLY` or any submitted immutable evidence.

The fixture code already exists from §4, so writing this test is not a genuine
RED step; it is written and then run GREEN.

### C.1 Write the integration test

- [ ] Create `prisma/demo-fixture.itest.ts` with the full content below.

```ts
// prisma/demo-fixture.itest.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createDemoFixture,
  DEMO_ASSET_CODE,
  DEMO_ASSET_TYPE_KEY,
  INTERNAL_ACTOR_ID,
} from './demo-fixture';

/**
 * Real-Postgres proof that the guarded demo fixture is idempotent: two calls
 * produce exactly one work order and one assignment, wired to EP01, the monthly
 * checklist/plan, and the internal actor, in ASSIGNED status.
 *
 * PRECONDITION: `pnpm db:setup` (migrate + PostGIS + seed) has been run against
 * this DATABASE_URL — the same step CI's `integration` job runs. This test does
 * NOT fabricate reference data; it asserts the seed exists and fails clearly if
 * it does not.
 *
 * It uses a work-order code distinct from the owner-visible demo code so its
 * teardown can never delete a real demo work order or submitted evidence. The
 * integration work order is never submitted, so deleting it + its assignment in
 * teardown is safe.
 */
const ITEST_WORK_ORDER_CODE = 'DEMO-LOCAL-EP01-MONTHLY-ITEST';
const prisma = new PrismaClient();

async function assertSeededReferences(): Promise<void> {
  const [asset, plan, actor] = await Promise.all([
    prisma.asset.findUnique({ where: { code: DEMO_ASSET_CODE } }),
    prisma.maintenancePlan.findUnique({
      where: {
        kind_assetTypeKey: { kind: 'MONTHLY_FIELD', assetTypeKey: DEMO_ASSET_TYPE_KEY },
      },
    }),
    prisma.user.findUnique({ where: { id: INTERNAL_ACTOR_ID } }),
  ]);

  const missing: string[] = [];
  if (!asset) missing.push('asset EP01');
  if (!plan) missing.push('monthly maintenance plan');
  if (!actor) missing.push('internal-operator actor');
  if (missing.length > 0) {
    throw new Error(
      `Seeded references missing (${missing.join(', ')}). Run \`pnpm db:setup\` ` +
        'before this integration test.',
    );
  }
}

async function cleanupItestWorkOrder(): Promise<void> {
  const wo = await prisma.workOrder.findUnique({ where: { code: ITEST_WORK_ORDER_CODE } });
  if (!wo) return;
  await prisma.assignment.deleteMany({ where: { workOrderId: wo.id } });
  await prisma.workOrder.delete({ where: { id: wo.id } });
}

beforeAll(async () => {
  await assertSeededReferences(); // fail clearly if `pnpm db:setup` has not run
  await cleanupItestWorkOrder(); // start from a known-clean state
});

afterAll(async () => {
  await cleanupItestWorkOrder();
  await prisma.$disconnect();
});

describe('createDemoFixture (integration)', () => {
  it('creates exactly one ASSIGNED demo work order wired to EP01/monthly/internal actor', async () => {
    const first = await createDemoFixture(prisma, { workOrderCode: ITEST_WORK_ORDER_CODE });

    expect(first.created).toBe(true);
    expect(first.workOrderCode).toBe(ITEST_WORK_ORDER_CODE);
    expect(first.status).toBe('ASSIGNED');
    expect(first.assetCode).toBe(DEMO_ASSET_CODE);
    expect(first.assignedUserId).toBe(INTERNAL_ACTOR_ID);

    const wo = await prisma.workOrder.findUniqueOrThrow({
      where: { code: ITEST_WORK_ORDER_CODE },
      include: { asset: true, plan: true, checklistVersion: true, assignments: true },
    });
    expect(wo.status).toBe('ASSIGNED');
    expect(wo.asset.code).toBe(DEMO_ASSET_CODE);
    expect(wo.planId).not.toBeNull();
    expect(wo.checklistVersionId).not.toBeNull();
    expect(wo.assignments).toHaveLength(1);
    expect(wo.assignments[0].userId).toBe(INTERNAL_ACTOR_ID);
  });

  it('is idempotent: a second call creates no duplicate work order or assignment', async () => {
    const second = await createDemoFixture(prisma, { workOrderCode: ITEST_WORK_ORDER_CODE });
    expect(second.created).toBe(false);
    expect(second.workOrderCode).toBe(ITEST_WORK_ORDER_CODE);

    const workOrders = await prisma.workOrder.count({ where: { code: ITEST_WORK_ORDER_CODE } });
    const wo = await prisma.workOrder.findUniqueOrThrow({ where: { code: ITEST_WORK_ORDER_CODE } });
    const assignments = await prisma.assignment.count({ where: { workOrderId: wo.id } });

    expect(workOrders).toBe(1);
    expect(assignments).toBe(1);
  });
});
```

### C.2 GREEN — run the integration proof

- [ ] With a local `sos` database up, migrated, and seeded (see §6), run:

```
pnpm test:integration -- prisma/demo-fixture.itest.ts
```

Expected GREEN: 1 file, **2 tests passed**, exit code 0. If the seed is absent
the run fails fast in `beforeAll` with the "Run `pnpm db:setup`" message — the
intended clear failure, never a silent pass.

- [ ] Run the full integration suite to prove no regression and correct totals:

```
pnpm test:integration
```

Expected: previous **8 files / 41 tests** plus this new file → **9 files / 43
tests** passing, exit code 0. Record the exact printed totals.

---

## 6. Local Docker setup (owner + CI parity)

These are the exact commands the executor and the owner use to stand up the
disposable local database. This machine may lack Docker; if so, the integration
proof in §5 is deferred to CI's `integration` job (which performs the same
`pnpm db:setup` against an ephemeral `sos` PostGIS) and the browser check in §7
is performed by the owner on a Docker-capable machine.

Do **not** create or overwrite `.env`. The demo CLI runs via `tsx`, which does
NOT auto-load dotenv, so set the required variables **explicitly** in the shell;
the Prisma CLI (`pnpm db:setup`) reads the same shell variables.

```powershell
git pull
docker compose up -d postgres          # only the DB; internal mode needs no Keycloak
pnpm install

# Explicit process env for this shell (no .env is created or overwritten):
$env:DATABASE_URL = 'postgresql://sos:sos@localhost:5432/sos?schema=public'
$env:AUTH_MODE = 'internal'
$env:NODE_ENV = 'development'
$env:LOCAL_DEMO_CONFIRM = 'SOS_LOCAL_DEMO'

pnpm db:setup                          # prisma migrate deploy + PostGIS + seed 27 poles
pnpm db:seed:demo                      # create ONE guarded demo work order (idempotent)
pnpm db:seed:demo                      # run twice → still one; proves idempotency by hand
```

Expected: first `db:seed:demo` prints `... is ASSIGNED (created).`; second prints
`... is ASSIGNED (already present).`

Teardown when finished (preserves the local database by default):

```powershell
$env:LOCAL_DEMO_CONFIRM = $null         # clear the confirmation for safety
docker compose down                     # stop containers; the named db-data volume is kept (no -v)
```

No automated data cleanup is in scope. The demo work order intentionally persists
in the local database between runs (that is what makes `/today` testable). The
database is fully disposable via its Docker volume, but discarding that volume is
a deliberate manual owner action and is **not** performed by this plan.

---

## 7. Step D — Browser `/today` verification (local DB only)

Performed on the local DB after §6, in the **same shell** that has the env
variables set (no `.env` is created; `pnpm dev` / Next.js reads the process env
from that shell). Because screenshots in the in-app browser pane may time out,
verify the accessibility tree with `read_page` and probe status text / computed
values rather than relying on a screenshot.

### 7.1 Automated smoke — mocked geolocation at EP01

Mock the browser geolocation to EP01's **own** coordinates so the captured
position is ~0 m from the asset. This deliberately keeps the known GPS >100m
mandatory-reason gap (UAT case 8, out of scope — §11) from contaminating this
slice: with the position at EP01 no >100m review flag is raised, so the missing
reason field is never exercised here.

- [ ] `pnpm dev` → open `http://localhost:3000/today`.
- [ ] Before submitting, in the automation context fetch the bootstrap and mock
      geolocation to the demo asset's own coordinates:

```js
// distanceMeters ≈ 0 → no >100m review flag; the out-of-scope reason path is
// never hit. Uses the demo work order's own asset coordinates from the bootstrap.
const boot = await fetch('/api/sync/bootstrap', { cache: 'no-store' }).then((r) => r.json());
const demo = boot.workOrders.find((w) => w.code === 'DEMO-LOCAL-EP01-MONTHLY');
const { latitude, longitude } = demo.asset;
navigator.geolocation.getCurrentPosition = (success) =>
  success({ coords: { latitude, longitude, accuracy: 5 } });
```

- [ ] Confirm the demo card renders: heading `DEMO-LOCAL-EP01-MONTHLY`, asset line
      `EP01 · …`, status pill `มอบหมายแล้ว` (ASSIGNED), and a **non-zero** checklist
      count. Assert the card's `N รายการ` equals `demo.checklist.length` from the
      bootstrap and that `demo.checklist.length > 0` — do **not** assert a fixed
      number (the seeded MONTHLY_FIELD checklist defines the count).
- [ ] Click `เริ่มงาน` (Start). Expected: transition `ASSIGNED → IN_PROGRESS`;
      status pill becomes `กำลังดำเนินการ`; the checklist form appears with the same
      non-zero number of selects.
- [ ] Answer every checklist select (e.g. `ผ่าน`/`ไม่เกี่ยวข้อง`) so the submit
      button enables (label changes from `เลือกผลตรวจอีก N รายการ` to `ส่งผลตรวจ`).
- [ ] Click `ส่งผลตรวจ` (Submit). With geolocation mocked at EP01, expect
      `POST /api/inspections` then transition to `SUBMITTED`; card status becomes
      `รอตรวจรับ` with the note `ส่งผลตรวจแล้ว รอผู้วางแผนตรวจรับ`. No >100m review
      flag is raised.

### 7.2 Manual owner behaviour (honest about the UAT gap)

- [ ] When the owner runs this by hand on-site, the browser prompts for real GPS
      and captures the device's true position. If that position is >100m from EP01
      the response is flagged for review, but the **mandatory reason is still not
      collected** — UAT case 8 remains open and is out of scope here (§11). Do not
      represent the >100m path as complete.

### 7.3 Database verification (no secrets printed)

```
pnpm db:studio      # inspect ChecklistResponse + WorkOrder rows, or a read-only query
```

Confirm that: the demo `WorkOrder.status` is `SUBMITTED`; there is exactly one
`ChecklistResponse` set for this work order with a single `clientMutationId`; a
`ReadinessSnapshot` was written for EP01. Retrying submit reuses the same
`mutationId` and creates no duplicate evidence.

- [ ] Record the observed status text and row counts as evidence in WORKLOG.

---

## 8. Step E — Documentation and checkpoint updates

Update these only with **observed** results (test totals, exit codes, CI run id).

- [ ] Create `docs/DEMO_RUNBOOK.md` with: purpose; the exact §6 start/seed/verify/
      stop commands; the safety boundary summary (confirmation var + local `sos`
      only, fail-closed, never prints the connection string); the demo code
      `DEMO-LOCAL-EP01-MONTHLY`; and an explicit "never run against production/Neon"
      warning. Include the §7 browser happy-path steps.
- [ ] `docs/RESUME_HERE.md`: change the "Next slice — safe test environment +
      guarded demo fixture" item from "Not yet implemented" to implemented, with
      the command `pnpm db:seed:demo` and a pointer to `docs/DEMO_RUNBOOK.md`;
      keep the GPS >100m mandatory-reason gap open. Bump the `Last updated` line.
- [ ] `docs/ROADMAP_CHECKPOINT.md`: add a runtime-evidence row for the guarded
      fixture (unit guard tests + integration idempotency proof + browser
      happy-path), and note that queue item 4 is DONE while item 6 (GPS reason)
      stays open. Update the "constraints/gaps" section: the demo fixture now
      exists and is production-safe.
- [ ] `docs/WORKLOG.md`: append a dated (2026-07-23, Asia/Bangkok) entry
      describing the slice, the safety boundary decision, and the exact evidence
      (test totals, CI run id once known).
- [ ] `docs/ENGINEERING_LOOP.md`: move queue row 4 ("Safe test env + guarded demo
      fixture") to `DONE` with evidence; leave rows 5 (now unblocked) and 6 (GPS
      reason, still OPEN) as-is.

---

## 9. Step F — Full gates, commit, push, CI verification

- [ ] Re-run the complete local gate set from a clean shell and record each exit
      code / total:

```
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: `pnpm test` green with the new total (167 → **182**); typecheck, lint,
build exit 0; diff-check clean.

- [ ] Stage and commit (single logical slice). Use the required trailer verbatim:

```
git add -A
git commit -m "Add guarded local demo work-order fixture for /today UAT

Fail-closed pnpm db:seed:demo creates one idempotent ASSIGNED demo work
order (DEMO-LOCAL-EP01-MONTHLY) on EP01 for local sos databases only.
GPS >100m mandatory reason stays out of scope (UAT case 8).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] Push to `main`:

```
git push origin main
```

- [ ] Verify CI on the pushed commit. Confirm both jobs green and that the
      integration job's `pnpm test:integration` step includes the new file:

```
gh run list --branch main --limit 1
gh run watch <run-id> --exit-status
```

Expected: `quality` job green (typecheck/lint/`pnpm test` at the new total/
build); `integration` job green with the demo integration file passing after
`pnpm db:setup`. Record the run id and both job conclusions in ROADMAP_CHECKPOINT
and WORKLOG.

- [ ] If CI is red, do not retry blindly: read the failing step log, fix the root
      cause in a follow-up commit, and re-verify. Do not mark the slice DONE on a
      red run.

---

## 10. Rollback

- Rollback point: the base commit recorded in §2 (`git rev-parse HEAD` before any
  edit; clean tree). All new files are additive and the only edits are to
  `package.json` and docs.
- Code rollback: `git revert <commit>` (or reset to the base commit before push).
- Data rollback: the demo work order is **local-only** and never reaches
  production or Neon, so there is nothing to roll back remotely. No automated data
  cleanup is in scope; the local database is disposable via its Docker volume,
  which is a deliberate manual owner action, not a command this plan runs.

---

## 11. Out of scope (explicit) — GPS >100m mandatory reason

This slice does **not** implement the GPS >100m mandatory reason (UAT case 8).
Important nuance to preserve: `prisma/schema.prisma` **already** contains
`ChecklistResponse.locationReason` (and `locationException` / `reviewFlag`); the
database column exists. What is missing is the **DTO/service/UI wiring** that
collects and persists a reason when the captured position exceeds
`GPS_EXCEPTION_METERS` (100m). That wiring is a separate, later slice
(ENGINEERING_LOOP queue item 6) and must not be started here. Do not add,
migrate, or alter any schema in this plan.

Also out of scope: readiness/work-state/inspection/authorization rule changes;
QR, photo, and IndexedDB offline-queue features; any production or Neon demo data;
and any automatic reset of a submitted demo work order.

---

## 12. Self-review checklist (run before reporting DONE)

- [ ] Coverage: every spec component exists — guard (`prisma/demo-fixture-guard.ts`
      + `.test.ts`), fixture (`prisma/demo-fixture.ts`), CLI (`prisma/seed-demo.ts`),
      integration (`prisma/demo-fixture.itest.ts`), `package.json` script,
      `docs/DEMO_RUNBOOK.md`; checkpoints updated.
- [ ] Safety: all five guard checks (confirmation, non-production
      case-insensitively, parseable postgres URL, loopback host, `sos` db name)
      are enforced and unit-tested, including the three loopback host forms
      (`localhost`/`127.0.0.1`/`[::1]`), `NODE_ENV=PRODUCTION`, and the no-leak
      assertion; the CLI validates before constructing PrismaClient (§4 B.2) and
      is proven fail-closed with no DB (§4 B.4).
- [ ] Idempotency: real-Postgres proof shows two calls → one work order + one
      assignment (§5 C.2), using a distinct `-ITEST` work-order code so teardown
      cannot touch the owner-visible demo or submitted evidence; the test asserts
      the `pnpm db:setup` seed exists and fails clearly if absent (no fabricated
      reference data).
- [ ] Type consistency: `MaintenanceKind.MONTHLY_FIELD`, `WorkOrderStatus.ASSIGNED`,
      `DemoGuardEnv`/`DemoGuardResult`, `DemoFixtureResult`, and
      `CreateDemoFixtureOptions` (optional `workOrderCode`) all type-check under
      `pnpm typecheck`; `process.env` is assignable to `DemoGuardEnv`
      (`Record<string, string | undefined>`).
- [ ] Env hygiene: no `.env` is created or overwritten; the runbook sets
      `DATABASE_URL`/`AUTH_MODE`/`NODE_ENV`/`LOCAL_DEMO_CONFIRM` explicitly because
      `tsx` does not auto-load dotenv; no automated data cleanup / no `db:reset` in
      scope.
- [ ] No placeholders: no `TBD`/`TODO`/`FIXME`/`...`-as-code left in any created
      file; every command has an explicit expected result (`<commit>`/`<run-id>`
      are runtime values supplied at execution, not placeholders).
- [ ] Guardrails: no schema change; no `src/**` change; no secrets or connection
      strings in code, logs, commit, or docs; GPS reason left explicitly out of
      scope with the `locationReason`-already-exists nuance recorded, and the
      browser smoke mocks geolocation at EP01 so the >100m path is not exercised.
- [ ] Trailer: the commit carries
      `Co-Authored-By: Claude <noreply@anthropic.com>`.
- [ ] Push + CI: branch pushed; CI run id recorded with both jobs green.
