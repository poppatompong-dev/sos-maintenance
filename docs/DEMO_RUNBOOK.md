# Local Demo Runbook — guarded `/today` work-order fixture

This runbook lets the owner click through the **connected** `/today` workflow
against a **disposable local PostGIS database**, using one clearly labelled demo
work order. It never creates fabricated data in production or Neon.

- **Demo work order code:** `DEMO-LOCAL-EP01-MONTHLY`
- **Seed command:** `pnpm db:seed:demo`
- **Where it runs:** local Docker Postgres only (`postgresql://…@localhost/sos`).

> [!WARNING]
> **Never run `pnpm db:seed:demo` against production or Neon.** The command is
> fail-closed (see [Safety boundary](#safety-boundary)) and will refuse anything
> that is not a confirmed local `sos` database, but you must still only ever set
> `DATABASE_URL` to the local Docker database when using this runbook.

---

## Safety boundary

`pnpm db:seed:demo` validates the environment with a pure guard
(`prisma/demo-fixture-guard.ts`) **before it constructs a Prisma client or opens
any connection**. All of these must hold or it exits non-zero and does nothing:

1. `LOCAL_DEMO_CONFIRM` equals exactly `SOS_LOCAL_DEMO`.
2. `NODE_ENV` is not `production` (case-insensitive).
3. `DATABASE_URL` is present, parseable, and uses `postgres:` / `postgresql:`.
4. The host is a loopback: `localhost`, `127.0.0.1`, or `::1`.
5. The database name is exactly `sos`.

There is **no override** for remote hosts. Rejection messages explain how to
recover and **never print the connection string**. The fixture itself is a single
transaction and is **idempotent**: re-running leaves exactly one demo work order
and one assignment, and never resets submitted evidence.

---

## Two environments — do not mix them

This slice deliberately uses **two different shell environments**. Using the
wrong one is the most common mistake, so they are separated here.

| | Integration tests (`pnpm test:integration`) | Demo seed + browser (`pnpm db:seed:demo`, `pnpm dev`) |
|---|---|---|
| `DATABASE_URL` | local `sos` (required) | local `sos` (required) |
| `AUTH_MODE` | **unset** | `internal` |
| `AUTH_DEV_BYPASS` | **unset** | unset |
| `NODE_ENV` | `development` | `development` |
| `LOCAL_DEMO_CONFIRM` | not needed | `SOS_LOCAL_DEMO` |

**Why `AUTH_MODE` must be unset for integration tests:** `src/server/auth/session.ts`
checks `AUTH_MODE === 'internal'` **first** and short-circuits to the fixed
internal operator, ignoring the per-request `x-dev-roles` / `x-dev-user` headers.
The role/authorization integration tests (e.g. the work-order transition and
separation-of-duties suites) rely on those headers, so setting `AUTH_MODE=internal`
makes them fail (and can leak test data whose cleanup runs after the failed
assertion). CI's `integration` job sets **only** `DATABASE_URL` — match it exactly.

**Why `AUTH_MODE=internal` is needed for the browser/demo context:** `/today`
uses the no-login internal operator so you can drive the connected workflow
without Keycloak. The demo seed also runs under `internal` for parity with the
browser session.

---

## 1. Start the local database

Docker Desktop must be running and `docker` on your PATH.

```powershell
git pull
docker compose up -d postgres          # only the DB; internal mode needs no Keycloak
pnpm install                           # only if deps drifted
```

Do **not** create or overwrite `.env`. The demo CLI runs via `tsx`, which does
**not** auto-load dotenv, so set variables explicitly in the shell. The Prisma
CLI (`pnpm db:setup`) reads the same shell variables.

## 2. Migrate + enable PostGIS + seed the 27 poles

```powershell
$env:DATABASE_URL = 'postgresql://sos:sos@localhost:5432/sos?schema=public'
$env:NODE_ENV = 'development'
pnpm db:setup                          # prisma migrate deploy + PostGIS + seed
```

## 3. Run the integration tests (optional, CI-parity)

Use a shell where **`AUTH_MODE` and `AUTH_DEV_BYPASS` are unset** (see the table
above):

```powershell
Remove-Item Env:\AUTH_MODE -ErrorAction SilentlyContinue
Remove-Item Env:\AUTH_DEV_BYPASS -ErrorAction SilentlyContinue
$env:DATABASE_URL = 'postgresql://sos:sos@localhost:5432/sos?schema=public'
pnpm test:integration                  # expect 9 files / 43 tests passing
```

## 4. Create the guarded demo work order (browser/demo context)

```powershell
$env:DATABASE_URL = 'postgresql://sos:sos@localhost:5432/sos?schema=public'
$env:AUTH_MODE = 'internal'
$env:NODE_ENV = 'development'
$env:LOCAL_DEMO_CONFIRM = 'SOS_LOCAL_DEMO'

pnpm db:seed:demo                      # first run  → "... is ASSIGNED (created)."
pnpm db:seed:demo                      # second run → "... is ASSIGNED (already present)."
```

Both runs exit `0`; the second proves idempotency by hand (still exactly one demo
work order and one assignment).

## 5. Drive the `/today` workflow in the browser

In the **same shell** (so `pnpm dev` inherits `AUTH_MODE=internal`):

```powershell
pnpm dev                               # http://localhost:3000/today
```

Happy path (mock geolocation at EP01 so the out-of-scope GPS >100m path is not
exercised — see [Known gap](#known-gap)):

1. Confirm the demo card renders: heading `DEMO-LOCAL-EP01-MONTHLY`, asset line
   `EP01 · …`, status pill `มอบหมายแล้ว` (ASSIGNED), and a non-zero checklist
   count (`N รายการ`).
2. Before submitting, in the browser console mock geolocation to EP01's own
   coordinates so the captured position is ~0 m from the asset:

   ```js
   const boot = await fetch('/api/sync/bootstrap', { cache: 'no-store' }).then((r) => r.json());
   const demo = boot.workOrders.find((w) => w.code === 'DEMO-LOCAL-EP01-MONTHLY');
   const { latitude, longitude } = demo.asset;
   navigator.geolocation.getCurrentPosition = (success) =>
     success({ coords: { latitude, longitude, accuracy: 5 } });
   ```

3. Click `เริ่มงาน` (Start): `ASSIGNED → IN_PROGRESS`; pill becomes
   `กำลังดำเนินการ`; the checklist form appears.
4. Answer every checklist select (e.g. `ผ่าน` / `ไม่เกี่ยวข้อง`) until the submit
   button enables (`ส่งผลตรวจ`).
5. Click `ส่งผลตรวจ` (Submit): `POST /api/inspections` returns `201`, then the
   work-order transition to `SUBMITTED` returns `200`. **The demo card then leaves
   `/today` and the list shows zero open work orders** — this is expected, not a
   bug. `getSyncBootstrap` only returns *open* field work orders
   (`PUBLISHED | ASSIGNED | IN_PROGRESS | REOPENED`); `SUBMITTED` is excluded, so a
   submitted order is intentionally not shown and there is **no persistent
   `รอตรวจรับ` pill** to look for. Confirm success via the `200`/`201` responses
   and the database check in step 6, not by a pill on `/today`.

## 6. Verify the data (no secrets printed)

```powershell
pnpm db:studio                         # inspect ChecklistResponse + WorkOrder rows
```

Confirm: the demo `WorkOrder.status` is `SUBMITTED`; a `ChecklistResponse` set
sharing a single `clientMutationId`; a `ReadinessSnapshot` was written for EP01.
Retrying submit reuses the same mutation id and creates no duplicate evidence.

Verified on 2026-07-23 (local Docker PostGIS, EP01 monthly checklist of 10 items):
`WorkOrder.status = SUBMITTED`, `version = 2`; **10** `ChecklistResponse` rows
under **1** distinct `clientMutationId`; captured GPS distance `0` m (mocked at
EP01, so no >100 m review flag); **1** `ReadinessSnapshot` for EP01 computed
`UNKNOWN`; two `work_log` transition rows (`ASSIGNED → IN_PROGRESS`,
`IN_PROGRESS → SUBMITTED`).

## 7. Stop

```powershell
$env:LOCAL_DEMO_CONFIRM = $null        # clear confirmation for safety
docker compose down                    # stop containers; keeps the db-data volume (no -v)
```

The demo work order intentionally persists in the local database between runs —
that is what makes `/today` testable. The database is fully disposable via its
Docker volume, but discarding that volume (`docker compose down -v` or
`docker volume rm sos-maintenance_db-data`) is a deliberate manual action, not
something any command in this runbook does for you.

---

## Known gap

The GPS **>100 m mandatory reason** (UAT case 8) is **out of scope** for this
slice. The database column `ChecklistResponse.locationReason` already exists, but
the DTO/service/UI path does not yet collect or persist a reason when the captured
position exceeds `GPS_EXCEPTION_METERS` (100 m). Step 5 mocks the position at EP01
precisely so this path is not exercised. When testing on-site with a real device
position >100 m from EP01, the response is flagged for review but the reason is
**not** collected — do not represent that path as complete.
