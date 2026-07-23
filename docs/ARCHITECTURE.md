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

Today the tests supply an in-memory adapter. **Sprint 4 = write the Prisma
adapter** for this interface (and point `queries/readiness-overview.ts` at the DB
instead of the seed registry). No domain or service code changes — that's the
payoff of the layering.

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
3. Persistence → implement the port with Prisma in `src/server`.
4. UI → server component in `src/app` calling a `query`/service; reuse components.
5. `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, then commit + push.
