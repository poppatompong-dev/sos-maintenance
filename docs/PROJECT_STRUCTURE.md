# Project structure & file conventions

The **standard for where files live and how they're named**. Companion to
[`ARCHITECTURE.md`](ARCHITECTURE.md) (system design & the readiness pipeline) —
this doc is the practical "where does X go?" reference for anyone (human or AI
assistant) extending the codebase. Keep it current when the layout changes.

## Layering (the one rule that matters)

Dependencies point **inward only**:

```
app/  ──▶  server/  ──▶  domain/
(routes)   (I/O layer)    (pure logic, no I/O)
```

- **`domain/`** — pure business logic. No Prisma, no framework, no `fetch`, no
  clock (`now` is always injected). 100% unit-testable without a DB (ADR 0001).
- **`server/`** — the application layer that performs I/O: composes `domain`,
  talks to Prisma, validates input, enforces authz. May import `domain`.
- **`app/`** — thin Next.js App Router surface (pages + API routes). May import
  `server` and `domain`; contains as little logic as possible.
- **`worker/`** — separate background process; shares `domain` + `server/db`.

If a change makes `domain` import from `server`/`app`/Prisma, it's in the wrong
layer.

## Current directory map

```
src/
  app/                        Next.js App Router (routes + API)
    layout.tsx                root shell (Thai font, PWA, SW registration)
    page.tsx                  Dashboard A (control-centre)      → /
    today/page.tsx            Technician B field shell          → /today
    offline/page.tsx          PWA offline fallback
    manifest.ts               PWA manifest
    api/                      REST route handlers (one folder per resource)
      readiness/overview/route.ts        GET  readiness rollup
      assets/route.ts                    GET  asset registry
      assets/[code]/route.ts             GET  asset detail
      work-orders/route.ts               GET  work-order list
      work-orders/[code]/transition/route.ts  POST lifecycle transition
      faults/route.ts                    GET  fault list
      inspections/route.ts               POST submit inspection
  components/                 UI components (PascalCase.tsx)
  lib/                        view helpers (readiness-view: status → label/icon)
  domain/                     PURE business logic — one folder per subdomain
    readiness/  recurrence/  geo/  work/  fault/  checklist/
    metrics/  authz/  sync/  import/  notification/  shared/
  server/                     application layer (I/O)
    db/client.ts              Prisma singleton
    dto/schemas.ts            Zod request-validation schemas
    auth/session.ts           session + RBAC guard (getSession/requirePermission)
    http/respond.ts           JSON + error→HTTP mapping for route handlers
    services/                 application services (business transactions)
    adapters/                 port implementations (Prisma-backed)
    queries/                  read models for the UI/API
  worker/main.ts              background job scheduler
prisma/
  schema.prisma               data model (20+ entities)
  migrations/                 committed SQL migrations
  sql/001_enable_postgis.sql  PostGIS generated columns + GiST (post-migrate)
  seed.ts + seed-data/        27-pole reference seed
infra/                        Dockerfiles, Caddyfile, Keycloak realm, backup.sh
docs/                         architecture, ADRs (adr/), spec (spec/), this file
```

## `server/` sub-layers — what goes where

| Folder | Responsibility | Depends on | Example |
|---|---|---|---|
| `services/` | One business transaction, framework-free. Defines a **port** interface it needs. | `domain`, a port | `submit-inspection.ts`, `transition-work-order.ts` |
| `adapters/` | Implements a service's port with Prisma (the only place raw Prisma writes live). | Prisma, the port | `prisma-inspection-port.ts`, `prisma-work-order-port.ts` |
| `queries/` | Read models: shape DB rows for the UI/API. Read-only. | Prisma | `assets.ts`, `faults.ts`, `readiness-overview.ts` |
| `dto/` | Zod schemas that parse untrusted input before it reaches a service. | zod | `schemas.ts` |
| `auth/` | Resolve the session and enforce permissions (server-side RBAC). | `domain/authz` | `session.ts` |
| `http/` | Turn results/errors into `Response` objects for route handlers. | — | `respond.ts` |
| `db/` | The single `PrismaClient` instance. | Prisma | `client.ts` |

The **ports & adapters** pattern (a service declares an interface; a Prisma
adapter implements it) is what lets every service be unit-tested with an
in-memory fake and integration-tested against real Postgres.

## Naming conventions

- **Modules / logic files:** `kebab-case.ts` — `submit-inspection.ts`,
  `state-machine.ts`, `readiness-overview.ts`.
- **React components:** `PascalCase.tsx` in `components/` — `PoleTable.tsx`,
  `StatusRail.tsx`. (Deliberately distinct from modules so a component is
  recognisable at a glance.)
- **Domain subdomains:** a folder per bounded area; a multi-file subdomain
  exposes a barrel `index.ts` (e.g. `readiness/index.ts`) so callers import
  `@/domain/readiness`, not deep paths.
- **Next.js routes:** always `route.ts` (API) or `page.tsx` (UI); the URL is the
  folder path. Dynamic segments use `[param]`.
- **Import alias:** `@/*` → `src/*` (see `tsconfig.json`). Prefer it over long
  relative paths; `prisma/` seed-data is reached relatively from `server/`.

## Test conventions

| Suffix | Kind | Runner | Needs a DB? |
|---|---|---|---|
| `*.test.ts` | Unit — pure logic / in-memory fakes | `pnpm test` (`vitest.config.ts`) | No |
| `*.itest.ts` | Integration — real Postgres+PostGIS | `pnpm test:integration` (`vitest.integration.config.ts`) | Yes (`DATABASE_URL`) |

Tests are **colocated** next to the code they cover. The unit config only globs
`*.{test,spec}.ts`, so `*.itest.ts` never runs in the DB-free `pnpm test` /
CI `quality` job — it runs only in the CI `integration` job.

## "Where do I put a new…?"

- **API endpoint** → `app/api/<resource>/route.ts`: parse with a `dto/` Zod
  schema → `auth/` guard → call a `services/` or `queries/` function → return via
  `http/respond`. Never put business logic in the route.
- **Business rule / calculation** → `domain/<subdomain>/` as a pure function +
  a `*.test.ts`. If it needs data, take it as an argument.
- **DB write** → a method on a service's **port**, implemented in `adapters/`.
- **DB read for a screen** → `queries/`.
- **Reusable UI** → `components/`; status/label view-mapping → `lib/`.

## Notes / optional future tidy-ups

- `domain/work/` and `domain/shared/` currently export via direct file paths
  (no barrel `index.ts`) while most other subdomains have one — adding barrels
  would make the domain fully uniform (cosmetic; do it in a dedicated pass so
  imports change atomically).
- `app/api/read-routes.itest.ts` intentionally covers several read routes in one
  file rather than colocating one test per route.
