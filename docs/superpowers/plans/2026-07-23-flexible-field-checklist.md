# Flexible Field Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work top-to-bottom, one checkbox at a time; do not tick a box until its stated command produces the stated result. Stop and report if any RED step fails to fail or any GREEN step fails to pass. Never write to a remote/production database. Never print a connection string. Use the exact paths and code below — no placeholders.

**Goal:** Turn the monthly field inspection into five outcome-oriented Thai groups (plus one optional note) defined entirely by versioned data, with a pure server-authoritative canonicalization that expands group outcomes into the per-item responses the existing readiness engine already consumes — no readiness, auth, or offline change.

**Architecture:** Keep the `ChecklistTemplate → ChecklistTemplateVersion → ChecklistItem` spine and the readiness pipeline. Add (1) a normalized version-scoped `ChecklistFieldGroup` layer with one-to-many membership to items; (2) an additive `DRAFT → PUBLISHED → RETIRED` version lifecycle (`status` + `retiredAt` alongside the existing `publishedAt`/`isLocked`); (3) a pure `canonicalizeFieldSubmission` (group outcomes → `EvaluatedResponse[]`, criticality/function keys read from item definitions, never the wire); (4) a pure publish validator; (5) a presentation-boundary Thai mapper outside `src/domain`; (6) a grouped, accessible `/today` UI. Editorial change is expressed by copying to a new draft, publishing it, and repointing the plan — no schema or UI rewrite.

**Tech Stack:** Next.js 16 App Router + TypeScript; Prisma 6 + PostgreSQL/PostGIS (`postgis/postgis:16-3.4` via Docker Compose, database `sos` on `localhost:5432`); Zod DTOs; Vitest (unit config includes `src/**` + `prisma/**` `*.{test,spec}.ts`; integration config includes `*.itest.ts`, `fileParallelism:false`, 30s timeouts); `tsx` for CLI/rollout scripts.

---

### Plan metadata

- **Spec:** `docs/superpowers/specs/2026-07-23-flexible-field-checklist-design.md`
- **Repo / branch:** sos-maintenance / `main` (base commit `762ce3d`, Asia/Bangkok, 2026-07-23).
- **Approach:** TDD (red → green → refactor). Small vertical commits. Quality gates after each source change: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`. Integration gate: `pnpm test:integration` (needs a local `sos` PostGIS or CI's `integration` job).
- **Commit trailer (required on every commit):** `Co-Authored-By: Claude <noreply@anthropic.com>`
- **Baseline test counts (before this plan):** `pnpm test` **182 passing (22 files)**; `pnpm test:integration` **43 passing (9 files)**. Record the exact new totals each run prints; do not assume.
- **Preserved invariants (do NOT change substance):** readiness precedence DOWN>UNKNOWN>WATCH>READY + 7-day grace + immutable `ReadinessSnapshot`; `src/domain` stays pure (no IO/Prisma/framework); server-side RBAC on every endpoint; offline idempotent mutation envelope (no silent last-write-wins); Thai UI vocabulary; UTC storage + Asia/Bangkok/พ.ศ. display; free/OSS only. The *only* trust change: criticality and critical-function keys are read from the pinned version, not the request.
- **Out of scope (explicit):** photo upload/capture/compression/storage; the GPS `>100 m` mandatory-reason wiring (UAT case 8 — `ChecklistResponse.locationReason` stays reserved for it, never reused for group data); offline IndexedDB queue; group-management admin UI; auth/Keycloak, reports, online map; QR scan. No production/Neon data is created by this plan.
- **UAT honesty (must not overstate — design §Testing/UAT):** this slice implements the monthly grouped field test (docs 01/08 "Monthly End-to-End"). It contributes the grouped-pass→readiness portion of **UAT #3** but does **not** complete #3 (QR/photo/GPS>100m open); it contributes the critical-fail→DOWN+Fault portion of **UAT #4** but does **not** prove #4 (corrective-WO + email downstream not verified here); **#2** and **#8** are separate. A passing build alone is never "done" (`docs/spec/06`).

---

## 0. Verified facts this plan is built on (read-only, already confirmed)

- `prisma/schema.prisma`: `ChecklistTemplateVersion` carries only `publishedAt` + `isLocked` (no `status`, no `retiredAt`) — lifecycle fields are genuinely absent and must be added (additive). `ChecklistItem` has `code`, `label`, `kind`, `criticality`, `criticalFunctionKey`, `requiresPhoto`, `@@unique([versionId, code])`. `ChecklistResponse` has `note`, `locationReason`, `capturedLat/Lng`, `distanceMeters`, `locationException`, `reviewFlag`, `clientMutationId @unique`. `WorkOrder.checklistVersionId` pins the version. `MaintenancePlan @@unique([kind, assetTypeKey])`, carries `checklistVersionId`.
- `prisma/seed.ts` currently creates each checklist version 1 with `isLocked:false` and re-creates items on every re-seed when `!isLocked`. The monthly (`MONTHLY_FIELD`) version-1 items are exactly: `criticalFunctionItems('m')` → `m_sos_button`, `m_confirmation_signal`, `m_microphone`, `m_speaker_two_way_audio`, `m_camera_recording`, `m_network_voip`, `m_operating_power` (each CRITICAL, one per `CRITICAL_FUNCTIONS` key; `m_camera_recording.requiresPhoto=true` via the helper), plus `m_center_sees` (CRITICAL→`network_voip`), `m_exterior` (NON, `requiresPhoto:true`), `m_note` (NON, TEXT).
- `src/domain/checklist/index.ts`: `EvaluatedResponse { itemCode, label, result, criticality, criticalFunctionKey?, observedAt? }`; `toCriticalCheckResults` (any FAIL⇒FAIL; else any PASS⇒PASS; else UNKNOWN) and `allCriticalPassed` read `criticalFunctionKey`/`criticality` off the response.
- `src/domain/readiness/critical-functions.ts` `CRITICAL_FUNCTIONS` = keys `sos_button, confirmation_signal, microphone, speaker_two_way_audio, camera_recording, network_voip, operating_power`.
- `src/server/services/submit-inspection.ts` consumes `EvaluatedResponse[]` in `InspectionPayload` and is unchanged by this plan (it stays the readiness/fault/GPS/idempotency composition). The **route** is where load+canonicalize happens before it.
- `src/server/adapters/prisma-inspection-port.ts` `persist` writes one `ChecklistResponse` per response but does **not** currently write `note`. It maps `itemCode → itemId` for the pinned version and throws `InspectionError('NO_CHECKLIST_VERSION')` / `('ITEM_NOT_FOUND')`.
- `src/server/queries/sync.ts` `getSyncBootstrap` returns a flat `checklist: SyncChecklistItem[]` including `kind`, `criticality`, `criticalFunctionKey` (leaky — to be replaced by groups). Internal mode (`userId=null`) returns all open field WOs (`PUBLISHED|ASSIGNED|IN_PROGRESS|REOPENED`).
- `src/components/TodayWorkspace.tsx` renders the flat items one-for-one, shows `{item.kind}` and a criticality `*`, and posts `responses[]` with client-supplied `criticality`/`criticalFunctionKey` — all three to be removed.
- `src/server/dto/schemas.ts` `inspectionPayloadSchema` = `{ workOrderId, responses: EvaluatedResponse[], gps }` (to be replaced by a group-outcome schema). Only `src/app/api/inspections/route.ts`, `src/server/dto/schemas.test.ts` import it.
- `src/server/http/respond.ts` maps `InspectionError` codes to HTTP (404 for `*_NOT_FOUND`, 400 for `INVALID_ENVELOPE`/`NO_CHECKLIST_VERSION`, else 409). `ZodError`→400, `ForbiddenError`→403, `UnauthenticatedError`→401.
- `package.json` scripts: `db:migrate = prisma migrate dev`, `db:setup = prisma migrate deploy && pnpm db:postgis && pnpm db:seed`, `db:seed:demo = tsx prisma/seed-demo.ts`. `@/*` → `./src/*`.
- Migrations live in `prisma/migrations/<timestamp>_<name>/migration.sql`; the last is `20260722090000_schedule_batch_created_by`. Local Docker Desktop + PostGIS is healthy on this machine (`docs/RESUME_HERE.md`), so migration generation and integration/browser checks run locally; CI's `integration` job runs `prisma generate → pnpm db:setup → pnpm test:integration`.

## 1. Files this plan creates or edits (exact map)

**Create (source + tests):**
- `src/presentation/thai-labels.ts` — presentation-boundary Thai mapper (outside `src/domain`). Group-outcome, member-state, work-order kind/status → Thai; exhaustive with a safe generic fallback that never echoes a raw token.
- `src/presentation/thai-labels.test.ts` — unit tests (runs in `pnpm test`).
- `src/domain/checklist/canonicalize.ts` — pure `canonicalizeFieldSubmission` (group outcomes + pinned-version defs → `EvaluatedResponse[]`), and `FieldSubmissionError`.
- `src/domain/checklist/canonicalize.test.ts` — unit tests.
- `src/domain/checklist/version-lifecycle.ts` — pure `validateChecklistVersionForPublish`.
- `src/domain/checklist/version-lifecycle.test.ts` — unit tests.
- `src/server/queries/checklist-definition.ts` — server-only loader of the pinned version's groups + items (incl. criticality/function keys) for canonicalization.
- `src/server/services/checklist-version.ts` — `publishChecklistVersion` / `repointPlanToVersion` / `retireChecklistVersion` (referenceability enforced here, not by FK).
- `src/server/services/checklist-version.itest.ts` — publish freeze, repoint referenceability, retire, and version-pinning (integration).
- `prisma/checklist-v2.ts` — idempotent monthly **version 2** rollout: draft items + 5 groups + memberships → publish (validate+freeze) → repoint monthly plan.

**Edit:**
- `prisma/schema.prisma` — add `ChecklistVersionStatus`, `ChecklistReasonPolicy`, `ChecklistPhotoPolicy` enums; `status`/`retiredAt` + `fieldGroups` relation on `ChecklistTemplateVersion`; `fieldGroupId`/`memberOrder` + `fieldGroup` relation on `ChecklistItem`; new `ChecklistFieldGroup` model.
- `prisma/migrations/<new>/migration.sql` — generated additive DDL + appended legacy-classification backfill `UPDATE`.
- `prisma/seed.ts` — create every version-1 as `PUBLISHED`/frozen; seed items only when the version has none (never mutate a frozen version).
- `src/domain/checklist/index.ts` — add optional `note?: string` to `EvaluatedResponse`; re-export the new pure modules.
- `src/server/dto/schemas.ts` — replace `inspectionPayloadSchema`/`evaluatedResponseSchema`/`responseResultSchema` with the group-outcome `fieldInspectionPayloadSchema` and its sub-schemas.
- `src/server/dto/schemas.test.ts` — update for the new schema.
- `src/server/queries/sync.ts` — return display-safe `groups` per WO instead of flat leaky `checklist`.
- `src/app/api/sync/bootstrap/route.itest.ts` — rewrite fixture to create groups + memberships; assert grouped shape and no `kind`/`criticality`/function leakage.
- `src/server/adapters/prisma-inspection-port.ts` — write `note` per response.
- `src/app/api/inspections/route.ts` — parse group payload → load pinned def → canonicalize → `submitInspection`.
- `src/app/api/inspections/route.itest.ts` — rewrite to the group-outcome contract; assert expansion, notes persisted, idempotency, and DOWN/UNKNOWN/READY.
- `src/server/http/respond.ts` — map `FieldSubmissionError`→400; add `NO_FIELD_GROUPS`→400.
- `src/components/TodayWorkspace.tsx` — grouped accessible field UI; remove item-kind render and criticality asterisk; use the Thai mapper.
- `package.json` — add `db:checklist:v2` script; append it to `db:setup`.
- `prisma/demo-fixture.ts` — bump `DEMO_WORK_ORDER_CODE` to `DEMO-LOCAL-EP01-MONTHLY-V2` so a fresh demo pins the grouped version; never mutate an existing WO.
- `docs/DEMO_RUNBOOK.md`, `docs/RESUME_HERE.md`, `docs/WORKLOG.md`, `docs/ARCHITECTURE.md` — checkpoints (observed results only).

**Do NOT touch:** `src/domain/readiness/**`, `src/domain/geo/**`, `src/domain/fault/**` (substance), `src/domain/authz/**`, `src/server/auth/**`, `.github/workflows/**`, `.env.example`, `prisma/demo-fixture-guard.ts`, `prisma/seed-data/**`. Do not add any photo capture/upload, GPS>100m reason wiring, or offline-queue code.

## 2. Preconditions (run once, before any task)

- [ ] `git pull` on `main`; confirm clean tree: `git status --short` prints nothing.
- [ ] Record the rollback point: `git rev-parse HEAD` (expect `762ce3d…`).
- [ ] `pnpm install` (only if deps drifted; this plan adds no dependency).
- [ ] Re-confirm the monthly v1 item codes in `prisma/seed.ts` still match §0 (`m_operating_power`, `m_sos_button`, `m_confirmation_signal`, `m_microphone`, `m_speaker_two_way_audio`, `m_network_voip`, `m_center_sees`, `m_camera_recording`, `m_exterior`, `m_note`). If any changed, stop and report before coding.
- [ ] Confirm a local `sos` PostGIS is reachable for the DB tasks (Tasks 4/5/11/13/14): `docker compose up -d postgres` (starts ONLY the `postgres` service; leaves `keycloak`/`mailpit` and their volumes alone). Two DISTINCT shell profiles are used below — never echo the connection string in any command output:
  - **DB / migration / integration shell** (Tasks 4, 5, 11 rollout, 13): set **only** `DATABASE_URL=postgresql://sos:sos@localhost:5432/sos?schema=public` (plus `NODE_ENV=development` for `tsx` scripts). Leave `AUTH_MODE` and `AUTH_DEV_BYPASS` **unset** — the integration tests set their own auth (`AUTH_DEV_BYPASS='true'` in `beforeAll`), and a stray `AUTH_MODE=internal` would make `getSession` return the all-permissions internal session and mask the 401/403 assertions.
  - **Demo / browser runtime shell** (Task 14 only): additionally set `AUTH_MODE=internal` (so `/today` resolves the internal session), `LOCAL_DEMO_CONFIRM=SOS_LOCAL_DEMO` (the `db:seed:demo` guard), and `NODE_ENV=development`.
  (`tsx`/Prisma/Next read process env; no `.env` is created or overwritten. Port 3000 belongs to the unrelated `thai-memo-app` and is NEVER used here — the browser check uses port 3100.)

---

### Task 1: Presentation Thai mapper (pure, unit-tested)

**Files:**
- Create: `src/presentation/thai-labels.ts`
- Test: `src/presentation/thai-labels.test.ts`

Only internal *states that must be shown* pass through this mapper; content labels (group/member text) come from versioned data and never route through it. Item **kinds are never mapped** (never rendered).

- [ ] **Step 1: Write the failing test** — create `src/presentation/thai-labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  groupOutcomeLabel,
  memberStateLabel,
  workOrderKindLabel,
  workOrderStatusLabel,
} from './thai-labels';

describe('groupOutcomeLabel', () => {
  it('maps every outcome code to Thai', () => {
    expect(groupOutcomeLabel('NORMAL')).toBe('ปกติ');
    expect(groupOutcomeLabel('PROBLEM')).toBe('พบปัญหา');
    expect(groupOutcomeLabel('UNTESTABLE')).toBe('ตรวจไม่ได้');
  });
  it('falls back to a safe generic Thai phrase and never echoes the raw token', () => {
    const out = groupOutcomeLabel('WAT_IS_THIS');
    expect(out).toBe('สถานะอื่น');
    expect(out).not.toContain('WAT_IS_THIS');
  });
});

describe('memberStateLabel', () => {
  it('maps every member-state code to Thai', () => {
    expect(memberStateLabel('OK')).toBe('ทำงานปกติ');
    expect(memberStateLabel('PROBLEM')).toBe('มีปัญหา');
    expect(memberStateLabel('UNTESTED')).toBe('ตรวจไม่ได้');
  });
  it('falls back safely on an unknown code', () => {
    expect(memberStateLabel('ZZZ')).toBe('สถานะอื่น');
    expect(memberStateLabel('ZZZ')).not.toContain('ZZZ');
  });
});

describe('workOrderKindLabel', () => {
  it('maps every maintenance kind to Thai', () => {
    expect(workOrderKindLabel('INITIAL_SURVEY')).toBe('สำรวจตั้งต้น');
    expect(workOrderKindLabel('WEEKLY_CENTER')).toBe('ตรวจรายสัปดาห์');
    expect(workOrderKindLabel('MONTHLY_FIELD')).toBe('ตรวจรายเดือน');
    expect(workOrderKindLabel('SEMIANNUAL_DEEP')).toBe('ตรวจราย 6 เดือน');
    expect(workOrderKindLabel('CORRECTIVE')).toBe('ซ่อมแก้ไข');
  });
  it('falls back without echoing the raw token', () => {
    expect(workOrderKindLabel('FOO')).toBe('งานอื่น');
    expect(workOrderKindLabel('FOO')).not.toContain('FOO');
  });
});

describe('workOrderStatusLabel', () => {
  it('maps every work-order status to Thai', () => {
    for (const code of ['DRAFT','PUBLISHED','ASSIGNED','IN_PROGRESS','SUBMITTED','CLOSED','REJECTED','REOPENED','CANCELLED']) {
      const out = workOrderStatusLabel(code);
      expect(out.length).toBeGreaterThan(0);
      expect(out).not.toBe(code);
    }
    expect(workOrderStatusLabel('ASSIGNED')).toBe('มอบหมายแล้ว');
    expect(workOrderStatusLabel('SUBMITTED')).toBe('รอตรวจรับ');
  });
  it('falls back safely on an unknown status', () => {
    expect(workOrderStatusLabel('XYZ')).toBe('สถานะอื่น');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails** — `pnpm test -- src/presentation/thai-labels.test.ts`
      Expected RED: `Failed to resolve import "./thai-labels"` (module not found).

- [ ] **Step 3: Implement** — create `src/presentation/thai-labels.ts`:

```ts
// src/presentation/thai-labels.ts
//
// Presentation boundary: the ONLY place that turns an internal state/status code
// into Thai for the UI. It is exhaustive over each enum and returns a safe,
// generic Thai phrase for any unrecognized code — never echoing the raw token.
// Content labels (group/member display text) come from versioned data and do NOT
// pass through here. Item kinds are never rendered, so they are never mapped.

export type GroupOutcome = 'NORMAL' | 'PROBLEM' | 'UNTESTABLE';
export type MemberState = 'OK' | 'PROBLEM' | 'UNTESTED';

const GENERIC_STATE_TH = 'สถานะอื่น';
const GENERIC_KIND_TH = 'งานอื่น';

const GROUP_OUTCOME_TH: Record<GroupOutcome, string> = {
  NORMAL: 'ปกติ',
  PROBLEM: 'พบปัญหา',
  UNTESTABLE: 'ตรวจไม่ได้',
};

const MEMBER_STATE_TH: Record<MemberState, string> = {
  OK: 'ทำงานปกติ',
  PROBLEM: 'มีปัญหา',
  UNTESTED: 'ตรวจไม่ได้',
};

const WORK_ORDER_KIND_TH: Record<string, string> = {
  INITIAL_SURVEY: 'สำรวจตั้งต้น',
  WEEKLY_CENTER: 'ตรวจรายสัปดาห์',
  MONTHLY_FIELD: 'ตรวจรายเดือน',
  SEMIANNUAL_DEEP: 'ตรวจราย 6 เดือน',
  CORRECTIVE: 'ซ่อมแก้ไข',
};

const WORK_ORDER_STATUS_TH: Record<string, string> = {
  DRAFT: 'ร่าง',
  PUBLISHED: 'รอมอบหมาย',
  ASSIGNED: 'มอบหมายแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  SUBMITTED: 'รอตรวจรับ',
  CLOSED: 'ปิดงานแล้ว',
  REJECTED: 'ส่งคืนแก้ไข',
  REOPENED: 'เปิดแก้ไข',
  CANCELLED: 'ยกเลิก',
};

export function groupOutcomeLabel(code: string): string {
  return GROUP_OUTCOME_TH[code as GroupOutcome] ?? GENERIC_STATE_TH;
}

export function memberStateLabel(code: string): string {
  return MEMBER_STATE_TH[code as MemberState] ?? GENERIC_STATE_TH;
}

export function workOrderKindLabel(code: string): string {
  return WORK_ORDER_KIND_TH[code] ?? GENERIC_KIND_TH;
}

export function workOrderStatusLabel(code: string): string {
  return WORK_ORDER_STATUS_TH[code] ?? GENERIC_STATE_TH;
}
```

- [ ] **Step 4: Run it to confirm it passes** — `pnpm test -- src/presentation/thai-labels.test.ts`
      Expected GREEN: 1 file, all cases pass, exit 0.

- [ ] **Step 5: Commit**

```
git add src/presentation/thai-labels.ts src/presentation/thai-labels.test.ts
git commit -m "feat: presentation-boundary Thai mapper for field outcomes/states

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Domain — `EvaluatedResponse.note` + `canonicalizeFieldSubmission` (pure)

**Files:**
- Modify: `src/domain/checklist/index.ts`
- Create: `src/domain/checklist/canonicalize.ts`
- Test: `src/domain/checklist/canonicalize.test.ts`

- [ ] **Step 1: Add `note?` to `EvaluatedResponse`** — in `src/domain/checklist/index.ts`, edit the interface to add a trailing optional field (keep everything else):

```ts
export interface EvaluatedResponse {
  itemCode: string;
  label: string;
  result: ResponseResult;
  criticality: 'CRITICAL' | 'NON_CRITICAL';
  /** Set when this item verifies a readiness-critical function. */
  criticalFunctionKey?: string;
  observedAt?: Date | null;
  /** Symptom note / could-not-test reason / general note, persisted to ChecklistResponse.note. */
  note?: string;
}
```

- [ ] **Step 2: Write the failing test** — create `src/domain/checklist/canonicalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  canonicalizeFieldSubmission,
  FieldSubmissionError,
  type CanonicalizeInput,
} from './canonicalize';

/** A minimal monthly-like version: one critical group + one note item. */
function baseInput(over: Partial<CanonicalizeInput['submission']> = {}): CanonicalizeInput {
  return {
    groups: [
      { key: 'g_audio', required: true, memberItemCodes: ['m_microphone', 'm_speaker_two_way_audio'] },
    ],
    items: [
      { code: 'm_microphone', label: 'ไมโครโฟน', criticality: 'CRITICAL', criticalFunctionKey: 'microphone' },
      { code: 'm_speaker_two_way_audio', label: 'ลำโพง/เสียงสองทาง', criticality: 'CRITICAL', criticalFunctionKey: 'speaker_two_way_audio' },
      { code: 'm_note', label: 'หมายเหตุเพิ่มเติม', criticality: 'NON_CRITICAL', criticalFunctionKey: null },
    ],
    generalNoteItemCode: 'm_note',
    submission: {
      groups: [{ groupKey: 'g_audio', outcome: 'NORMAL' }],
      ...over,
    },
  };
}

describe('canonicalizeFieldSubmission', () => {
  it('NORMAL → every member PASS; criticality/function key come from item defs', () => {
    const out = canonicalizeFieldSubmission(baseInput());
    const mic = out.find((r) => r.itemCode === 'm_microphone')!;
    expect(mic.result).toBe('PASS');
    expect(mic.criticality).toBe('CRITICAL');
    expect(mic.criticalFunctionKey).toBe('microphone');
  });

  it('ignores client-supplied criticality/function keys — they are not in the input at all', () => {
    // The submission type carries only groupKey/outcome/members(state)/note/reason.
    const out = canonicalizeFieldSubmission(baseInput());
    for (const r of out.filter((x) => x.itemCode !== 'm_note')) {
      // Values are exactly what the item definition says.
      expect(['CRITICAL', 'NON_CRITICAL']).toContain(r.criticality);
    }
  });

  it('PROBLEM → OK=PASS, PROBLEM=FAIL, unset=UNKNOWN (never assumed pass); symptom note on FAIL rows', () => {
    const out = canonicalizeFieldSubmission(
      baseInput({
        groups: [
          {
            groupKey: 'g_audio',
            outcome: 'PROBLEM',
            members: [{ memberKey: 'm_microphone', state: 'PROBLEM' }],
            note: 'ไมค์ไม่มีเสียง',
          },
        ],
      }),
    );
    const mic = out.find((r) => r.itemCode === 'm_microphone')!;
    const spk = out.find((r) => r.itemCode === 'm_speaker_two_way_audio')!;
    expect(mic.result).toBe('FAIL');
    expect(mic.note).toBe('ไมค์ไม่มีเสียง');
    expect(spk.result).toBe('UNKNOWN'); // unset member is never PASS
  });

  it('UNTESTABLE → all members UNKNOWN with the reason on each row', () => {
    const out = canonicalizeFieldSubmission(
      baseInput({
        groups: [{ groupKey: 'g_audio', outcome: 'UNTESTABLE', reason: 'เข้าพื้นที่ไม่ได้' }],
      }),
    );
    expect(out.filter((r) => r.itemCode !== 'm_note').every((r) => r.result === 'UNKNOWN')).toBe(true);
    expect(out.find((r) => r.itemCode === 'm_microphone')!.note).toBe('เข้าพื้นที่ไม่ได้');
  });

  it('general note → the note item as NA carrying the text', () => {
    const out = canonicalizeFieldSubmission(baseInput({ generalNote: 'ทุกอย่างปกติดี' }));
    const note = out.find((r) => r.itemCode === 'm_note')!;
    expect(note.result).toBe('NA');
    expect(note.note).toBe('ทุกอย่างปกติดี');
  });

  it('rejects an unknown group key', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({ groups: [{ groupKey: 'nope', outcome: 'NORMAL' }] }),
      ),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects a member key that is not in the named group', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({
          groups: [{ groupKey: 'g_audio', outcome: 'PROBLEM', members: [{ memberKey: 'm_camera_recording', state: 'PROBLEM' }], note: 'x' }],
        }),
      ),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects a duplicate submitted group key (no last-wins)', () => {
    let err: unknown;
    try {
      canonicalizeFieldSubmission(
        baseInput({
          groups: [
            { groupKey: 'g_audio', outcome: 'NORMAL' },
            { groupKey: 'g_audio', outcome: 'UNTESTABLE', reason: 'x' },
          ],
        }),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FieldSubmissionError);
    expect((err as FieldSubmissionError).code).toBe('DUPLICATE_GROUP');
  });

  it('rejects a duplicate member key within a group (no last-wins)', () => {
    let err: unknown;
    try {
      canonicalizeFieldSubmission(
        baseInput({
          groups: [{
            groupKey: 'g_audio',
            outcome: 'PROBLEM',
            members: [
              { memberKey: 'm_microphone', state: 'OK' },
              { memberKey: 'm_microphone', state: 'PROBLEM' },
            ],
            note: 'x',
          }],
        }),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FieldSubmissionError);
    expect((err as FieldSubmissionError).code).toBe('DUPLICATE_MEMBER');
  });

  it('rejects a missing required group', () => {
    expect(() =>
      canonicalizeFieldSubmission(baseInput({ groups: [] })),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects PROBLEM with no member marked PROBLEM', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({ groups: [{ groupKey: 'g_audio', outcome: 'PROBLEM', members: [{ memberKey: 'm_microphone', state: 'OK' }], note: 'x' }] }),
      ),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects PROBLEM with an empty symptom note', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({ groups: [{ groupKey: 'g_audio', outcome: 'PROBLEM', members: [{ memberKey: 'm_microphone', state: 'PROBLEM' }], note: '   ' }] }),
      ),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects UNTESTABLE with an empty reason', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({ groups: [{ groupKey: 'g_audio', outcome: 'UNTESTABLE', reason: '' }] }),
      ),
    ).toThrow(FieldSubmissionError);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails** — `pnpm test -- src/domain/checklist/canonicalize.test.ts`
      Expected RED: `Failed to resolve import "./canonicalize"`.

- [ ] **Step 4: Implement** — create `src/domain/checklist/canonicalize.ts`:

```ts
// src/domain/checklist/canonicalize.ts
//
// PURE server-side trust boundary: expand a small set of group outcomes into the
// authoritative per-item EvaluatedResponse[] the readiness pipeline consumes.
// Criticality and critical-function keys are taken from the pinned version's item
// definitions, NEVER from the request. No IO, no Prisma, no framework.

import type { EvaluatedResponse, ResponseResult } from './index';

export type GroupOutcome = 'NORMAL' | 'PROBLEM' | 'UNTESTABLE';
export type MemberState = 'OK' | 'PROBLEM' | 'UNTESTED';

export interface SubmittedMember {
  memberKey: string;
  state: MemberState;
}

export interface SubmittedGroup {
  groupKey: string;
  outcome: GroupOutcome;
  members?: SubmittedMember[];
  note?: string;
  reason?: string;
}

/** Version item definition (server-authoritative). */
export interface VersionItemDef {
  code: string;
  label: string;
  criticality: 'CRITICAL' | 'NON_CRITICAL';
  criticalFunctionKey?: string | null;
}

/** Version group definition: which item codes it covers (ordered). */
export interface VersionGroupDef {
  key: string;
  required: boolean;
  memberItemCodes: string[];
}

export interface CanonicalizeInput {
  groups: VersionGroupDef[];
  items: VersionItemDef[];
  /** Code of the ungrouped item that carries the general note (empty if none). */
  generalNoteItemCode: string;
  submission: {
    groups: SubmittedGroup[];
    generalNote?: string;
  };
}

export class FieldSubmissionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FieldSubmissionError';
    this.code = code;
  }
}

const isBlank = (s: string | undefined): boolean => !s || s.trim().length === 0;

function toResponse(
  item: VersionItemDef,
  result: ResponseResult,
  note?: string,
): EvaluatedResponse {
  return {
    itemCode: item.code,
    label: item.label,
    result,
    criticality: item.criticality,
    ...(item.criticalFunctionKey ? { criticalFunctionKey: item.criticalFunctionKey } : {}),
    ...(note ? { note } : {}),
  };
}

export function canonicalizeFieldSubmission(input: CanonicalizeInput): EvaluatedResponse[] {
  const itemByCode = new Map(input.items.map((it) => [it.code, it]));
  const groupByKey = new Map(input.groups.map((g) => [g.key, g]));

  // Reject duplicate submitted group keys (no Map last-wins) and unknown groups.
  const seenGroupKeys = new Set<string>();
  for (const s of input.submission.groups) {
    if (seenGroupKeys.has(s.groupKey)) {
      throw new FieldSubmissionError('DUPLICATE_GROUP', `ส่งกลุ่มตรวจซ้ำในคำขอเดียวกัน`);
    }
    seenGroupKeys.add(s.groupKey);
    if (!groupByKey.has(s.groupKey)) {
      throw new FieldSubmissionError('UNKNOWN_GROUP', `ไม่พบกลุ่มตรวจในเวอร์ชันของใบงานนี้`);
    }
  }
  const submittedByKey = new Map(input.submission.groups.map((g) => [g.groupKey, g]));

  const responses: EvaluatedResponse[] = [];

  for (const group of input.groups) {
    const submitted = submittedByKey.get(group.key);
    if (!submitted) {
      if (group.required) {
        throw new FieldSubmissionError('REQUIRED_GROUP_MISSING', `ยังตอบกลุ่มตรวจไม่ครบ`);
      }
      continue; // optional group left unanswered
    }

    const memberItems = group.memberItemCodes.map((code) => {
      const item = itemByCode.get(code);
      if (!item) {
        throw new FieldSubmissionError('UNKNOWN_MEMBER', `รายการตรวจไม่ตรงกับเวอร์ชันของใบงาน`);
      }
      return item;
    });

    if (submitted.outcome === 'NORMAL') {
      for (const item of memberItems) responses.push(toResponse(item, 'PASS'));
      continue;
    }

    if (submitted.outcome === 'UNTESTABLE') {
      if (isBlank(submitted.reason)) {
        throw new FieldSubmissionError('UNTESTABLE_NEEDS_REASON', `กรุณาระบุเหตุผลที่ตรวจไม่ได้`);
      }
      for (const item of memberItems) responses.push(toResponse(item, 'UNKNOWN', submitted.reason));
      continue;
    }

    // PROBLEM
    const states = new Map<string, MemberState>();
    for (const m of submitted.members ?? []) {
      if (!group.memberItemCodes.includes(m.memberKey)) {
        throw new FieldSubmissionError('UNKNOWN_MEMBER', `รายการตรวจไม่ตรงกับกลุ่มที่ระบุ`);
      }
      if (states.has(m.memberKey)) {
        throw new FieldSubmissionError('DUPLICATE_MEMBER', `ส่งรายการตรวจซ้ำในกลุ่มเดียวกัน`);
      }
      states.set(m.memberKey, m.state);
    }
    const hasProblem = [...states.values()].some((s) => s === 'PROBLEM');
    if (!hasProblem) {
      throw new FieldSubmissionError('PROBLEM_NEEDS_MEMBER', `เลือกอย่างน้อยหนึ่งรายการที่มีปัญหา`);
    }
    if (isBlank(submitted.note)) {
      throw new FieldSubmissionError('PROBLEM_NEEDS_NOTE', `กรุณาระบุอาการที่พบ`);
    }
    for (const item of memberItems) {
      const state = states.get(item.code);
      if (state === 'OK') responses.push(toResponse(item, 'PASS'));
      else if (state === 'PROBLEM') responses.push(toResponse(item, 'FAIL', submitted.note));
      else responses.push(toResponse(item, 'UNKNOWN')); // UNTESTED or omitted → never PASS
    }
  }

  // General note → the ungrouped note item as an NA response carrying the text.
  if (input.generalNoteItemCode) {
    const noteItem = itemByCode.get(input.generalNoteItemCode);
    if (noteItem) {
      responses.push(toResponse(noteItem, 'NA', input.submission.generalNote));
    }
  }

  return responses;
}
```

- [ ] **Step 5: Re-export from the checklist barrel** — in `src/domain/checklist/index.ts`, append:

```ts
export {
  canonicalizeFieldSubmission,
  FieldSubmissionError,
  type CanonicalizeInput,
  type SubmittedGroup,
  type SubmittedMember,
  type VersionItemDef,
  type VersionGroupDef,
  type GroupOutcome,
  type MemberState,
} from './canonicalize';
```

- [ ] **Step 6: Run it to confirm it passes** — `pnpm test -- src/domain/checklist/canonicalize.test.ts`
      Expected GREEN: all cases pass, exit 0.

- [ ] **Step 7: Commit**

```
git add src/domain/checklist/index.ts src/domain/checklist/canonicalize.ts src/domain/checklist/canonicalize.test.ts
git commit -m "feat(domain): pure canonicalizeFieldSubmission (group outcomes -> responses)

Criticality and function keys are read from item definitions, never the wire.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Domain — `validateChecklistVersionForPublish` (pure)

**Files:**
- Create: `src/domain/checklist/version-lifecycle.ts`
- Test: `src/domain/checklist/version-lifecycle.test.ts`
- Modify: `src/domain/checklist/index.ts` (re-export)

- [ ] **Step 1: Write the failing test** — create `src/domain/checklist/version-lifecycle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  validateChecklistVersionForPublish,
  type PublishValidationInput,
} from './version-lifecycle';

const V = 'ver-1';

function base(over: Partial<PublishValidationInput> = {}): PublishValidationInput {
  return {
    versionId: V,
    requiredCriticalFunctionKeys: ['sos_button', 'microphone'],
    items: [
      { versionId: V, code: 'm_sos_button', label: 'ปุ่ม SOS', criticalFunctionKey: 'sos_button' },
      { versionId: V, code: 'm_microphone', label: 'ไมโครโฟน', criticalFunctionKey: 'microphone' },
      { versionId: V, code: 'm_note', label: 'หมายเหตุ', criticalFunctionKey: null },
    ],
    groups: [
      { key: 'g_power', label: 'กลุ่ม A', order: 1, required: true, reasonPolicy: 'STANDARD', photoPolicy: 'NONE', members: [{ itemCode: 'm_sos_button', label: 'ปุ่ม SOS', itemVersionId: V }] },
      { key: 'g_audio', label: 'กลุ่ม B', order: 2, required: true, reasonPolicy: 'STANDARD', photoPolicy: 'NONE', members: [{ itemCode: 'm_microphone', label: 'ไมโครโฟน', itemVersionId: V }] },
    ],
    ...over,
  };
}

describe('validateChecklistVersionForPublish', () => {
  it('accepts a well-formed monthly draft', () => {
    expect(validateChecklistVersionForPublish(base()).ok).toBe(true);
  });

  it('rejects duplicate group keys', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [g[0], { ...g[1], key: 'g_power' }] }));
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate group order', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [g[0], { ...g[1], order: 1 }] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a required group with no members', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], members: [] }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a membership referencing an item not in this version', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], members: [{ itemCode: 'ghost', label: 'x', itemVersionId: V }] }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a cross-version member even when a same-code item exists in this version', () => {
    // m_sos_button exists in this version, but this membership references an item
    // of a DIFFERENT version with the same code — must be rejected factually.
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], members: [{ itemCode: 'm_sos_button', label: 'ปุ่ม SOS', itemVersionId: 'other-ver' }] }, g[1]] }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('คนละเวอร์ชัน');
  });

  it('rejects an empty group label', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], label: '  ' }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects an empty member label', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], members: [{ itemCode: 'm_sos_button', label: '', itemVersionId: V }] }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects when the members do not cover a required critical function', () => {
    const r = validateChecklistVersionForPublish(base({ requiredCriticalFunctionKeys: ['sos_button', 'microphone', 'camera_recording'] }));
    expect(r.ok).toBe(false);
  });

  it('rejects an unrecognized reason policy', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], reasonPolicy: 'WHATEVER' }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a non-NONE photo policy in this slice', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], photoPolicy: 'REQUIRED' }, g[1]] }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).not.toContain('undefined');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails** — `pnpm test -- src/domain/checklist/version-lifecycle.test.ts`
      Expected RED: `Failed to resolve import "./version-lifecycle"`.

- [ ] **Step 3: Implement** — create `src/domain/checklist/version-lifecycle.ts`:

```ts
// src/domain/checklist/version-lifecycle.ts
//
// PURE publish-time validation for a checklist version draft. Publishing freezes
// the version; these checks guarantee a published monthly version is coherent and
// never silently drops a critical check or promises an uncapturable photo.
// "What readiness expects" (requiredCriticalFunctionKeys) is injected so the
// domain stays free of runtime constants.

export const SUPPORTED_REASON_POLICIES = new Set(['STANDARD']);
/** Only NONE is enforceable until photo upload exists (design §Photo policy). */
export const SUPPORTED_PHOTO_POLICIES_ON_PUBLISH = new Set(['NONE']);

export interface DraftMemberDef {
  itemCode: string;
  label: string;
  /** The actual versionId of the referenced item — checked against the target version. */
  itemVersionId: string;
}

export interface DraftGroupDef {
  key: string;
  label: string;
  order: number;
  required: boolean;
  reasonPolicy: string;
  photoPolicy: string;
  members: DraftMemberDef[];
}

export interface DraftItemDef {
  versionId: string;
  code: string;
  label: string;
  criticalFunctionKey?: string | null;
}

export interface PublishValidationInput {
  /** The version being published; every membership must reference an item of THIS version. */
  versionId: string;
  groups: DraftGroupDef[];
  items: DraftItemDef[];
  requiredCriticalFunctionKeys: string[];
}

export interface PublishValidationResult {
  ok: boolean;
  errors: string[];
}

const isBlank = (s: string): boolean => s.trim().length === 0;

export function validateChecklistVersionForPublish(
  input: PublishValidationInput,
): PublishValidationResult {
  const errors: string[] = [];
  const itemCodes = new Set(input.items.map((i) => i.code));

  // Unique group keys and orders (among all groups).
  const seenKeys = new Set<string>();
  const seenOrders = new Set<number>();
  for (const g of input.groups) {
    if (seenKeys.has(g.key)) errors.push(`คีย์กลุ่มซ้ำ: ${g.key}`);
    seenKeys.add(g.key);
    if (seenOrders.has(g.order)) errors.push(`ลำดับกลุ่มซ้ำ: ${g.order}`);
    seenOrders.add(g.order);

    if (isBlank(g.label)) errors.push(`กลุ่ม ${g.key} ต้องมีชื่อภาษาไทย`);
    if (g.required && g.members.length === 0) errors.push(`กลุ่ม ${g.key} ต้องมีสมาชิกอย่างน้อยหนึ่งรายการ`);

    for (const m of g.members) {
      // Factual same-version check: compare the member item's ACTUAL versionId,
      // not just its code (a different version may hold an item with the same code).
      if (m.itemVersionId !== input.versionId) {
        errors.push(`สมาชิก ${m.itemCode} อยู่คนละเวอร์ชันกับกลุ่ม`);
        continue;
      }
      if (!itemCodes.has(m.itemCode)) errors.push(`สมาชิก ${m.itemCode} ไม่อยู่ในเวอร์ชันนี้`);
      if (isBlank(m.label)) errors.push(`สมาชิก ${m.itemCode} ต้องมีชื่อภาษาไทย`);
    }

    if (!SUPPORTED_REASON_POLICIES.has(g.reasonPolicy)) errors.push(`นโยบายเหตุผลของกลุ่ม ${g.key} ไม่รองรับ`);
    if (!SUPPORTED_PHOTO_POLICIES_ON_PUBLISH.has(g.photoPolicy)) errors.push(`นโยบายรูปของกลุ่ม ${g.key} ไม่รองรับในรุ่นนี้`);
  }

  // Members collectively cover every required critical function.
  const coveredKeys = new Set<string>();
  const memberItemCodes = new Set(input.groups.flatMap((g) => g.members.map((m) => m.itemCode)));
  for (const item of input.items) {
    if (memberItemCodes.has(item.code) && item.criticalFunctionKey) {
      coveredKeys.add(item.criticalFunctionKey);
    }
  }
  for (const key of input.requiredCriticalFunctionKeys) {
    if (!coveredKeys.has(key)) errors.push(`เวอร์ชันนี้ยังไม่ครอบคลุมฟังก์ชันวิกฤต: ${key}`);
  }

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Re-export** — in `src/domain/checklist/index.ts`, append:

```ts
export {
  validateChecklistVersionForPublish,
  SUPPORTED_REASON_POLICIES,
  SUPPORTED_PHOTO_POLICIES_ON_PUBLISH,
  type PublishValidationInput,
  type PublishValidationResult,
  type DraftGroupDef,
  type DraftItemDef,
} from './version-lifecycle';
```

- [ ] **Step 5: Run it to confirm it passes** — `pnpm test -- src/domain/checklist/version-lifecycle.test.ts`  → all pass, exit 0.
- [ ] **Step 6: Run the full DB-free suite** — `pnpm test` → all pass (baseline 182 + the three new files' cases). Record the total. Then `pnpm typecheck` → exit 0.
- [ ] **Step 7: Commit**

```
git add src/domain/checklist/version-lifecycle.ts src/domain/checklist/version-lifecycle.test.ts src/domain/checklist/index.ts
git commit -m "feat(domain): pure publish-time validation for checklist versions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Schema — field groups + version lifecycle (additive migration)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<new>/migration.sql` (generated + one appended UPDATE)

This is additive only — no column dropped or repurposed. Requires the local `sos` PostGIS from §2.

- [ ] **Step 1: Add the enums** — in `prisma/schema.prisma`, after the `ResponseResult` enum block, add:

```prisma
enum ChecklistVersionStatus {
  DRAFT
  PUBLISHED
  RETIRED
}

enum ChecklistReasonPolicy {
  STANDARD
}

enum ChecklistPhotoPolicy {
  NONE
  OPTIONAL
  REQUIRED
}
```

- [ ] **Step 2: Add lifecycle fields + relation to `ChecklistTemplateVersion`** — edit the model to add `status`, `retiredAt`, and the `fieldGroups` relation (keep `publishedAt`/`isLocked`):

```prisma
model ChecklistTemplateVersion {
  id          String                 @id @default(uuid()) @db.Uuid
  templateId  String                 @db.Uuid
  version     Int
  status      ChecklistVersionStatus @default(DRAFT)
  publishedAt DateTime?
  retiredAt   DateTime?
  isLocked    Boolean                @default(false) // true once published/used — blocks edits
  createdAt   DateTime               @default(now())

  template    ChecklistTemplate     @relation(fields: [templateId], references: [id])
  items       ChecklistItem[]
  fieldGroups ChecklistFieldGroup[]
  plans       MaintenancePlan[]
  workOrders  WorkOrder[]
  responses   ChecklistResponse[]

  @@unique([templateId, version])
  @@map("checklist_template_version")
}
```

- [ ] **Step 3: Add membership to `ChecklistItem`** — edit the model to add `fieldGroupId`, `memberOrder`, the relation, and an index:

```prisma
model ChecklistItem {
  id             String            @id @default(uuid()) @db.Uuid
  versionId      String            @db.Uuid
  order          Int
  code           String // stable within version
  label          String
  kind           ChecklistItemKind @default(BOOLEAN_PASS_FAIL)
  criticality    Criticality       @default(NON_CRITICAL)
  criticalFunctionKey String? // maps to a critical function, e.g. 'sos_button'
  requiresPhoto  Boolean           @default(false)
  helpText       String?
  fieldGroupId   String?           @db.Uuid // nullable: ungrouped items (e.g. the general note)
  memberOrder    Int?

  version    ChecklistTemplateVersion @relation(fields: [versionId], references: [id])
  fieldGroup ChecklistFieldGroup?     @relation(fields: [fieldGroupId], references: [id])
  responses  ChecklistResponse[]

  @@unique([versionId, code])
  @@index([versionId])
  @@index([fieldGroupId])
  @@map("checklist_item")
}
```

- [ ] **Step 4: Add the `ChecklistFieldGroup` model** — insert immediately after `ChecklistItem`:

```prisma
/// Version-scoped field group. Content (label/help/order/membership/policies) is
/// frozen when its version is published; editorial change means a new draft version.
model ChecklistFieldGroup {
  id                 String                @id @default(uuid()) @db.Uuid
  checklistVersionId String                @db.Uuid
  key                String // stable within the version, e.g. 'power_readiness'
  label              String // Thai display label
  helpText           String? // Thai help text
  order              Int
  required           Boolean               @default(true)
  reasonPolicy       ChecklistReasonPolicy @default(STANDARD)
  photoPolicy        ChecklistPhotoPolicy  @default(NONE)
  createdAt          DateTime              @default(now())

  version ChecklistTemplateVersion @relation(fields: [checklistVersionId], references: [id])
  members ChecklistItem[]

  @@unique([checklistVersionId, key])
  @@index([checklistVersionId])
  @@map("checklist_field_group")
}
```

- [ ] **Step 5: Format + validate the schema** — `pnpm exec prisma format` then `pnpm exec prisma validate`. Expected: "The schema … is valid 🚀".

- [ ] **Step 6: Generate the migration WITHOUT applying** (so the backfill can be appended):

```
pnpm exec prisma migrate dev --create-only --name add_field_groups_and_version_lifecycle
```

Expected: a new folder `prisma/migrations/<timestamp>_add_field_groups_and_version_lifecycle/migration.sql` containing `CREATE TYPE` for the three enums, `CREATE TABLE "checklist_field_group"`, `ALTER TABLE "checklist_template_version" ADD COLUMN "status" … ADD COLUMN "retiredAt" …`, `ALTER TABLE "checklist_item" ADD COLUMN "fieldGroupId" … ADD COLUMN "memberOrder" …`, indexes, and FKs. Not yet applied.

- [ ] **Step 7: Append the legacy-classification backfill** — open the generated `migration.sql` and append at the end (after all DDL):

```sql
-- Legacy classification (design §Migration): every pre-existing checklist version
-- is frozen as PUBLISHED so nothing legacy is silently left editable. On a fresh
-- database this affects zero rows; seed.ts creates fresh versions already frozen.
UPDATE "checklist_template_version" SET "status" = 'PUBLISHED', "isLocked" = true;
```

- [ ] **Step 8: Apply the migration + regenerate the client** — `pnpm exec prisma migrate dev` (applies the pending migration and runs `prisma generate`). Expected: "Your database is now in sync with your schema." and client generated.
- [ ] **Step 9: Static gates** — `pnpm typecheck` → exit 0; `pnpm lint` → exit 0; `git diff --check` → clean.
- [ ] **Step 10: Commit**

```
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): additive field-group table + version lifecycle (DRAFT/PUBLISHED/RETIRED)

Legacy versions are backfilled to PUBLISHED/frozen in the same migration.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Seed — version-1 PUBLISHED/frozen; idempotent item seeding

**Files:**
- Modify: `prisma/seed.ts`

Freezing legacy on a *fresh* DB must match the migration backfill on a *deployed* DB. Item seeding becomes "create only when absent" so a frozen version is never mutated (immutability).

- [ ] **Step 1: Import the lifecycle enum** — in `prisma/seed.ts`, add `ChecklistVersionStatus` to the `@prisma/client` import:

```ts
import {
  PrismaClient,
  Criticality,
  ChecklistItemKind,
  ChecklistVersionStatus,
  MaintenanceKind,
  RecurrenceFrequency,
  AssetLifecycleStatus,
  AppRole,
} from '@prisma/client';
```

- [ ] **Step 2: Create versions frozen + seed items only when absent** — replace the version upsert + item block inside the `for (const cl of CHECKLISTS)` loop with:

```ts
    const version = await prisma.checklistTemplateVersion.upsert({
      where: { templateId_version: { templateId: template.id, version: 1 } },
      update: {},
      create: {
        templateId: template.id,
        version: 1,
        status: ChecklistVersionStatus.PUBLISHED,
        publishedAt: new Date(),
        isLocked: true,
      },
    });
    versionIdByKey.set(cl.key, version.id);

    // Published versions are immutable: seed items only when the version has none
    // (idempotent create; a re-seed never rewrites a frozen version's items).
    const itemCount = await prisma.checklistItem.count({ where: { versionId: version.id } });
    if (itemCount === 0) {
      await prisma.checklistItem.createMany({
        data: cl.items.map((it, i) => ({
          versionId: version.id,
          order: i + 1,
          code: it.code,
          label: it.label,
          kind: it.kind,
          criticality: it.criticality,
          criticalFunctionKey: it.criticalFunctionKey ?? null,
          requiresPhoto: it.requiresPhoto ?? false,
        })),
      });
    }
```

- [ ] **Step 3: Re-seed idempotency check** — with the local DB up, run `pnpm db:seed` twice. Expected: both runs finish with the same `✔ Seed complete: 27 assets, 324 components, 52 checklist items, 3 plans.` line (item count unchanged on the second run — no duplication, no rewrite).
- [ ] **Step 4: Static gates** — `pnpm typecheck` → exit 0; `pnpm test` → unchanged (seed is not imported by unit tests).
- [ ] **Step 5: Commit**

```
git add prisma/seed.ts
git commit -m "feat(db): seed checklist versions as PUBLISHED/frozen; idempotent item seed

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: DTO — group-outcome inspection payload

**Files:**
- Modify: `src/server/dto/schemas.ts`
- Modify: `src/server/dto/schemas.test.ts`

The submit contract carries group outcomes only — no client-supplied criticality or function keys.

- [ ] **Step 1: Update the test first (RED)** — replace the `inspectionPayloadSchema` import and its `describe` block in `src/server/dto/schemas.test.ts`. New imports line:

```ts
import {
  gpsSchema,
  fieldInspectionPayloadSchema,
  mutationEnvelopeSchema,
} from './schemas';
```

Replace the `describe('inspectionPayloadSchema', …)` block with:

```ts
describe('fieldInspectionPayloadSchema', () => {
  it('requires at least one group', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });

  it('accepts a valid NORMAL group payload with an optional general note', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{ groupKey: 'g_power', outcome: 'NORMAL' }],
      generalNote: 'ปกติดี',
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(true);
  });

  it('accepts a PROBLEM group with member states and a note', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{
        groupKey: 'g_audio',
        outcome: 'PROBLEM',
        members: [{ memberKey: 'm_microphone', state: 'PROBLEM' }],
        note: 'ไมค์เสีย',
      }],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown outcome token', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{ groupKey: 'g', outcome: 'PASS' }],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a duplicate group key', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{ groupKey: 'g_audio', outcome: 'NORMAL' }, { groupKey: 'g_audio', outcome: 'NORMAL' }],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a duplicate member key within a group', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{
        groupKey: 'g_audio',
        outcome: 'PROBLEM',
        members: [{ memberKey: 'm_mic', state: 'OK' }, { memberKey: 'm_mic', state: 'PROBLEM' }],
        note: 'x',
      }],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails** — `pnpm test -- src/server/dto/schemas.test.ts`
      Expected RED: import error for `fieldInspectionPayloadSchema` (does not exist yet).

- [ ] **Step 3: Implement** — in `src/server/dto/schemas.ts`, remove `responseResultSchema`, `evaluatedResponseSchema`, `inspectionPayloadSchema` and the `InspectionPayload` type export; keep `gpsSchema`, `attachmentManifestItemSchema`, `mutationEnvelopeSchema`, `GpsInput`. Add:

```ts
export const groupOutcomeSchema = z.enum(['NORMAL', 'PROBLEM', 'UNTESTABLE']);
export const memberStateSchema = z.enum(['OK', 'PROBLEM', 'UNTESTED']);

export const submittedMemberSchema = z.object({
  memberKey: z.string().min(1),
  state: memberStateSchema,
});

export const submittedGroupSchema = z.object({
  groupKey: z.string().min(1),
  outcome: groupOutcomeSchema,
  members: z.array(submittedMemberSchema).optional(),
  note: z.string().optional(),
  reason: z.string().optional(),
});

export const fieldInspectionPayloadSchema = z
  .object({
    workOrderId: z.string().min(1),
    groups: z.array(submittedGroupSchema).min(1),
    generalNote: z.string().optional(),
    gps: gpsSchema,
  })
  .superRefine((val, ctx) => {
    // Reject duplicate group keys across the payload and duplicate member keys
    // within a group (defence in depth alongside the domain canonicalizer).
    const groupKeys = new Set<string>();
    for (const g of val.groups) {
      if (groupKeys.has(g.groupKey)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['groups'], message: `duplicate groupKey: ${g.groupKey}` });
      }
      groupKeys.add(g.groupKey);
      const memberKeys = new Set<string>();
      for (const m of g.members ?? []) {
        if (memberKeys.has(m.memberKey)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['groups'], message: `duplicate memberKey: ${m.memberKey}` });
        }
        memberKeys.add(m.memberKey);
      }
    }
  });

export type FieldInspectionPayload = z.infer<typeof fieldInspectionPayloadSchema>;
```

- [ ] **Step 4: Run it to confirm it passes** — `pnpm test -- src/server/dto/schemas.test.ts` → all pass.
- [ ] **Step 5: Commit** (route wiring that consumes it lands in Task 9)

```
git add src/server/dto/schemas.ts src/server/dto/schemas.test.ts
git commit -m "feat(dto): group-outcome field inspection payload (no client-supplied criticality)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Bootstrap query — display-safe grouped shape

**Files:**
- Modify: `src/server/queries/sync.ts`

- [ ] **Step 1: Replace the interfaces + query** — rewrite `src/server/queries/sync.ts` entirely with:

```ts
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/**
 * Offline sync bootstrap (doc 04, ADR 0004): each open work order with its asset
 * and the pinned version's FIELD GROUPS to render. Display-safe only — no item
 * kind, criticality, or critical-function key ever leaves the server here.
 */
export interface SyncFieldGroupMember {
  /** Opaque round-trip identifier (the item code); never displayed. */
  memberKey: string;
  label: string;
}

export interface SyncFieldGroup {
  /** Opaque identifier; never displayed. */
  key: string;
  label: string;
  help: string | null;
  order: number;
  required: boolean;
  reasonPolicy: string;
  photoPolicy: string;
  members: SyncFieldGroupMember[];
}

export interface SyncWorkOrder {
  id: string;
  code: string;
  kind: string;
  status: string;
  dueAt: Date | null;
  scheduledFor: Date | null;
  asset: { code: string; name: string; latitude: number; longitude: number };
  groups: SyncFieldGroup[];
}

export interface SyncBootstrap {
  generatedAt: Date;
  workOrders: SyncWorkOrder[];
}

const OFFLINE_WO_STATUSES = ['PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'] as const;

export async function getSyncBootstrap(
  userId: string | null,
  now: Date,
  client: PrismaClient = defaultPrisma,
): Promise<SyncBootstrap> {
  const rows = await client.workOrder.findMany({
    where: {
      status: { in: [...OFFLINE_WO_STATUSES] },
      ...(userId ? { assignments: { some: { userId } } } : {}),
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      code: true,
      kind: true,
      status: true,
      dueAt: true,
      scheduledFor: true,
      asset: { select: { code: true, name: true, latitude: true, longitude: true } },
      checklistVersion: {
        select: {
          fieldGroups: {
            orderBy: { order: 'asc' },
            select: {
              key: true,
              label: true,
              helpText: true,
              order: true,
              required: true,
              reasonPolicy: true,
              photoPolicy: true,
              members: {
                orderBy: { memberOrder: 'asc' },
                select: { code: true, label: true },
              },
            },
          },
        },
      },
    },
  });

  return {
    generatedAt: now,
    workOrders: rows.map((w) => ({
      id: w.id,
      code: w.code,
      kind: w.kind,
      status: w.status,
      dueAt: w.dueAt,
      scheduledFor: w.scheduledFor,
      asset: w.asset,
      groups: (w.checklistVersion?.fieldGroups ?? []).map((g) => ({
        key: g.key,
        label: g.label,
        help: g.helpText,
        order: g.order,
        required: g.required,
        reasonPolicy: g.reasonPolicy,
        photoPolicy: g.photoPolicy,
        members: g.members.map((m) => ({ memberKey: m.code, label: m.label })),
      })),
    })),
  };
}
```

- [ ] **Step 2: Static gates** — `pnpm typecheck` (bootstrap route consumes this; its `json(bootstrap)` is shape-agnostic so it still compiles). Expected exit 0. `pnpm build` will fail later only if the UI still references `.checklist` — that is fixed in Task 12; run gates fully at Task 16.
- [ ] **Step 3: Commit**

```
git add src/server/queries/sync.ts
git commit -m "feat(query): bootstrap returns display-safe field groups, no enum leakage

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Server — load the pinned checklist definition

**Files:**
- Create: `src/server/queries/checklist-definition.ts`

This is server-only and DOES include criticality/function keys (never sent to the client) — it feeds `canonicalizeFieldSubmission`.

- [ ] **Step 1: Implement** — create `src/server/queries/checklist-definition.ts`:

```ts
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/** Server-authoritative pinned-version definition used to canonicalize a submit. */
export interface PinnedGroupMember {
  memberKey: string; // item code
  label: string;
}
export interface PinnedGroup {
  key: string;
  required: boolean;
  members: PinnedGroupMember[];
}
export interface PinnedItem {
  code: string;
  label: string;
  criticality: 'CRITICAL' | 'NON_CRITICAL';
  criticalFunctionKey: string | null;
}
export interface PinnedChecklistDefinition {
  versionId: string;
  groups: PinnedGroup[];
  items: PinnedItem[];
  /** Ungrouped item that carries the general note (lowest order), or null. */
  generalNoteItemCode: string | null;
}

export async function loadPinnedChecklistDefinition(
  workOrderId: string,
  client: PrismaClient = defaultPrisma,
): Promise<PinnedChecklistDefinition | null> {
  const wo = await client.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      checklistVersion: {
        select: {
          id: true,
          fieldGroups: {
            orderBy: { order: 'asc' },
            select: {
              key: true,
              required: true,
              members: {
                orderBy: { memberOrder: 'asc' },
                select: { code: true, label: true },
              },
            },
          },
          items: {
            orderBy: { order: 'asc' },
            select: {
              code: true,
              label: true,
              criticality: true,
              criticalFunctionKey: true,
              fieldGroupId: true,
            },
          },
        },
      },
    },
  });

  const version = wo?.checklistVersion;
  if (!version) return null;

  const ungrouped = version.items.filter((it) => it.fieldGroupId === null);

  return {
    versionId: version.id,
    groups: version.fieldGroups.map((g) => ({
      key: g.key,
      required: g.required,
      members: g.members.map((m) => ({ memberKey: m.code, label: m.label })),
    })),
    items: version.items.map((it) => ({
      code: it.code,
      label: it.label,
      criticality: it.criticality,
      criticalFunctionKey: it.criticalFunctionKey,
    })),
    generalNoteItemCode: ungrouped.length > 0 ? ungrouped[0].code : null,
  };
}
```

- [ ] **Step 2: Static gate** — `pnpm typecheck` → exit 0.
- [ ] **Step 3: Commit**

```
git add src/server/queries/checklist-definition.ts
git commit -m "feat(query): server-only pinned checklist definition loader for canonicalization

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Route + error mapping + adapter — wire canonicalization

**Files:**
- Modify: `src/app/api/inspections/route.ts`
- Modify: `src/server/http/respond.ts`
- Modify: `src/server/adapters/prisma-inspection-port.ts`

- [ ] **Step 1: Persist notes in the adapter** — in `src/server/adapters/prisma-inspection-port.ts`, inside the `persist` loop's `tx.checklistResponse.create({ data: { … } })`, add `note` right after `result: r.result,`:

```ts
            data: {
              workOrderId: wo.id,
              itemId,
              checklistVersionId: wo.checklistVersionId,
              result: r.result,
              note: r.note ?? null,
              capturedLat: input.gps.lat,
              capturedLng: input.gps.lng,
              distanceMeters: input.gps.distanceMeters,
              locationException: input.gps.isException,
              reviewFlag: input.gps.reviewFlag,
              clientMutationId: i === 0 ? input.mutationId : null,
              observedAt,
            },
```

- [ ] **Step 2: Map `FieldSubmissionError` + `NO_FIELD_GROUPS`** — in `src/server/http/respond.ts`: add the import and the handler, and extend `inspectionStatus`.

Add near the other imports:

```ts
import { FieldSubmissionError } from '@/domain/checklist/canonicalize';
```

In `inspectionStatus`, add `NO_FIELD_GROUPS` to the 400 branch:

```ts
    case 'INVALID_ENVELOPE':
    case 'NO_CHECKLIST_VERSION':
    case 'NO_FIELD_GROUPS':
      return 400;
```

In `errorResponse`, add before the `InspectionError` branch:

```ts
  if (err instanceof FieldSubmissionError) {
    return json({ error: err.code, message: err.message }, 400);
  }
```

- [ ] **Step 3: Rewrite the route** — replace `src/app/api/inspections/route.ts` with:

```ts
import { getSession, requirePermission } from '@/server/auth/session';
import { createPrismaInspectionPort } from '@/server/adapters/prisma-inspection-port';
import {
  submitInspection,
  InspectionError,
  type InspectionPayload,
} from '@/server/services/submit-inspection';
import {
  fieldInspectionPayloadSchema,
  mutationEnvelopeSchema,
} from '@/server/dto/schemas';
import { canonicalizeFieldSubmission } from '@/domain/checklist';
import { loadPinnedChecklistDefinition } from '@/server/queries/checklist-definition';
import type { MutationEnvelope } from '@/domain/sync/envelope';
import { errorResponse, json } from '@/server/http/respond';

/**
 * POST /api/inspections — submit a completed monthly field inspection as GROUP
 * OUTCOMES (doc 04 sync + doc 08). Requires `workorder:submit`. The untrusted
 * body is Zod-parsed; the server loads the work order's pinned version and
 * canonicalizes group outcomes into per-item responses (criticality/function
 * keys read from item definitions, never the wire), then runs the pure
 * submit-inspection service (idempotent on the envelope mutationId). 201 on first
 * apply, 200 on idempotent replay.
 */
export const dynamic = 'force-dynamic';

const port = createPrismaInspectionPort();

export async function POST(req: Request): Promise<Response> {
  try {
    const session = requirePermission(await getSession(req), 'workorder:submit');

    const raw: unknown = await req.json();
    const env = mutationEnvelopeSchema.parse(raw);
    const payload = fieldInspectionPayloadSchema.parse(env.payload);

    const def = await loadPinnedChecklistDefinition(payload.workOrderId);
    if (!def) {
      throw new InspectionError('WORKORDER_NOT_FOUND', 'ไม่พบใบงานหรือเวอร์ชันเช็คลิสต์');
    }
    if (def.groups.length === 0) {
      throw new InspectionError(
        'NO_FIELD_GROUPS',
        'ใบงานนี้ผูกกับเวอร์ชันที่ยังไม่มีกลุ่มภาคสนาม กรุณาออกใบงานใหม่ภายใต้เวอร์ชันปัจจุบัน',
      );
    }

    const responses = canonicalizeFieldSubmission({
      groups: def.groups.map((g) => ({
        key: g.key,
        required: g.required,
        memberItemCodes: g.members.map((m) => m.memberKey),
      })),
      items: def.items.map((it) => ({
        code: it.code,
        label: it.label,
        criticality: it.criticality,
        criticalFunctionKey: it.criticalFunctionKey,
      })),
      generalNoteItemCode: def.generalNoteItemCode ?? '',
      submission: { groups: payload.groups, generalNote: payload.generalNote },
    });

    const envelope: MutationEnvelope<InspectionPayload> = {
      mutationId: env.mutationId,
      deviceId: env.deviceId,
      entity: env.entity,
      action: env.action,
      baseVersion: env.baseVersion,
      clientOccurredAt: env.clientOccurredAt,
      payloadChecksum: env.payloadChecksum,
      payload: { workOrderId: payload.workOrderId, responses, gps: payload.gps },
      attachments: env.attachments,
    };

    const result = await submitInspection(port, {
      envelope,
      actor: session,
      now: new Date(),
    });

    return json(result, result.idempotentReplay ? 200 : 201);
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 4: Static gates** — `pnpm typecheck` → exit 0; `pnpm lint` → exit 0. (`InspectionError` is exported from `submit-inspection.ts` — confirm the import resolves.)
- [ ] **Step 5: Commit**

```
git add src/app/api/inspections/route.ts src/server/http/respond.ts src/server/adapters/prisma-inspection-port.ts
git commit -m "feat(api): canonicalize group outcomes server-side before submit-inspection

Persist per-response notes; map field-submission errors + NO_FIELD_GROUPS to 400.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Checklist-version service — publish / repoint / retire

**Files:**
- Create: `src/server/services/checklist-version.ts`

Referenceability ("only PUBLISHED may be referenced/pinned") lives here, not in a FK.

- [ ] **Step 1: Implement** — create `src/server/services/checklist-version.ts`:

```ts
import { ChecklistVersionStatus, type PrismaClient } from '@prisma/client';
import { validateChecklistVersionForPublish } from '../../domain/checklist';

/** Errors from checklist-version lifecycle operations (mapped to HTTP by callers). */
export class ChecklistVersionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ChecklistVersionError';
    this.code = code;
  }
}

/**
 * Validate a DRAFT version and freeze it as PUBLISHED. Runs the pure publish
 * validation over the loaded groups/items; throws with the first errors on
 * failure. `requiredCriticalFunctionKeys` is what readiness expects for this kind.
 */
export async function publishChecklistVersion(
  prisma: PrismaClient,
  versionId: string,
  requiredCriticalFunctionKeys: string[],
): Promise<void> {
  const version = await prisma.checklistTemplateVersion.findUnique({
    where: { id: versionId },
    select: {
      status: true,
      items: { select: { code: true, label: true, criticalFunctionKey: true } },
      fieldGroups: {
        orderBy: { order: 'asc' },
        select: {
          key: true,
          label: true,
          order: true,
          required: true,
          reasonPolicy: true,
          photoPolicy: true,
          // Select each member item's OWN versionId for the factual same-version check.
          members: { orderBy: { memberOrder: 'asc' }, select: { code: true, label: true, versionId: true } },
        },
      },
    },
  });
  if (!version) throw new ChecklistVersionError('VERSION_NOT_FOUND', 'ไม่พบเวอร์ชันเช็คลิสต์');
  if (version.status === ChecklistVersionStatus.RETIRED) {
    throw new ChecklistVersionError('VERSION_RETIRED', 'เวอร์ชันนี้ถูกเลิกใช้แล้ว ไม่สามารถเผยแพร่ซ้ำได้');
  }
  if (version.status === ChecklistVersionStatus.PUBLISHED) return; // idempotent; never mutates a frozen version

  const result = validateChecklistVersionForPublish({
    versionId,
    requiredCriticalFunctionKeys,
    // version.items is the relation of THIS version, so each item's versionId === versionId.
    items: version.items.map((i) => ({ versionId, code: i.code, label: i.label, criticalFunctionKey: i.criticalFunctionKey })),
    groups: version.fieldGroups.map((g) => ({
      key: g.key,
      label: g.label,
      order: g.order,
      required: g.required,
      reasonPolicy: g.reasonPolicy,
      photoPolicy: g.photoPolicy,
      members: g.members.map((m) => ({ itemCode: m.code, label: m.label, itemVersionId: m.versionId })),
    })),
  });
  if (!result.ok) {
    throw new ChecklistVersionError('PUBLISH_VALIDATION_FAILED', result.errors.join('; '));
  }

  await prisma.checklistTemplateVersion.update({
    where: { id: versionId },
    data: { status: ChecklistVersionStatus.PUBLISHED, isLocked: true, publishedAt: new Date() },
  });
}

/**
 * Repoint a plan to a version — allowed only if that version is PUBLISHED AND its
 * template is the same maintenance kind as the plan (a monthly plan can never be
 * pointed at a weekly version, etc.).
 */
export async function repointPlanToVersion(
  prisma: PrismaClient,
  planId: string,
  versionId: string,
): Promise<void> {
  const [plan, version] = await Promise.all([
    prisma.maintenancePlan.findUnique({ where: { id: planId }, select: { kind: true } }),
    prisma.checklistTemplateVersion.findUnique({
      where: { id: versionId },
      select: { status: true, template: { select: { kind: true } } },
    }),
  ]);
  if (!plan) throw new ChecklistVersionError('PLAN_NOT_FOUND', 'ไม่พบแผนบำรุงรักษา');
  if (!version) throw new ChecklistVersionError('VERSION_NOT_FOUND', 'ไม่พบเวอร์ชันเช็คลิสต์');
  if (version.status !== ChecklistVersionStatus.PUBLISHED) {
    throw new ChecklistVersionError('NOT_PUBLISHED', 'อ้างอิงได้เฉพาะเวอร์ชันที่เผยแพร่แล้ว');
  }
  if (version.template.kind !== plan.kind) {
    throw new ChecklistVersionError('KIND_MISMATCH', 'เวอร์ชันเช็คลิสต์ไม่ตรงกับประเภทงานของแผน');
  }
  await prisma.maintenancePlan.update({
    where: { id: planId },
    data: { checklistVersionId: versionId },
  });
}

/** Retire a version — stops NEW references; never alters content. */
export async function retireChecklistVersion(
  prisma: PrismaClient,
  versionId: string,
): Promise<void> {
  const activePlans = await prisma.maintenancePlan.count({
    where: { checklistVersionId: versionId, active: true },
  });
  if (activePlans > 0) {
    throw new ChecklistVersionError('VERSION_IN_USE', 'ยังมีแผนใช้งานอ้างอิงเวอร์ชันนี้อยู่');
  }
  await prisma.checklistTemplateVersion.update({
    where: { id: versionId },
    data: { status: ChecklistVersionStatus.RETIRED, retiredAt: new Date() },
  });
}
```

- [ ] **Step 2: Map `ChecklistVersionError` in `respond.ts`** — in `src/server/http/respond.ts`, add the import and a handler (default 409, 404 for not-found):

```ts
import { ChecklistVersionError } from '@/server/services/checklist-version';
```

```ts
  if (err instanceof ChecklistVersionError) {
    const status =
      err.code === 'VERSION_NOT_FOUND' || err.code === 'PLAN_NOT_FOUND' ? 404 : 409;
    return json({ error: err.code, message: err.message }, status);
  }
```

- [ ] **Step 3: Static gates** — `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.
- [ ] **Step 4: Commit**

```
git add src/server/services/checklist-version.ts src/server/http/respond.ts
git commit -m "feat(service): checklist-version publish/repoint/retire with referenceability

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Monthly version-2 rollout script + wiring + demo code

**Files:**
- Create: `prisma/checklist-v2.ts` (library: canonical data + fingerprint + `rolloutMonthlyV2`; NO top-level side effects, so it is importable by tests)
- Create: `prisma/checklist-v2-cli.ts` (thin runner invoked by the package script)
- Create: `prisma/checklist-v2.test.ts` (DB-free fingerprint/guard unit test)
- Modify: `package.json`
- Modify: `prisma/demo-fixture.ts`

**Photo reconciliation (design §Photo policy):** V2 authors every monthly item with `requiresPhoto: false` (the whole definition is written explicitly here, not via the seed's `criticalFunctionItems` helper that set `m_camera_recording.requiresPhoto=true`), so no group promises an uncapturable photo; all five groups use `photoPolicy: NONE`. This satisfies "m_exterior.requiresPhoto=false" and reconciles the sibling `m_camera_recording` flag in the same explicit step.

- [ ] **Step 1: Implement the rollout LIBRARY** — create `prisma/checklist-v2.ts` (no top-level side effects; the CLI wrapper in Step 2 runs it):

```ts
// prisma/checklist-v2.ts
//
// Rollout LIBRARY for MONTHLY_FIELD checklist VERSION 2 — the grouped field
// experience. Exports the canonical definition, a pure content fingerprint, and an
// idempotent `rolloutMonthlyV2`. NO top-level side effects, so tests may import it.
//
// Safety:
//   - creation is ATOMIC (single $transaction) so a crash cannot leave a partially
//     authored draft;
//   - RETIRED -> refuse (never resurrect);
//   - ANY other existing v2 (DRAFT *or* PUBLISHED) must match the EXACT content
//     fingerprint before it is trusted or repointed. A drifted or tampered published
//     version is therefore never repointed to — the operator must reset and re-run.
// The fingerprint covers every authored field: each item's order, code, label, kind,
// criticality, criticalFunctionKey and requiresPhoto; each group's key, label,
// helpText, order, required, reason/photo policy and ordered membership.

import {
  ChecklistItemKind,
  ChecklistPhotoPolicy,
  ChecklistReasonPolicy,
  ChecklistVersionStatus,
  Criticality,
  MaintenanceKind,
  type PrismaClient,
} from '@prisma/client';
import { CRITICAL_FUNCTIONS } from '../src/domain/readiness/critical-functions';
import { publishChecklistVersion, repointPlanToVersion } from '../src/server/services/checklist-version';

const ASSET_TYPE_KEY = 'SOS_POLE';
const B = ChecklistItemKind.BOOLEAN_PASS_FAIL;
const TXT = ChecklistItemKind.TEXT;
const CRIT = Criticality.CRITICAL;
const NON = Criticality.NON_CRITICAL;

export interface V2Item {
  code: string;
  label: string;
  kind: ChecklistItemKind;
  criticality: Criticality;
  criticalFunctionKey: string | null;
}

// Ten monthly items (requiresPhoto is false for ALL — no photo capture this slice).
export const V2_ITEMS: V2Item[] = [
  { code: 'm_operating_power', label: 'ไฟเลี้ยงระบบ', kind: B, criticality: CRIT, criticalFunctionKey: 'operating_power' },
  { code: 'm_sos_button', label: 'ปุ่ม SOS', kind: B, criticality: CRIT, criticalFunctionKey: 'sos_button' },
  { code: 'm_confirmation_signal', label: 'ไฟ/เสียงยืนยัน', kind: B, criticality: CRIT, criticalFunctionKey: 'confirmation_signal' },
  { code: 'm_microphone', label: 'ไมโครโฟน', kind: B, criticality: CRIT, criticalFunctionKey: 'microphone' },
  { code: 'm_speaker_two_way_audio', label: 'ลำโพง/เสียงสองทาง', kind: B, criticality: CRIT, criticalFunctionKey: 'speaker_two_way_audio' },
  { code: 'm_network_voip', label: 'เครือข่าย/VoIP', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
  { code: 'm_center_sees', label: 'ศูนย์เห็นตำแหน่งถูกต้อง', kind: B, criticality: CRIT, criticalFunctionKey: 'network_voip' },
  { code: 'm_camera_recording', label: 'กล้องและการบันทึกภาพ', kind: B, criticality: CRIT, criticalFunctionKey: 'camera_recording' },
  { code: 'm_exterior', label: 'สภาพตู้/ป้าย/ฐานเสาภายนอก', kind: B, criticality: NON, criticalFunctionKey: null },
  { code: 'm_note', label: 'หมายเหตุเพิ่มเติม', kind: TXT, criticality: NON, criticalFunctionKey: null },
];

export interface V2Group {
  key: string;
  label: string;
  helpText: string;
  order: number;
  memberItemCodes: string[];
}

export const V2_GROUPS: V2Group[] = [
  { key: 'power_readiness', label: 'ระบบมีไฟเลี้ยงและพร้อมทำงาน', helpText: 'ตรวจว่าเสามีไฟเลี้ยงและระบบเปิดทำงานปกติ', order: 1, memberItemCodes: ['m_operating_power'] },
  { key: 'sos_button_signal', label: 'กดปุ่ม SOS แล้วมีไฟและเสียงยืนยัน', helpText: 'กดปุ่มขอความช่วยเหลือแล้วมีไฟและเสียงตอบรับ', order: 2, memberItemCodes: ['m_sos_button', 'm_confirmation_signal'] },
  { key: 'two_way_audio', label: 'สนทนาสองทางกับเจ้าหน้าที่ได้ชัดเจน', helpText: 'พูดและฟังกับเจ้าหน้าที่ศูนย์ได้ชัดทั้งสองทาง', order: 3, memberItemCodes: ['m_microphone', 'm_speaker_two_way_audio', 'm_network_voip'] },
  { key: 'center_view_camera', label: 'ศูนย์เห็นจุดถูกต้องและกล้อง/การบันทึกทำงาน', helpText: 'ยืนยันกับศูนย์ว่าเห็นตำแหน่งถูกต้อง และภาพกล้อง/การบันทึกใช้งานได้', order: 4, memberItemCodes: ['m_center_sees', 'm_camera_recording'] },
  { key: 'exterior_condition', label: 'สภาพตู้ ป้าย และฐานเสาภายนอกเรียบร้อย', helpText: 'ตรวจความเรียบร้อยของตู้ ป้ายคำแนะนำ และฐานเสาจากภายนอก', order: 5, memberItemCodes: ['m_exterior'] },
];

/**
 * Deterministic content fingerprint over EVERY authored field. Item order is the
 * array position (mirrors the `order: i + 1` used when creating the version), and
 * item label is included so a relabelled or reordered version fails verification.
 */
export function fingerprintDefinition(items: V2Item[], groups: V2Group[]): string {
  const itemPart = items
    .map((it, i) => `${i + 1}|${it.code}|${it.label}|${it.kind}|${it.criticality}|${it.criticalFunctionKey ?? ''}|photo=false`)
    .join(';');
  const groupPart = groups
    .map((g) => `${g.key}|${g.label}|${g.helpText}|${g.order}|required=true|STANDARD|NONE|${g.memberItemCodes.join(',')}`)
    .join(';');
  return `items:${itemPart}::groups:${groupPart}`;
}

export function expectedFingerprint(): string {
  return fingerprintDefinition(V2_ITEMS, V2_GROUPS);
}

export interface RolloutResult {
  versionId: string;
  created: boolean;
}

class RolloutError extends Error {}

/** Create v2 (version + items + groups + memberships) inside ONE transaction. */
async function createDraftV2Atomic(prisma: PrismaClient, templateId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const version = await tx.checklistTemplateVersion.create({
      data: {
        templateId,
        version: 2,
        status: ChecklistVersionStatus.DRAFT,
        items: {
          create: V2_ITEMS.map((it, i) => ({
            order: i + 1,
            code: it.code,
            label: it.label,
            kind: it.kind,
            criticality: it.criticality,
            criticalFunctionKey: it.criticalFunctionKey,
            requiresPhoto: false,
          })),
        },
        fieldGroups: {
          create: V2_GROUPS.map((g) => ({
            key: g.key,
            label: g.label,
            helpText: g.helpText,
            order: g.order,
            required: true,
            reasonPolicy: ChecklistReasonPolicy.STANDARD,
            photoPolicy: ChecklistPhotoPolicy.NONE,
          })),
        },
      },
      select: { id: true },
    });

    const groups = await tx.checklistFieldGroup.findMany({
      where: { checklistVersionId: version.id },
      select: { id: true, key: true },
    });
    const groupIdByKey = new Map(groups.map((g) => [g.key, g.id]));
    for (const g of V2_GROUPS) {
      const groupId = groupIdByKey.get(g.key)!;
      for (let i = 0; i < g.memberItemCodes.length; i++) {
        await tx.checklistItem.update({
          where: { versionId_code: { versionId: version.id, code: g.memberItemCodes[i] } },
          data: { fieldGroupId: groupId, memberOrder: i + 1 },
        });
      }
    }
    return version.id;
  });
}

/** Rebuild the fingerprint from what is ACTUALLY stored for a version. */
async function actualFingerprint(prisma: PrismaClient, versionId: string): Promise<string> {
  const version = await prisma.checklistTemplateVersion.findUniqueOrThrow({
    where: { id: versionId },
    select: {
      items: {
        orderBy: { order: 'asc' },
        select: { order: true, code: true, label: true, kind: true, criticality: true, criticalFunctionKey: true, requiresPhoto: true, fieldGroupId: true, memberOrder: true },
      },
      fieldGroups: {
        orderBy: { order: 'asc' },
        select: { id: true, key: true, label: true, helpText: true, order: true, required: true, reasonPolicy: true, photoPolicy: true },
      },
    },
  });

  const itemPart = version.items
    .map((it) => `${it.order}|${it.code}|${it.label}|${it.kind}|${it.criticality}|${it.criticalFunctionKey ?? ''}|photo=${it.requiresPhoto}`)
    .join(';');
  const groupPart = version.fieldGroups
    .map((g) => {
      const members = version.items
        .filter((it) => it.fieldGroupId === g.id)
        .sort((a, b) => (a.memberOrder ?? 0) - (b.memberOrder ?? 0))
        .map((it) => it.code);
      return `${g.key}|${g.label}|${g.helpText ?? ''}|${g.order}|required=${g.required}|${g.reasonPolicy}|${g.photoPolicy}|${members.join(',')}`;
    })
    .join(';');
  return `items:${itemPart}::groups:${groupPart}`;
}

/**
 * Idempotently ensure the grouped monthly v2 exists, is published, and the monthly
 * plan points at it. Never mutates a frozen version; refuses a RETIRED v2 and any
 * existing v2 (DRAFT or PUBLISHED) whose stored content does not match the exact
 * fingerprint. Requires the reference seed (template + plan) to exist.
 */
export async function rolloutMonthlyV2(prisma: PrismaClient): Promise<RolloutResult> {
  const template = await prisma.checklistTemplate.findUnique({ where: { key: 'MONTHLY_FIELD' } });
  if (!template) throw new RolloutError('Missing MONTHLY_FIELD template. Run `pnpm db:seed` first.');

  const plan = await prisma.maintenancePlan.findUnique({
    where: { kind_assetTypeKey: { kind: MaintenanceKind.MONTHLY_FIELD, assetTypeKey: ASSET_TYPE_KEY } },
  });
  if (!plan) throw new RolloutError('Missing monthly maintenance plan. Run `pnpm db:seed` first.');

  const existing = await prisma.checklistTemplateVersion.findUnique({
    where: { templateId_version: { templateId: template.id, version: 2 } },
    select: { id: true, status: true },
  });

  let versionId: string;
  let created = false;
  if (!existing) {
    versionId = await createDraftV2Atomic(prisma, template.id);
    created = true;
  } else if (existing.status === ChecklistVersionStatus.RETIRED) {
    throw new RolloutError('Monthly checklist v2 is RETIRED; refusing to resurrect it. Reset the local DB and re-run.');
  } else {
    versionId = existing.id;
    // Verify ANY existing v2 — DRAFT or PUBLISHED — against the exact content
    // fingerprint BEFORE trusting/publishing/repointing it. A drifted or tampered
    // published version is never repointed to; the operator must reset and re-run.
    const actual = await actualFingerprint(prisma, versionId);
    if (actual !== expectedFingerprint()) {
      throw new RolloutError(
        `Existing monthly v2 (status ${existing.status}) does not match the expected definition; refusing to trust or repoint it. Reset the local DB and re-run.`,
      );
    }
  }

  // publishChecklistVersion is a no-op if already PUBLISHED; validates+freezes a DRAFT.
  await publishChecklistVersion(prisma, versionId, CRITICAL_FUNCTIONS.map((c) => c.key));
  await repointPlanToVersion(prisma, plan.id, versionId);
  return { versionId, created };
}
```

- [ ] **Step 2: Implement the CLI runner** — create `prisma/checklist-v2-cli.ts` (thin; keeps the library side-effect-free and importable by tests):

```ts
// prisma/checklist-v2-cli.ts
import { PrismaClient } from '@prisma/client';
import { rolloutMonthlyV2 } from './checklist-v2';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const { versionId, created } = await rolloutMonthlyV2(prisma);
    console.log(
      `✔ Monthly checklist v2 ${created ? 'created,' : 'already present,'} published and plan repointed (version ${versionId}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('✖ checklist-v2 rollout failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 3: Write + run the DB-free fingerprint guard test** — create `prisma/checklist-v2.test.ts` (runs under `pnpm test`, proves a tampered definition would be refused):

```ts
import { describe, expect, it } from 'vitest';
import { expectedFingerprint, fingerprintDefinition, V2_ITEMS, V2_GROUPS } from './checklist-v2';

describe('checklist-v2 fingerprint guard', () => {
  it('is deterministic for the canonical definition', () => {
    expect(expectedFingerprint()).toBe(fingerprintDefinition(V2_ITEMS, V2_GROUPS));
  });

  it('differs when any item field is tampered (a mismatched version would be refused)', () => {
    const tampered = V2_ITEMS.map((it, i) => (i === 0 ? { ...it, criticalFunctionKey: 'WRONG' } : it));
    expect(fingerprintDefinition(tampered, V2_GROUPS)).not.toBe(expectedFingerprint());
  });

  it('differs when an item LABEL is tampered', () => {
    const tampered = V2_ITEMS.map((it, i) => (i === 0 ? { ...it, label: 'DRIFTED' } : it));
    expect(fingerprintDefinition(tampered, V2_GROUPS)).not.toBe(expectedFingerprint());
  });

  it('differs when item ORDER changes (first two items swapped)', () => {
    const reordered = [V2_ITEMS[1], V2_ITEMS[0], ...V2_ITEMS.slice(2)];
    expect(fingerprintDefinition(reordered, V2_GROUPS)).not.toBe(expectedFingerprint());
  });

  it('differs when a group membership is tampered', () => {
    const tampered = V2_GROUPS.map((g, i) => (i === 0 ? { ...g, memberItemCodes: [...g.memberItemCodes, 'm_note'] } : g));
    expect(fingerprintDefinition(V2_ITEMS, tampered)).not.toBe(expectedFingerprint());
  });

  it('has m_note ungrouped and no duplicate membership across groups', () => {
    const memberCodes = V2_GROUPS.flatMap((g) => g.memberItemCodes);
    expect(memberCodes).not.toContain('m_note');
    expect(new Set(memberCodes).size).toBe(memberCodes.length);
  });
});
```

Run: `pnpm test -- prisma/checklist-v2.test.ts` → GREEN, exit 0.

- [ ] **Step 4: Wire the scripts** — in `package.json` `"scripts"`, add `db:checklist:v2` (pointing at the CLI wrapper) after `db:seed:demo`, and append it to `db:setup`:

```json
    "db:seed:demo": "tsx prisma/seed-demo.ts",
    "db:checklist:v2": "tsx prisma/checklist-v2-cli.ts",
```

```json
    "db:setup": "prisma migrate deploy && pnpm db:postgis && pnpm db:seed && pnpm db:checklist:v2",
```

- [ ] **Step 5: Bump the demo work-order code** — in `prisma/demo-fixture.ts`, change the constant so a fresh demo pins the grouped v2 (idempotency and "never mutate an existing WO" are unchanged):

```ts
export const DEMO_WORK_ORDER_CODE = 'DEMO-LOCAL-EP01-MONTHLY-V2';
```

- [ ] **Step 6: Run the rollout on the local DB** — in the **DB shell** (`DATABASE_URL` + `NODE_ENV=development` only; `AUTH_MODE`/`AUTH_DEV_BYPASS` unset; never echo the connection string), with the local `sos` DB migrated + seeded, run `pnpm db:checklist:v2` twice. Expected: first run prints `✔ Monthly checklist v2 created, published and plan repointed …`; second run prints `✔ Monthly checklist v2 already present, published and plan repointed …` (idempotent — no duplicate v2, plan already repointed). Confirm in `pnpm db:studio` that the monthly plan's `checklistVersionId` points at version 2, and version 2 has 5 `checklist_field_group` rows and 10 items with memberships. (Atomic creation, RETIRED refusal, and exact-fingerprint verification of ANY existing v2 — DRAFT or PUBLISHED — before repoint are asserted by `prisma/checklist-v2.itest.ts` in Task 13.)
- [ ] **Step 7: Static gates** — `pnpm typecheck` → exit 0; `pnpm lint` → exit 0; `pnpm test -- prisma/checklist-v2.test.ts` → GREEN; `git diff --check` → clean.
- [ ] **Step 8: Commit**

```
git add prisma/checklist-v2.ts prisma/checklist-v2-cli.ts prisma/checklist-v2.test.ts package.json prisma/demo-fixture.ts
git commit -m "feat(db): grouped monthly checklist v2 rollout (atomic, fingerprint-guarded)

Demo work order now pins the grouped v2 (DEMO-LOCAL-EP01-MONTHLY-V2).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: UI — grouped accessible `/today` field workspace

**Files:**
- Modify: `src/components/TodayWorkspace.tsx`

Group/member text comes straight from the bootstrap (versioned data). Only outcomes, member states, work-order kind/status route through the Thai mapper. No item kind, no criticality asterisk, no `PASS/FAIL/NA/UNKNOWN`, no "Checklist"/GPS/VoIP jargon on screen.

- [ ] **Step 1: Rewrite the component** — replace `src/components/TodayWorkspace.tsx` with:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  HelpCircleIcon,
  MapPinIcon,
  RefreshIcon,
} from '@/components/icons';
import {
  groupOutcomeLabel,
  memberStateLabel,
  workOrderKindLabel,
  workOrderStatusLabel,
  type GroupOutcome,
  type MemberState,
} from '@/presentation/thai-labels';

interface SyncFieldGroupMember {
  memberKey: string;
  label: string;
}
interface SyncFieldGroup {
  key: string;
  label: string;
  help: string | null;
  order: number;
  required: boolean;
  reasonPolicy: string;
  photoPolicy: string;
  members: SyncFieldGroupMember[];
}
interface SyncWorkOrder {
  id: string;
  code: string;
  kind: string;
  status: string;
  dueAt: string | null;
  scheduledFor: string | null;
  asset: { code: string; name: string; latitude: number; longitude: number };
  groups: SyncFieldGroup[];
}
interface SyncBootstrap {
  generatedAt: string;
  workOrders: SyncWorkOrder[];
}
interface ApiErrorBody {
  message?: string;
  error?: string;
}

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: 'bg-unknown-tint text-unknown-ink',
  ASSIGNED: 'bg-watch-tint text-watch-ink',
  IN_PROGRESS: 'bg-watch-tint text-watch-ink',
  SUBMITTED: 'bg-watch-tint text-watch-ink',
  REOPENED: 'bg-down-tint text-down-ink',
};

const OUTCOMES: readonly {
  value: GroupOutcome;
  Icon: (p: { size?: number }) => React.ReactElement;
}[] = [
  { value: 'NORMAL', Icon: CheckCircleIcon },
  { value: 'PROBLEM', Icon: AlertTriangleIcon },
  { value: 'UNTESTABLE', Icon: HelpCircleIcon },
];

const MEMBER_STATES: readonly MemberState[] = ['OK', 'PROBLEM', 'UNTESTED'];

interface GroupAnswer {
  outcome?: GroupOutcome;
  members: Record<string, MemberState>;
  note: string;
  reason: string;
}

function emptyAnswer(): GroupAnswer {
  return { members: {}, note: '', reason: '' };
}

function formatThaiDate(value: string | null): string {
  if (!value) return 'ไม่กำหนด';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'วันที่ไม่ถูกต้อง';
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? `คำขอไม่สำเร็จ (${response.status})`,
    );
  }
  return body as T;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return readJson<T>(await fetch(url, init));
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getDeviceId(): string {
  const key = 'sos-maintenance-device-id';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error('อ่านตำแหน่งไม่สำเร็จ — อนุญาตตำแหน่งแล้วลองใหม่')),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

async function loadBootstrap(): Promise<SyncBootstrap> {
  return requestJson<SyncBootstrap>('/api/sync/bootstrap', { cache: 'no-store' });
}

function EmptyWorkOrders() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-unknown-tint text-unknown-ink">
        <HelpCircleIcon size={22} />
      </span>
      <p className="font-semibold text-ink">ยังไม่มีใบงานที่เปิดอยู่</p>
      <p className="max-w-[34ch] text-xs leading-relaxed text-muted">
        ระบบแสดงข้อมูลจริงจากใบงานที่มอบหมายหรือกำลังดำเนินการ เมื่อมีใบงานแล้วจะปรากฏที่นี่
      </p>
    </div>
  );
}

function groupComplete(group: SyncFieldGroup, answer: GroupAnswer): boolean {
  if (!answer.outcome) return !group.required;
  if (answer.outcome === 'PROBLEM') {
    const hasProblem = Object.values(answer.members).some((s) => s === 'PROBLEM');
    return hasProblem && answer.note.trim().length > 0;
  }
  if (answer.outcome === 'UNTESTABLE') return answer.reason.trim().length > 0;
  return true; // NORMAL
}

function InspectionForm({
  workOrder,
  online,
  onChanged,
}: {
  workOrder: SyncWorkOrder;
  online: boolean;
  onChanged: () => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<string, GroupAnswer>>({});
  const [generalNote, setGeneralNote] = useState('');
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = useMemo(
    () => workOrder.groups.filter((g) => !groupComplete(g, answers[g.key] ?? emptyAnswer())).length,
    [answers, workOrder.groups],
  );

  function update(groupKey: string, patch: Partial<GroupAnswer>) {
    setAnswers((cur) => ({ ...cur, [groupKey]: { ...emptyAnswer(), ...cur[groupKey], ...patch } }));
  }

  function setMember(groupKey: string, memberKey: string, state: MemberState) {
    setAnswers((cur) => {
      const a = { ...emptyAnswer(), ...cur[groupKey] };
      a.members = { ...a.members, [memberKey]: state };
      return { ...cur, [groupKey]: a };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || remaining > 0 || working) return;
    setWorking(true);
    setError(null);
    const currentMutationId = mutationId ?? crypto.randomUUID();
    if (!mutationId) setMutationId(currentMutationId);

    try {
      const gps = await getCurrentPosition();
      const groups = workOrder.groups.map((g) => {
        const a = answers[g.key] ?? emptyAnswer();
        if (a.outcome === 'PROBLEM') {
          return {
            groupKey: g.key,
            outcome: 'PROBLEM' as const,
            members: g.members.map((m) => ({ memberKey: m.memberKey, state: a.members[m.memberKey] ?? 'UNTESTED' })),
            note: a.note,
          };
        }
        if (a.outcome === 'UNTESTABLE') {
          return { groupKey: g.key, outcome: 'UNTESTABLE' as const, reason: a.reason };
        }
        return { groupKey: g.key, outcome: 'NORMAL' as const };
      });
      const payload = {
        workOrderId: workOrder.id,
        groups,
        ...(generalNote.trim() ? { generalNote: generalNote.trim() } : {}),
        gps,
      };
      const envelope = {
        mutationId: currentMutationId,
        deviceId: getDeviceId(),
        entity: 'checklist_response',
        action: 'create',
        baseVersion: null,
        clientOccurredAt: new Date().toISOString(),
        payloadChecksum: await sha256(JSON.stringify(payload)),
        payload,
      };

      await requestJson('/api/inspections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      await requestJson(`/api/work-orders/${encodeURIComponent(workOrder.code)}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'SUBMITTED' }),
      });
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ส่งผลตรวจไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t border-border pt-4">
      <div className="flex items-start gap-2 text-xs text-muted">
        <MapPinIcon size={16} />
        <p>เมื่อส่งผลตรวจ ระบบจะบันทึกตำแหน่งที่จุดตรวจโดยอัตโนมัติ</p>
      </div>

      <div className="mt-4 space-y-4">
        {workOrder.groups.map((group) => {
          const answer = answers[group.key] ?? emptyAnswer();
          return (
            <fieldset key={group.key} className="rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-semibold text-ink">{group.label}</legend>
              {group.help ? (
                <p id={`help-${group.key}`} className="px-1 text-xs text-muted">{group.help}</p>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={group.label} aria-describedby={group.help ? `help-${group.key}` : undefined}>
                {OUTCOMES.map(({ value, Icon }) => {
                  const selected = answer.outcome === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update(group.key, { outcome: value })}
                      className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium ${selected ? 'border-brand bg-brand/10 text-brand' : 'border-border-strong bg-bg text-ink'}`}
                    >
                      <Icon size={18} />
                      {groupOutcomeLabel(value)}
                    </button>
                  );
                })}
              </div>

              {answer.outcome === 'PROBLEM' ? (
                <div className="mt-3 space-y-3 border-t border-border pt-3" aria-expanded="true">
                  {group.members.map((member) => (
                    <div key={member.memberKey}>
                      <p className="text-xs text-ink">{member.label}</p>
                      <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label={member.label}>
                        {MEMBER_STATES.map((state) => {
                          const selected = answer.members[member.memberKey] === state;
                          return (
                            <button
                              key={state}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setMember(group.key, member.memberKey, state)}
                              className={`min-h-11 rounded-lg border px-2 text-xs font-medium ${selected ? 'border-brand bg-brand/10 text-brand' : 'border-border-strong bg-bg text-ink'}`}
                            >
                              {memberStateLabel(state)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <label className="block text-xs text-ink" htmlFor={`note-${group.key}`}>
                    อาการที่พบ (จำเป็น)
                    <textarea
                      id={`note-${group.key}`}
                      value={answer.note}
                      onChange={(e) => update(group.key, { note: e.target.value })}
                      required
                      rows={2}
                      className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  {!groupComplete(group, answer) ? (
                    <p role="alert" className="text-xs text-down-ink">เลือกอย่างน้อยหนึ่งรายการที่มีปัญหา และระบุอาการ</p>
                  ) : null}
                </div>
              ) : null}

              {answer.outcome === 'UNTESTABLE' ? (
                <div className="mt-3 border-t border-border pt-3">
                  <label className="block text-xs text-ink" htmlFor={`reason-${group.key}`}>
                    เหตุผลที่ตรวจไม่ได้ (จำเป็น)
                    <textarea
                      id={`reason-${group.key}`}
                      value={answer.reason}
                      onChange={(e) => update(group.key, { reason: e.target.value })}
                      required
                      rows={2}
                      className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  {!groupComplete(group, answer) ? (
                    <p role="alert" className="text-xs text-down-ink">กรุณาระบุเหตุผล</p>
                  ) : null}
                </div>
              ) : null}
            </fieldset>
          );
        })}

        <label className="block text-xs text-ink" htmlFor={`general-${workOrder.code}`}>
          หมายเหตุเพิ่มเติม (ถ้ามี)
          <textarea
            id={`general-${workOrder.code}`}
            value={generalNote}
            onChange={(e) => setGeneralNote(e.target.value)}
            rows={2}
            className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
          />
        </label>
      </div>

      {error ? <p role="alert" className="mt-3 rounded-xl bg-down-tint px-3 py-3 text-xs text-down-ink">{error}</p> : null}
      {!online ? <p className="mt-3 text-xs text-watch-ink">ออฟไลน์ — เชื่อมต่ออินเทอร์เน็ตก่อนส่งผลตรวจ</p> : null}
      <button
        type="submit"
        disabled={!online || remaining > 0 || working}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircleIcon size={18} />
        {working ? 'กำลังบันทึกผลตรวจ…' : remaining > 0 ? `ตอบให้ครบอีก ${remaining} กลุ่ม` : 'ส่งผลตรวจ'}
      </button>
    </form>
  );
}

function WorkOrderCard({
  workOrder,
  online,
  onChanged,
}: {
  workOrder: SyncWorkOrder;
  online: boolean;
  onChanged: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusClass = STATUS_STYLE[workOrder.status] ?? 'bg-unknown-tint text-unknown-ink';
  const canStart = ['ASSIGNED', 'REOPENED'].includes(workOrder.status);
  const hasGroups = workOrder.groups.length > 0;

  async function start() {
    if (!online || working) return;
    setWorking(true);
    setError(null);
    try {
      await requestJson(`/api/work-orders/${encodeURIComponent(workOrder.code)}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'IN_PROGRESS' }),
      });
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เริ่มงานไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm" aria-labelledby={`work-order-${workOrder.code}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{workOrderKindLabel(workOrder.kind)}</p>
          <h3 id={`work-order-${workOrder.code}`} className="mt-1 font-semibold text-ink">{workOrder.code}</h3>
          <p className="mt-1 text-sm text-brand">{workOrder.asset.code} · {workOrder.asset.name}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
          <ClockIcon size={14} />
          {workOrderStatusLabel(workOrder.status)}
        </span>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted">
        <p><span className="block text-[0.6875rem] text-muted">กำหนดตรวจ</span><span className="mt-1 block text-ink">{formatThaiDate(workOrder.scheduledFor ?? workOrder.dueAt)}</span></p>
        <p><span className="block text-[0.6875rem] text-muted">กลุ่มตรวจ</span><span className="mt-1 block text-ink">{workOrder.groups.length} กลุ่ม</span></p>
      </div>

      {!hasGroups ? (
        <p role="alert" className="mt-4 rounded-xl bg-watch-tint px-3 py-3 text-xs text-watch-ink">
          ใบงานนี้ผูกกับเวอร์ชันเดิมที่ยังไม่มีกลุ่มภาคสนาม กรุณาให้ผู้วางแผนออกใบงานใหม่ภายใต้เวอร์ชันปัจจุบัน
        </p>
      ) : (
        <>
          {canStart ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={!online || working}
              className="mt-4 min-h-11 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? 'กำลังเริ่มงาน…' : 'เริ่มงาน'}
            </button>
          ) : null}
          {workOrder.status === 'PUBLISHED' ? <p className="mt-4 text-xs text-muted">รอผู้วางแผนมอบหมายก่อนเริ่มงาน</p> : null}
          {workOrder.status === 'SUBMITTED' ? <p className="mt-4 text-xs text-muted">ส่งผลตรวจแล้ว รอผู้วางแผนตรวจรับ</p> : null}
          {workOrder.status === 'IN_PROGRESS' ? <InspectionForm workOrder={workOrder} online={online} onChanged={onChanged} /> : null}
        </>
      )}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-down-tint px-3 py-3 text-xs text-down-ink">{error}</p> : null}
    </article>
  );
}

export function TodayWorkspace() {
  const [bootstrap, setBootstrap] = useState<SyncBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBootstrap(await loadBootstrap());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดใบงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [refresh]);

  return (
    <section id="today-workspace" className="mt-6" aria-labelledby="today-workspace-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="today-workspace-title" className="px-1 text-sm font-semibold text-ink">ใบงานภาคสนาม</h2>
          <p className="mt-1 px-1 text-xs text-muted">
            {bootstrap ? `ข้อมูลล่าสุด ${formatThaiDate(bootstrap.generatedAt)} · ${bootstrap.workOrders.length} ใบงาน` : 'กำลังโหลดข้อมูลจากระบบ'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || !online}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 text-xs font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshIcon size={16} />
          โหลดล่าสุด
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {loading && !bootstrap ? <p role="status" className="rounded-2xl border border-border bg-surface px-5 py-10 text-center text-sm text-muted">กำลังโหลดใบงาน…</p> : null}
        {error ? (
          <div className="rounded-2xl border border-border bg-surface px-5 py-10 text-center">
            <p role="alert" className="text-sm text-down-ink">{error}</p>
            <button type="button" onClick={() => void refresh()} className="mt-4 min-h-10 rounded-xl bg-brand px-4 text-xs font-semibold text-white">ลองโหลดใหม่</button>
          </div>
        ) : null}
        {!loading && !error && bootstrap?.workOrders.length === 0 ? <EmptyWorkOrders /> : null}
        {bootstrap?.workOrders.map((workOrder) => (
          <WorkOrderCard key={workOrder.id} workOrder={workOrder} online={online} onChanged={refresh} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Static gates** — `pnpm typecheck` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0 (the UI no longer references `.checklist`/`item.kind`).
- [ ] **Step 3: Commit**

```
git add src/components/TodayWorkspace.tsx
git commit -m "feat(ui): grouped accessible /today field workspace (outcomes, no enum leakage)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Integration tests (real Postgres)

**Files:**
- Rewrite: `src/app/api/sync/bootstrap/route.itest.ts`
- Rewrite: `src/app/api/inspections/route.itest.ts`
- Create: `src/server/services/checklist-version.itest.ts`
- Create: `prisma/checklist-v2.itest.ts`

Precondition: local `sos` PostGIS migrated (Task 4), run in the **DB / integration shell** — `DATABASE_URL` set, and `AUTH_MODE` / `AUTH_DEV_BYPASS` **unset** so the tests' own `AUTH_DEV_BYPASS='true'` (set in each `beforeAll`) governs auth and the 401/403 assertions are not masked by an internal session. The HTTP-slice tests build self-contained fixtures with their own versions/groups (never touching owner-visible data); `prisma/checklist-v2.itest.ts` exercises the real `rolloutMonthlyV2` against the seeded monthly template/plan and is idempotent.

#### Task 13.1: Bootstrap grouped shape

- [ ] **Step 1: Rewrite** `src/app/api/sync/bootstrap/route.itest.ts` — build a version with one field group + membership + a critical item, and assert the grouped, leak-free shape:

```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let userId: string;
let assetTypeId: string;
let locationId: string;
let assetId: string;
let templateId: string;
let versionId: string;
let groupId: string;
let workOrderId: string;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const user = await prisma.user.create({ data: { username: `tech_${suffix}`, displayName: 'ช่างทดสอบ', roles: ['TECHNICIAN'] } });
  userId = user.id;
  const at = await prisma.assetType.create({ data: { key: `SOS_SB_${suffix}`, name: 'sb' } });
  assetTypeId = at.id;
  const loc = await prisma.location.create({ data: { code: `LOCSB_${suffix}`, name: 'sb', longitude: 100.1, latitude: 15.7 } });
  locationId = loc.id;
  const asset = await prisma.asset.create({ data: { code: `EPSB_${suffix}`, name: 'sb', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_sb_${suffix}`, lifecycle: 'ACTIVE' } });
  assetId = asset.id;
  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: { create: { key: `TPL_SB_${suffix}`, name: 'sb', kind: 'MONTHLY_FIELD' } },
      version: 1,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      isLocked: true,
      items: {
        create: [
          { order: 1, code: 'sb_sos', label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
          { order: 2, code: 'sb_note', label: 'หมายเหตุ', kind: 'TEXT', criticality: 'NON_CRITICAL' },
        ],
      },
    },
  });
  versionId = version.id;
  templateId = version.templateId;
  const group = await prisma.checklistFieldGroup.create({
    data: { checklistVersionId: versionId, key: 'g_sos', label: 'กดปุ่ม SOS แล้วมีไฟและเสียง', order: 1, required: true },
  });
  groupId = group.id;
  await prisma.checklistItem.update({ where: { versionId_code: { versionId, code: 'sb_sos' } }, data: { fieldGroupId: groupId, memberOrder: 1 } });
  const wo = await prisma.workOrder.create({ data: { code: `WO-SB-${suffix}`, kind: 'MONTHLY_FIELD', assetId, checklistVersionId: versionId, status: 'ASSIGNED' } });
  workOrderId = wo.id;
  await prisma.assignment.create({ data: { workOrderId, userId } });
});

afterAll(async () => {
  await prisma.assignment.deleteMany({ where: { workOrderId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistFieldGroup.deleteMany({ where: { checklistVersionId: versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

function get(user?: string): Request {
  const headers: Record<string, string> = { 'x-dev-roles': 'TECHNICIAN' };
  if (user) headers['x-dev-user'] = user;
  return new Request('http://local/api/sync/bootstrap', { headers });
}

describe('GET /api/sync/bootstrap (grouped)', () => {
  it('401 without a session', async () => {
    const res = await GET(new Request('http://local/api/sync/bootstrap'));
    expect(res.status).toBe(401);
  });

  it('returns grouped structure with no kind/criticality/function leakage', async () => {
    const res = await GET(get(userId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workOrders).toHaveLength(1);
    const wo = body.workOrders[0];
    expect(wo.groups).toHaveLength(1);
    expect(wo.groups[0].label).toBe('กดปุ่ม SOS แล้วมีไฟและเสียง');
    expect(wo.groups[0].members[0].memberKey).toBe('sb_sos');
    expect(wo.groups[0].members[0].label).toBe('ปุ่ม SOS');
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('criticalFunctionKey');
    expect(raw).not.toContain('CRITICAL');
    expect(raw).not.toContain('BOOLEAN_PASS_FAIL');
    expect(wo).not.toHaveProperty('checklist');
  });
});
```

- [ ] **Step 2: Run** — `pnpm test:integration -- src/app/api/sync/bootstrap/route.itest.ts` → GREEN, 2+ tests, exit 0.

#### Task 13.2: Field submit expansion + notes + idempotency + readiness

- [ ] **Step 3: Rewrite** `src/app/api/inspections/route.itest.ts` — fixture with two field groups (one critical → `sos_button`) + a note item + asset critical component, posting group outcomes:

```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const LAT = 15.7;
const LNG = 100.12;

let assetTypeId: string;
let locationId: string;
let assetId: string;
let templateId: string;
let versionId: string;
let groupId: string;
let workOrderId: string;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const assetType = await prisma.assetType.create({ data: { key: `SOS_POLE_API_${suffix}`, name: 'api-test' } });
  assetTypeId = assetType.id;
  const location = await prisma.location.create({ data: { code: `LOCAPI_${suffix}`, name: 'จุด', longitude: LNG, latitude: LAT } });
  locationId = location.id;
  const asset = await prisma.asset.create({
    data: {
      code: `EPAPI_${suffix}`, name: 'เสา api', assetTypeId, locationId, longitude: LNG, latitude: LAT,
      qrToken: `qr_api_${suffix}`, lifecycle: 'ACTIVE', baselineApproved: true, currentReadiness: 'UNKNOWN',
      components: { create: [{ key: 'sos_button', name: 'ปุ่ม SOS', criticality: 'CRITICAL' }] },
    },
  });
  assetId = asset.id;
  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: { create: { key: `TPL_API_${suffix}`, name: 'tpl', kind: 'MONTHLY_FIELD' } },
      version: 1, status: 'PUBLISHED', publishedAt: new Date(), isLocked: true,
      items: {
        create: [
          { order: 1, code: 'it_sos', label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
          { order: 2, code: 'it_note', label: 'หมายเหตุ', kind: 'TEXT', criticality: 'NON_CRITICAL' },
        ],
      },
    },
  });
  versionId = version.id;
  templateId = version.templateId;
  const group = await prisma.checklistFieldGroup.create({ data: { checklistVersionId: versionId, key: 'g_sos', label: 'กดปุ่ม SOS', order: 1, required: true } });
  groupId = group.id;
  await prisma.checklistItem.update({ where: { versionId_code: { versionId, code: 'it_sos' } }, data: { fieldGroupId: groupId, memberOrder: 1 } });
  const wo = await prisma.workOrder.create({ data: { code: `WO-API-${suffix}`, kind: 'MONTHLY_FIELD', assetId, checklistVersionId: versionId, status: 'IN_PROGRESS' } });
  workOrderId = wo.id;
});

afterAll(async () => {
  await prisma.checklistResponse.deleteMany({ where: { workOrderId } });
  await prisma.readinessSnapshot.deleteMany({ where: { assetId } });
  await prisma.fault.deleteMany({ where: { assetId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistFieldGroup.deleteMany({ where: { checklistVersionId: versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.assetComponent.deleteMany({ where: { assetId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function envelope(payload: unknown) {
  return {
    mutationId: randomUUID(), deviceId: `dev_${suffix}`, entity: 'checklist_response',
    action: 'create', baseVersion: null, clientOccurredAt: new Date().toISOString(),
    payloadChecksum: 'sum', payload,
  };
}
function post(body: unknown, roles = 'TECHNICIAN'): Promise<Response> {
  return POST(new Request('http://local/api/inspections', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dev-roles': roles, 'x-dev-user': 'tech1' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/inspections (grouped)', () => {
  it('401 when unauthenticated', async () => {
    const res = await POST(new Request('http://local/api/inspections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'NORMAL' }], gps: { lat: LAT, lng: LNG } })) }));
    expect(res.status).toBe(401);
  });

  it('403 when role lacks workorder:submit', async () => {
    const res = await post(envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'NORMAL' }], gps: { lat: LAT, lng: LNG } }), 'EXECUTIVE');
    expect(res.status).toBe(403);
  });

  it('400 on an empty groups array', async () => {
    const res = await post(envelope({ workOrderId, groups: [], gps: { lat: LAT, lng: LNG } }));
    expect(res.status).toBe(400);
  });

  it('NORMAL → READY, expands to per-item responses + note, idempotent replay', async () => {
    const body = envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'NORMAL' }], generalNote: 'ปกติดี', gps: { lat: LAT, lng: LNG } });
    const first = await post(body);
    expect(first.status).toBe(201);
    expect((await first.json()).readiness.status).toBe('READY');

    const responses = await prisma.checklistResponse.findMany({ where: { workOrderId }, include: { item: true } });
    const sos = responses.find((r) => r.item.code === 'it_sos')!;
    const note = responses.find((r) => r.item.code === 'it_note')!;
    expect(sos.result).toBe('PASS');
    expect(note.result).toBe('NA');
    expect(note.note).toBe('ปกติดี');

    const replay = await post(body);
    expect(replay.status).toBe(200);
    expect((await replay.json()).idempotentReplay).toBe(true);
    expect(await prisma.checklistResponse.count({ where: { workOrderId, item: { code: 'it_sos' } } })).toBe(1);
  });

  it('PROBLEM on a critical member → DOWN + fault; UNTESTABLE → not READY', async () => {
    // Fresh work order state each assertion via a new mutationId; asset readiness is recomputed.
    const down = await post(envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'PROBLEM', members: [{ memberKey: 'it_sos', state: 'PROBLEM' }], note: 'ปุ่มไม่ทำงาน' }], gps: { lat: LAT, lng: LNG } }));
    expect(down.status).toBe(201);
    const downJson = await down.json();
    expect(downJson.readiness.status).toBe('DOWN');
    expect(downJson.faults.some((f: { severity: string }) => f.severity === 'CRITICAL')).toBe(true);

    const untestable = await post(envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'UNTESTABLE', reason: 'เข้าพื้นที่ไม่ได้' }], gps: { lat: LAT, lng: LNG } }));
    expect(untestable.status).toBe(201);
    expect((await untestable.json()).readiness.status).not.toBe('READY');
  });
});
```

- [ ] **Step 4: Run** — `pnpm test:integration -- src/app/api/inspections/route.itest.ts` → GREEN, exit 0.

#### Task 13.3: Checklist-version service — publish/repoint/retire, kind-mismatch, pinning

- [ ] **Step 5: Create** `src/server/services/checklist-version.itest.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChecklistVersionError,
  publishChecklistVersion,
  repointPlanToVersion,
  retireChecklistVersion,
} from './checklist-version';
import { getSyncBootstrap } from '../queries/sync';

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const REQUIRED = ['sos_button'];

let templateId: string;
let v1Id: string;
let v2Id: string;
let planId: string;
let assetTypeId: string;
let locationId: string;
let assetId: string;
let workOrderId: string;
let weeklyTemplateId: string;
let weeklyVersionId: string;

async function makeVersion(version: number): Promise<string> {
  const v = await prisma.checklistTemplateVersion.create({
    data: {
      templateId, version, status: 'DRAFT',
      items: { create: [{ order: 1, code: `sos_${version}`, label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' }] },
      fieldGroups: { create: [{ key: 'g_sos', label: 'กดปุ่ม SOS', order: 1, required: true }] },
    },
    select: { id: true, fieldGroups: { select: { id: true } } },
  });
  await prisma.checklistItem.update({ where: { versionId_code: { versionId: v.id, code: `sos_${version}` } }, data: { fieldGroupId: v.fieldGroups[0].id, memberOrder: 1 } });
  return v.id;
}

beforeAll(async () => {
  const t = await prisma.checklistTemplate.create({ data: { key: `TPL_CV_${suffix}`, name: 'cv', kind: 'MONTHLY_FIELD' } });
  templateId = t.id;
  v1Id = await makeVersion(1);
  v2Id = await makeVersion(2);
  await publishChecklistVersion(prisma, v1Id, REQUIRED);
  const plan = await prisma.maintenancePlan.create({ data: { name: 'cv-plan', kind: 'MONTHLY_FIELD', frequency: 'MONTHLY', assetTypeKey: `CV_${suffix}`, checklistVersionId: v1Id } });
  planId = plan.id;
  const at = await prisma.assetType.create({ data: { key: `CVAT_${suffix}`, name: 'cv' } });
  assetTypeId = at.id;
  const loc = await prisma.location.create({ data: { code: `CVLOC_${suffix}`, name: 'cv', longitude: 100.1, latitude: 15.7 } });
  locationId = loc.id;
  const asset = await prisma.asset.create({ data: { code: `CVEP_${suffix}`, name: 'cv', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_cv_${suffix}`, lifecycle: 'ACTIVE' } });
  assetId = asset.id;
  const wo = await prisma.workOrder.create({ data: { code: `WO-CV-${suffix}`, kind: 'MONTHLY_FIELD', assetId, planId, checklistVersionId: v1Id, status: 'ASSIGNED' } });
  workOrderId = wo.id;

  // A published WEEKLY version (different template kind) for the kind-mismatch test.
  const wt = await prisma.checklistTemplate.create({ data: { key: `TPL_WK_${suffix}`, name: 'wk', kind: 'WEEKLY_CENTER' } });
  weeklyTemplateId = wt.id;
  const wv = await prisma.checklistTemplateVersion.create({
    data: {
      templateId: weeklyTemplateId, version: 1, status: 'DRAFT',
      items: { create: [{ order: 1, code: `w_sos_${suffix}`, label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' }] },
      fieldGroups: { create: [{ key: 'g_wsos', label: 'กดปุ่ม SOS', order: 1, required: true }] },
    },
    select: { id: true, fieldGroups: { select: { id: true } } },
  });
  weeklyVersionId = wv.id;
  await prisma.checklistItem.update({ where: { versionId_code: { versionId: weeklyVersionId, code: `w_sos_${suffix}` } }, data: { fieldGroupId: wv.fieldGroups[0].id, memberOrder: 1 } });
  await publishChecklistVersion(prisma, weeklyVersionId, REQUIRED);
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.maintenancePlan.deleteMany({ where: { id: planId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.checklistItem.deleteMany({ where: { versionId: { in: [v1Id, v2Id, weeklyVersionId] } } });
  await prisma.checklistFieldGroup.deleteMany({ where: { checklistVersionId: { in: [v1Id, v2Id, weeklyVersionId] } } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: { in: [v1Id, v2Id, weeklyVersionId] } } });
  await prisma.checklistTemplate.deleteMany({ where: { id: { in: [templateId, weeklyTemplateId] } } });
  await prisma.$disconnect();
});

describe('checklist-version lifecycle', () => {
  it('repoint rejects a DRAFT (not-published) version', async () => {
    await expect(repointPlanToVersion(prisma, planId, v2Id)).rejects.toBeInstanceOf(ChecklistVersionError);
  });

  it('publishing v2 freezes it and then allows repoint; the pinned work order keeps v1 groups', async () => {
    await publishChecklistVersion(prisma, v2Id, REQUIRED);
    const v2 = await prisma.checklistTemplateVersion.findUniqueOrThrow({ where: { id: v2Id } });
    expect(v2.status).toBe('PUBLISHED');
    expect(v2.isLocked).toBe(true);

    await repointPlanToVersion(prisma, planId, v2Id);
    const plan = await prisma.maintenancePlan.findUniqueOrThrow({ where: { id: planId } });
    expect(plan.checklistVersionId).toBe(v2Id);

    // Version pinning: the existing work order still shows v1's groups (its pinned version).
    const boot = await getSyncBootstrap(null, new Date(), prisma);
    const wo = boot.workOrders.find((w) => w.code === `WO-CV-${suffix}`)!;
    expect(wo.groups[0].members[0].memberKey).toBe('sos_1');
  });

  it('repoint rejects a published version whose template kind differs from the plan', async () => {
    // The monthly plan must never point at a WEEKLY version, even though it is published.
    let err: unknown;
    try { await repointPlanToVersion(prisma, planId, weeklyVersionId); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ChecklistVersionError);
    expect((err as ChecklistVersionError).code).toBe('KIND_MISMATCH');
    const plan = await prisma.maintenancePlan.findUniqueOrThrow({ where: { id: planId } });
    expect(plan.checklistVersionId).toBe(v2Id); // unchanged
  });

  it('retire is blocked while an active plan references the version, then succeeds', async () => {
    await expect(retireChecklistVersion(prisma, v2Id)).rejects.toBeInstanceOf(ChecklistVersionError);
    await prisma.maintenancePlan.update({ where: { id: planId }, data: { active: false } });
    await retireChecklistVersion(prisma, v2Id);
    const v2 = await prisma.checklistTemplateVersion.findUniqueOrThrow({ where: { id: v2Id } });
    expect(v2.status).toBe('RETIRED');
    expect(v2.retiredAt).not.toBeNull();
  });

  it('publishing a RETIRED version is refused (never resurrected)', async () => {
    let err: unknown;
    try { await publishChecklistVersion(prisma, v2Id, REQUIRED); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ChecklistVersionError);
    expect((err as ChecklistVersionError).code).toBe('VERSION_RETIRED');
    const v2 = await prisma.checklistTemplateVersion.findUniqueOrThrow({ where: { id: v2Id } });
    expect(v2.status).toBe('RETIRED'); // unchanged
  });
});
```

- [ ] **Step 6: Run** — `pnpm test:integration -- src/server/services/checklist-version.itest.ts` → GREEN, exit 0.

- [ ] **Step 7: Create the rollout idempotency integration test** — `prisma/checklist-v2.itest.ts` (asserts a single PUBLISHED v2, atomic content, and the monthly plan repointed; idempotent and safe to run against the `db:setup` steady state):

```ts
// prisma/checklist-v2.itest.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { rolloutMonthlyV2 } from './checklist-v2';

/**
 * Integration proof that rolloutMonthlyV2 is safe + idempotent against the seeded
 * monthly template/plan. PRECONDITION: `pnpm db:setup` has run (CI's integration
 * job does this). This test never fabricates reference data; it fails clearly if
 * the seed is absent.
 */
const prisma = new PrismaClient();

beforeAll(async () => {
  const template = await prisma.checklistTemplate.findUnique({ where: { key: 'MONTHLY_FIELD' } });
  if (!template) throw new Error('Seed missing: run `pnpm db:setup` before this integration test.');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('rolloutMonthlyV2 (integration)', () => {
  it('is idempotent: exactly one PUBLISHED v2 with 5 groups / 10 items, plan repointed', async () => {
    const first = await rolloutMonthlyV2(prisma);
    const second = await rolloutMonthlyV2(prisma);
    expect(second.created).toBe(false);
    expect(second.versionId).toBe(first.versionId);

    const template = await prisma.checklistTemplate.findUniqueOrThrow({ where: { key: 'MONTHLY_FIELD' } });
    const versions = await prisma.checklistTemplateVersion.findMany({ where: { templateId: template.id, version: 2 } });
    expect(versions).toHaveLength(1);
    expect(versions[0].status).toBe('PUBLISHED');

    const v2 = await prisma.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: first.versionId },
      include: { fieldGroups: true, items: true },
    });
    expect(v2.fieldGroups).toHaveLength(5);
    expect(v2.items).toHaveLength(10);
    const ungrouped = v2.items.filter((it) => it.fieldGroupId === null).map((it) => it.code);
    expect(ungrouped).toEqual(['m_note']); // only the general note is ungrouped

    const plan = await prisma.maintenancePlan.findFirstOrThrow({ where: { kind: 'MONTHLY_FIELD', assetTypeKey: 'SOS_POLE' } });
    expect(plan.checklistVersionId).toBe(first.versionId);
  });

  it('refuses to trust/repoint an existing PUBLISHED v2 whose stored content drifted (label or order)', async () => {
    const ok = await rolloutMonthlyV2(prisma); // canonical steady state
    const before = await prisma.maintenancePlan.findFirstOrThrow({ where: { kind: 'MONTHLY_FIELD', assetTypeKey: 'SOS_POLE' } });
    expect(before.checklistVersionId).toBe(ok.versionId);

    // Capture the original so the shared reference data can be restored exactly.
    const item = await prisma.checklistItem.findFirstOrThrow({ where: { versionId: ok.versionId, code: 'm_sos_button' } });
    try {
      // (a) LABEL drift on the published v2 -> fingerprint mismatch -> refuse, no repoint.
      await prisma.checklistItem.update({ where: { id: item.id }, data: { label: 'DRIFTED' } });
      await expect(rolloutMonthlyV2(prisma)).rejects.toThrow(/does not match the expected definition/);
      let plan = await prisma.maintenancePlan.findFirstOrThrow({ where: { kind: 'MONTHLY_FIELD', assetTypeKey: 'SOS_POLE' } });
      expect(plan.checklistVersionId).toBe(ok.versionId); // unchanged — never repointed
      await prisma.checklistItem.update({ where: { id: item.id }, data: { label: item.label } });

      // (b) ORDER drift -> fingerprint mismatch -> refuse, no repoint.
      await prisma.checklistItem.update({ where: { id: item.id }, data: { order: 999 } });
      await expect(rolloutMonthlyV2(prisma)).rejects.toThrow(/does not match the expected definition/);
      plan = await prisma.maintenancePlan.findFirstOrThrow({ where: { kind: 'MONTHLY_FIELD', assetTypeKey: 'SOS_POLE' } });
      expect(plan.checklistVersionId).toBe(ok.versionId); // unchanged — never repointed
    } finally {
      // Restore exact original label + order so the DB steady state is intact.
      await prisma.checklistItem.update({ where: { id: item.id }, data: { label: item.label, order: item.order } });
    }
  });
});
```

Run: `pnpm test:integration -- prisma/checklist-v2.itest.ts` → GREEN, exit 0.

- [ ] **Step 8: Full integration suite** — `pnpm test:integration` → all files GREEN. Record the printed file/test totals (baseline 9 files / 43 tests + this task's additions).
- [ ] **Step 9: Commit**

```
git add src/app/api/sync/bootstrap/route.itest.ts src/app/api/inspections/route.itest.ts src/server/services/checklist-version.itest.ts prisma/checklist-v2.itest.ts
git commit -m "test(integration): grouped bootstrap, field-submit expansion, version lifecycle, rollout idempotency

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: Browser `/today` verification (local DB only)

Performed on the local DB after a full reset so the demo pins the grouped v2. Because in-pane screenshots may time out, verify the accessibility tree with `read_page` and probe values with a JS snippet rather than a screenshot.

- [ ] **Step 1: Reset ONLY the disposable Postgres volume — never `down -v`, never touch keycloak-data or prod compose.** This project is Windows/PowerShell. The dev `docker-compose.yml` declares TWO named volumes (`db-data` AND `keycloak-data`), so `docker compose down -v` would destroy BOTH and is FORBIDDEN. Run this native-PowerShell, fail-closed reset (it removes only the literal `sos-maintenance_db-data`, and aborts unless exactly one volume of that name exists):

```powershell
# 1. Stop and remove ONLY the postgres container (keycloak/mailpit + their volumes untouched).
docker compose stop postgres
docker compose rm -f postgres

# 2. Fail closed: the target is a task-specific LITERAL (never from $HOME or any env var).
$targetVolume = 'sos-maintenance_db-data'
$hits = @(docker volume ls --format '{{.Name}}' | Where-Object { $_ -eq $targetVolume })
if ($hits.Count -ne 1) {
  throw "ABORT: expected exactly one docker volume named '$targetVolume', found $($hits.Count). Removing nothing."
}
$inspected = docker volume inspect --format '{{.Name}}' $targetVolume
if ($LASTEXITCODE -ne 0 -or $inspected -ne $targetVolume) {
  throw "ABORT: docker volume inspect returned '$inspected' (exit $LASTEXITCODE), expected '$targetVolume'. Removing nothing."
}

# 3. Remove ONLY that literal volume, then recreate ONLY postgres.
docker volume rm $targetVolume
docker compose up -d postgres
```

Guardrails: this never runs `docker compose down` / `down -v`, never names `sos-maintenance_keycloak-data`, and never references `docker-compose.prod.yml`. Any `ABORT` (a thrown terminating error) means stop and fix the environment — do not force. Then, in the **demo / browser runtime shell** (`$env:DATABASE_URL` + `$env:NODE_ENV='development'` + `$env:AUTH_MODE='internal'` + `$env:LOCAL_DEMO_CONFIRM='SOS_LOCAL_DEMO'`; never echo the connection string):

```powershell
pnpm db:setup       # migrate + PostGIS + seed + db:checklist:v2 (monthly plan -> grouped v2)
pnpm db:seed:demo   # one ASSIGNED DEMO-LOCAL-EP01-MONTHLY-V2 pinning the grouped v2
```

Expected: `db:seed:demo` prints `... DEMO-LOCAL-EP01-MONTHLY-V2 on EP01 is ASSIGNED (created).`

- [ ] **Step 2: Mock geolocation at EP01 (keeps the out-of-scope GPS>100m path out of this slice)** — start the app on port **3100** (port 3000 belongs to the unrelated `thai-memo-app` and must not be touched): `pnpm dev -- -p 3100`, open `http://localhost:3100/today`, then in the automation context:

```js
const boot = await fetch('/api/sync/bootstrap', { cache: 'no-store' }).then((r) => r.json());
const demo = boot.workOrders.find((w) => w.code === 'DEMO-LOCAL-EP01-MONTHLY-V2');
const { latitude, longitude } = demo.asset;
navigator.geolocation.getCurrentPosition = (success) => success({ coords: { latitude, longitude, accuracy: 5 } });
console.log('groupCount', demo.groups.length, demo.groups.map((g) => g.label));
```

- [ ] **Step 3: Verify grouped UI via `read_page`** — confirm: card heading `DEMO-LOCAL-EP01-MONTHLY-V2`, status `มอบหมายแล้ว`, "5 กลุ่ม". Assert `demo.groups.length === 5` and the five Thai group labels match Task 11. Confirm **no** `PASS`/`FAIL`/`BOOLEAN_PASS_FAIL`/criticality `*`/the word "Checklist" appears in the accessibility tree.
- [ ] **Step 4: Normal path (5 decisions)** — click `เริ่มงาน` (→ `กำลังดำเนินการ`); tap `ปกติ` on all five groups; the submit label becomes `ส่งผลตรวจ`; leave the general note empty; click submit. Expect `POST /api/inspections` 201 then transition to `SUBMITTED` (`รอตรวจรับ`), no console errors.
- [ ] **Step 5: Problem path spot-check (separate fresh demo run or DB re-reset)** — set one group to `พบปัญหา`, mark one member `มีปัญหา`, enter a symptom note; confirm submit blocked until note + a problem member are present; submit; confirm the pole becomes `ใช้งานไม่ได้` (DOWN) via a read-only DB check (`pnpm db:studio`).
- [ ] **Step 6: DB evidence (no secrets printed)** — with `pnpm db:studio` confirm for the NORMAL submit: one `ChecklistResponse` set under one `clientMutationId`; ten rows (nine group members PASS + the `m_note` NA); one `ReadinessSnapshot`; `WorkOrder.status = SUBMITTED`. Record observed status text + row counts for WORKLOG.
- [ ] **Step 7: Honest UAT note** — record that the browser mock kept the GPS>100m reason path (UAT #8) unexercised and out of scope, and that #3/#4 remain partial (Task metadata).

---

### Task 15: Documentation and checkpoints (observed results only)

- [ ] **Step 1: `docs/DEMO_RUNBOOK.md`** — add a "Grouped monthly (v2)" section: the Task 14 fail-closed, volume-scoped reset (stop `postgres` → remove ONLY `sos-maintenance_db-data` → recreate `postgres` → `pnpm db:setup` → `pnpm db:seed:demo`; **never `docker compose down -v`**, never remove `sos-maintenance_keycloak-data`, never touch `docker-compose.prod.yml`); the demo code `DEMO-LOCAL-EP01-MONTHLY-V2`; and a note that on a non-reset DB the old `DEMO-LOCAL-EP01-MONTHLY` (v1, groupless) is never mutated and will show the reissue advisory — reset for a clean single demo.
- [ ] **Step 2: `docs/ARCHITECTURE.md`** — in the checklist/readiness sections, add: the version-scoped `ChecklistFieldGroup` layer + membership; the DRAFT→PUBLISHED→RETIRED lifecycle (referenceability enforced in services, not by FK); the pure `canonicalizeFieldSubmission` trust boundary (criticality/keys from item defs); and the presentation-boundary Thai mapper at `src/presentation/thai-labels.ts` (outside `src/domain`).
- [ ] **Step 3: `docs/WORKLOG.md`** — prepend a dated (2026-07-23, Asia/Bangkok) entry: FACT (what shipped), DECISION (grouped monthly v2 is the active field checklist; legacy v1 frozen), EVIDENCE (record exact `pnpm test` / `pnpm test:integration` totals + CI run id once known + browser observations), REVIEW (trust boundary + immutability), and BLOCKER/HONEST: UAT #3/#4 partial, #8 still open, public-URL + Neon-rotation exceptions unchanged.
- [ ] **Step 4: `docs/RESUME_HERE.md`** — update "Where we are"/"Next steps": the flexible grouped monthly field checklist is implemented (grouped `/today`, versioned groups, server canonicalization); bump the `Last updated` line; keep the GPS>100m mandatory-reason gap (UAT #8) OPEN and the security exceptions OPEN; do not claim QA/UAT closed.
- [ ] **Step 5: Commit**

```
git add docs/DEMO_RUNBOOK.md docs/ARCHITECTURE.md docs/WORKLOG.md docs/RESUME_HERE.md
git commit -m "docs: record flexible field checklist slice + evidence (UAT still partial)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 16: Full gates, self-review, CI

- [ ] **Step 1: Clean-shell gate set** — record each exit code / total:

```
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: `pnpm test` GREEN at the new total (baseline 182 + the new unit cases from Tasks 1–3 and the updated DTO test); typecheck/lint/build exit 0; diff-check clean.

- [ ] **Step 2: Integration gate** — `pnpm test:integration` GREEN; record the file/test totals.
- [ ] **Step 3: Self-review against every acceptance criterion** (design §Acceptance) — tick each:
  - [ ] AC1 — five required Thai groups + one optional note, defined by versioned data (labels/help/order/membership in `checklist_field_group`/`checklist_item`, not the UI). Verified: Task 11 content + Task 12 renders from bootstrap.
  - [ ] AC2 — healthy pole = five decisions; general note optional/uncounted. Verified: Task 12 `groupComplete` + Task 14 browser normal path.
  - [ ] AC3 — only ปกติ/พบปัญหา/ตรวจไม่ได้ shown; no result/kind/criticality/code/key/"Checklist"/jargon; content from versioned data; only outcomes/member-states/kind/status via the mapper (exhaustive + safe fallback, never echoes token); item kinds never rendered. Verified: Tasks 1, 12; bootstrap leak assertions (Task 15.1).
  - [ ] AC4 — พบปัญหา reveals members + required note; PROBLEM=FAIL, OK=PASS, unmarked=UNKNOWN (never assumed pass). Verified: Task 2 canonicalize tests + Task 15.2.
  - [ ] AC5 — ตรวจไม่ได้ requires reason; every member UNKNOWN. Verified: Task 2 + Task 15.2.
  - [ ] AC6 — bootstrap display-safe only; submit carries group outcomes, no client criticality/keys. Verified: Tasks 6, 7; leak assertions.
  - [ ] AC7 — server loads pinned version + canonicalizes with item-defined criticality/keys, rejects unknown/missing group/member; readiness stays computed + immutable snapshot. Verified: Tasks 8, 9, 2 + Task 15.2.
  - [ ] AC8 — notes/reasons/general note persist in `ChecklistResponse.note`; `locationReason` untouched. Verified: Task 9 adapter + Task 15.2 (`note` assertions); no code writes `locationReason`.
  - [ ] AC9 — add/edit/reorder/activate/retire via new draft → publish → repoint, no schema/UI rewrite; publish validates + freezes; retire only stops new use; work orders pin their version; history unchanged. Verified: Tasks 3, 10, 11 + Task 15.3 (incl. pinning).
  - [ ] AC10 — delivered with domain + integration + UAT-aligned evidence; does NOT claim production readiness or close QA/UAT. Verified: Task 15 + metadata honesty notes.
- [ ] **Step 4: Placeholder + type-consistency scan** — grep the diff for `TODO`/`TBD`/`FIXME`/`placeholder`/`...`-as-code (none permitted). Confirm names match across tasks: `GroupOutcome`/`MemberState` (`NORMAL/PROBLEM/UNTESTABLE`, `OK/PROBLEM/UNTESTED`) identical in `thai-labels.ts`, `canonicalize.ts`, DTO, UI; `EvaluatedResponse.note` written by the adapter; `fieldInspectionPayloadSchema` used by the route; `loadPinnedChecklistDefinition` shape feeds `canonicalizeFieldSubmission`; `ChecklistVersionStatus`/`ChecklistReasonPolicy`/`ChecklistPhotoPolicy` used consistently in schema, seed, service, rollout.
- [ ] **Step 5: `git diff --check`** → no whitespace/conflict errors.
- [ ] **Step 6: Push + CI** (only after all gates GREEN):

```
git push origin main
gh run list --branch main --limit 1
gh run watch <run-id> --exit-status
```

Expected: `quality` job GREEN (typecheck/lint/`pnpm test`/build); `integration` job GREEN — `pnpm db:setup` now runs `db:checklist:v2` before `pnpm test:integration`, so the grouped monthly plan/version exist there. Record the run id + both conclusions in WORKLOG/RESUME_HERE. If CI is red, read the failing step, fix the root cause in a follow-up commit, and re-verify — never mark DONE on a red run.

---

## 19. Rollback

- Rollback point: the base commit from §2 is recorded for reference only. **Do NOT `git reset`** — undo published/committed work with `git revert <commit>…` (one revert per commit, newest first), which preserves history.
- Schema rollback: never hand-edit an applied migration. If the added structures must be removed, author a NEW follow-up migration that drops the columns/table/enums, and apply it forward. The `status`/`retiredAt`/`fieldGroupId`/`memberOrder` columns are nullable/defaulted, so reverting the code alone leaves the DB compatible until such a migration is written.
- Data: the grouped v2 + repointed plan live only on disposable local/CI DBs (this plan creates no production/Neon data). A fresh `pnpm db:setup` reproduces the intended end state.

## 20. Out of scope (explicit) — do not start here

- **Photo upload/capture/compression/storage.** Group 5 is a condition result only; every V2 item `requiresPhoto=false`; all groups `photoPolicy=NONE`; publish accepts only NONE. OPTIONAL/REQUIRED and any real photo enforcement wait for a later runtime + version.
- **GPS `>100 m` mandatory reason (UAT #8).** `ChecklistResponse.locationReason` stays reserved and untouched; never reused for group notes/reasons. The browser check mocks GPS at EP01 so the path is not exercised.
- **Offline IndexedDB queue, QR scan, group-management admin UI, auth/Keycloak, reports, online map.** Unchanged.
- **Readiness / work-state / authorization substance.** Unchanged — the only trust change is reading criticality + function keys from the pinned version instead of the request.
