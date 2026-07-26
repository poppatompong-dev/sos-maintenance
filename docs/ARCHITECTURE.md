# Architecture

How the code is organised **as built** (companion to the spec in `docs/spec/03`
and the ADRs in `docs/adr/`). Read this before extending the codebase.

## Shape: modular monolith + worker

```
┌──────────────────────────── Next.js app (one deployable) ───────────────────────────┐
│  src/app/**        UI routes & server components (App Router)                         │
│       │ depends on                                                                    │
│  src/server/**     application layer: services, queries, DTOs, db client              │
│       │ depends on                                                                    │
│  src/domain/**     PURE business logic — no IO, no framework, no Prisma               │
└──────────────────────────────────────────────────────────────────────────────────────┘
   src/worker/main.ts    separate background process (jobs), shares src/domain + db
```

**The dependency rule:** arrows point inward only. `domain` imports nothing from
`server`/`app`/Prisma — that's what keeps it 100% unit-testable without a DB
(ADR 0001). `server` may use `domain` + Prisma; `app` may use `server` + `domain`.

## Directory map

```
src/
  app/
    layout.tsx            root: Thai font, metadata, PWA, SW registration
    page.tsx              Dashboard A (control-centre)  → /
    today/page.tsx        Technician B field shell      → /today
    offline/page.tsx      PWA offline fallback
    manifest.ts           PWA manifest
  domain/                 ← pure (the 182 DB-free unit tests span domain + server + the pure prisma demo guard)
    readiness/            the readiness engine + reason codes + critical functions
    recurrence/           weekly/monthly/semiannual next-due (Bangkok calendar)
    geo/                  haversine + 100m GPS-exception rule
    work/                 work-order state machine + roles + separation of duties
    fault/                fault derivation + idempotency keys
    checklist/            responses → critical-results bridge (feeds readiness)
    metrics/              MTTA/MTTR, readiness rollup, Thai duration
    authz/                RBAC permission matrix (can / assertCan)
    sync/                 offline mutation envelope: idempotency + conflict
    import/               CSV parse + row validation + atomic guard
    notification/         Thai message builders + idempotency keys
    shared/               bangkok tz, thai-date (พ.ศ.), date helpers
  server/
    db/client.ts          Prisma singleton
    dto/schemas.ts        Zod request validation
    queries/              read models for the UI (readiness-overview — TEMP: seed)
    services/             application services (submit-inspection + its port)
  components/             UI: StatusBadge, StatusRail, AppRail, PoleTable, icons…
  presentation/           presentation-boundary Thai mapper (thai-labels.ts) — OUTSIDE
                          src/domain; the only place internal state/status codes
                          (group outcome, member state, WO kind/status) become Thai
  lib/                    view helpers (readiness-view: status → label/icon/tone)
  worker/main.ts          background scheduler (jobs persisted in PG)
prisma/                   schema (20+ entities), PostGIS SQL, 27-pole seed
infra/                    Dockerfiles, Caddyfile, Keycloak realm, backup.sh
```

## The readiness pipeline (the heart of the system)

Status is **computed from evidence**, never chosen. One flow, all pure until persist:

```
checklist responses ─(domain/checklist)→ critical-check results ┐
open faults ────────(domain/fault)──────────────────────────────┤
approved baseline, next-due + grace ─────────────────────────────┤
                                                                  ▼
                                        domain/readiness.evaluateReadiness()
                                                                  │
                                        status + coded reasons (DOWN>UNKNOWN>WATCH>READY)
                                                                  ▼
                                        persist immutable ReadinessSnapshot
```

`src/server/services/submit-inspection.ts` composes the whole thing for one
submission: **RBAC → envelope idempotency → GPS rule → checklist→readiness →
fault derivation → persist**. It's tested end-to-end with an in-memory port.

## Flexible field checklist (versioned groups, 2026-07-24 slice)

The monthly field checklist renders as **five outcome-oriented Thai groups**
(plus one optional general note) instead of a flat per-item list, without any
change to the readiness pipeline above. Added on top of the existing
`ChecklistTemplate → ChecklistTemplateVersion → ChecklistItem` spine:

- **`ChecklistFieldGroup`** (`prisma/schema.prisma`) — version-scoped, one row
  per group (`key`, Thai `label`/`helpText`, `order`, `required`,
  `reasonPolicy`, `photoPolicy`). `ChecklistItem` gets nullable `fieldGroupId`
  + `memberOrder`: an item belongs to at most one group; the general-note item
  stays ungrouped. Membership, labels, and policies are versioned data — never
  hardcoded in the UI.
- **Version lifecycle: DRAFT → PUBLISHED → RETIRED.** `ChecklistTemplateVersion`
  gained `status` + `retiredAt` (additive, alongside the existing
  `publishedAt`/`isLocked`). Only a **PUBLISHED** version is referenceable by a
  `MaintenancePlan` or pinnable by a `WorkOrder` — a DB foreign key can't
  express that rule, so it's enforced in
  `src/server/services/checklist-version.ts` (`publishChecklistVersion` runs
  the pure `validateChecklistVersionForPublish` and freezes the version;
  `repointPlanToVersion` refuses a non-PUBLISHED or wrong-kind version;
  `retireChecklistVersion` stops new references without touching content or
  history). Editorial change = new draft → publish → repoint; nothing
  published is ever edited in place.
- **`canonicalizeFieldSubmission`** (`src/domain/checklist/canonicalize.ts`,
  pure) — the server-side trust boundary. It expands the technician's group
  outcomes (`NORMAL`/`PROBLEM`/`UNTESTABLE`, transport codes only) into the
  authoritative per-item `EvaluatedResponse[]` the readiness pipeline already
  consumes, reading `criticality`/`criticalFunctionKey` from the **pinned
  version's item definitions** (`src/server/queries/checklist-definition.ts`),
  never from the request — the client can no longer supply criticality or
  function keys. `src/app/api/inspections/route.ts` loads the pinned
  definition, canonicalizes, then calls the unchanged
  `submitInspection`/readiness/fault flow.
- **Presentation-boundary Thai mapper** — `src/presentation/thai-labels.ts`,
  deliberately **outside `src/domain`**. It is the only place a group-outcome,
  member-state, work-order kind, or work-order status code becomes Thai;
  exhaustive per enum with a safe generic fallback that never echoes a raw
  token. Group/member *content* (labels, help text) comes straight from
  versioned data and never routes through this mapper. Item kinds are never
  rendered at all.
- **Bootstrap** (`src/server/queries/sync.ts`) returns only display-safe group
  fields (`key`, `label`, `help`, `order`, `required`, policies, member
  `label`/opaque `memberKey`) — no `kind`, `criticality`, or
  `criticalFunctionKey` ever leaves the server.

Monthly checklist **v2** (the grouped definition) is rolled out idempotently
by `prisma/checklist-v2.ts` (`pnpm db:checklist:v2`, chained into
`pnpm db:setup`): atomic creation, refuses to resurrect a RETIRED v2, and
verifies any existing v2 against an exact content fingerprint before trusting
or repointing it. Out of scope for this slice (unchanged): photo capture
(group 5 is `photoPolicy: NONE`), the GPS `>100 m` mandatory-reason wiring
(`ChecklistResponse.locationReason` stays reserved), and the offline queue.

## Ports & adapters (how Sprint 4 plugs in)

Services depend on **ports** (interfaces), not Prisma. Example — `InspectionPort`
in `submit-inspection.ts`:

```ts
interface InspectionPort {
  isMutationProcessed(mutationId): Promise<boolean>;
  loadAssetForWorkOrder(workOrderId): Promise<AssetForInspection | null>;
  persist(input): Promise<void>;
}
```

Tests supply an in-memory adapter; production supplies a Prisma one. Both were
written long ago — `src/server/adapters/` now holds six of them
(`prisma-inspection-port`, `-work-order-port`, `-schedule-port`, `-repair-port`,
`-job-tick-port`, `-baseline-port`), and `queries/readiness-overview.ts` reads
the DB with a seed fallback when it is unreachable. Adding an adapter has never
required a domain or service change — that is the payoff of the layering.

## Reliability patterns (already in the schema/domain)

- **Idempotency:** client `mutationId` + deterministic fault/notification/WO keys
  → retries never duplicate.
- **Optimistic concurrency:** `version` columns + `detectVersionConflict` →
  conflicts are surfaced, never silent last-write-wins.
- **Immutable history:** `ReadinessSnapshot` and used `ChecklistTemplateVersion`
  are append-only; closed work/evidence is never deleted (correction/reopen).
- **Atomic import:** `canCommit` is true only when every row is valid.
- **Time:** stored UTC; converted to Asia/Bangkok + พ.ศ. only at the edge.

## Adding a feature (recipe)

1. Pure rule? → add to `src/domain/<module>` **with tests first** (it needs no DB).
2. Needs data? → define/extend a **port**, add a Zod DTO, write a **service** that
   composes domain + port. Test with an in-memory adapter.
3. Persistence → implement the port with Prisma in `src/server/adapters`.
4. API route → thin: auth → parse → call service → `errorResponse`. Register any
   new error class in `src/server/http/respond.ts` or it becomes a 500.
5. UI → server component in `src/app` calling a `query`/service; reuse components.
6. Integration test next to the route (`*.itest.ts`) covering refusals, not just
   the happy path.
7. **Run it in the real app**, with a throwaway fixture you then delete.
8. `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, update
   `requirements-traceability.csv` + `docs/WORKLOG.md`, then commit + push.

> **This is the summary. The detailed version — with a fully worked example
> (`ASSET-06`), the conventions each step must follow, the traps that have
> already cost time, and the definition of done — is in
> [`DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md). Read that before your first
> slice.**
