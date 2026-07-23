# Flexible Field Checklist Design

> Design specification only. This document describes a plan; it does not change
> code, data, tests, readiness computation, or the QA/UAT release gate, and it
> does not by itself make anything production-ready. Exact database and API
> names below are design-level suggestions to validate during planning. The
> flexibility and immutability behaviors, by contrast, are firm requirements.

## Goal

Make the monthly field inspection fast, humane, and honest for a technician
standing at a pole, while keeping readiness fully computed and
server-authoritative. A monthly field visit should take **five minutes or
less** and, on a healthy pole, require only **five decisions** — one per
outcome-oriented field group — with an optional general note that is never
counted as a decision.

At the same time, the checklist must become genuinely flexible: the field
groups a technician sees, their Thai wording, their order, and which internal
checklist items each group covers must live in **versioned data**, not in
hardcoded UI or hardcoded code maps. Adding, editing, reordering, activating,
or retiring a group or a member later must be a data change under a new
checklist version — never a schema rewrite and never a UI rewrite.

## Context and problem

Today the monthly field checklist is a flat list of ten `ChecklistItem`
rows rendered one-for-one in `src/components/TodayWorkspace.tsx`. Three
problems follow from that:

1. **Cognitive load and time.** The field form asks for ten separate
   PASS/FAIL/NA/UNKNOWN decisions, one per raw item, which is slow and invites
   rote tapping rather than real verification.
2. **Technical leakage.** The field UI currently renders the raw
   `ChecklistItemKind` enum (`BOOLEAN_PASS_FAIL`, `TEXT`, `PHOTO`) beside each
   item and marks critical items with a bare `*`. Internal enums and
   criticality are not appropriate for a field-facing screen.
3. **Trust boundary.** The submit path sends per-item `criticality` and
   `criticalFunctionKey` from the client and the service consumes them
   directly. Readiness-affecting facts must never be sourced from the wire.

This design keeps the existing versioned/immutable checklist spine and the
existing readiness pipeline, and adds a normalized **field-group** layer on top
of the item layer, plus a server-side canonicalization step that expands a
small set of group outcomes into the authoritative per-item responses the
domain already understands.

## Design principles honored

- **Readiness stays computed, never chosen.** The technician records what they
  observed per group; the server derives PASS/FAIL/UNKNOWN per item and per
  critical function and runs the existing `evaluateReadiness` engine. No screen
  lets anyone pick a colour or a status.
- **`src/domain` stays pure.** Canonicalization (group outcomes → evaluated
  per-item responses) is a pure function added under `src/domain/checklist`,
  unit-tested first; persistence stays behind the existing inspection port.
- **Immutability with a lifecycle.** Checklist versions move DRAFT → PUBLISHED →
  RETIRED. A version is freely editable only while DRAFT; publishing validates
  and **freezes** its field groups, items, memberships, labels, and policies.
  Every later change is a new draft version that is published and pointed to;
  nothing published is edited in place. Historical responses and readiness
  snapshots are never rewritten.
- **No fabricated data.** Untested members are recorded as UNKNOWN, never
  silently assumed to pass.
- **Thai-only, consistent vocabulary; premium and restrained.** Outcomes read
  only as ปกติ / พบปัญหา / ตรวจไม่ได้; status always shows icon + text; no raw
  enums, no criticality asterisks, no jargon on screen.

## Field UX flow

### The five field groups (monthly, outcome-oriented)

The monthly field checklist presents **five required groups**, each phrased as
an outcome a technician can confirm at the pole, followed by one **optional**
general note. Every group maps one-to-many onto the existing monthly checklist
items (their internal codes shown here only to make the mapping auditable; they
never appear on screen).

| # | Group Thai label (display) | Group help (display) | Covered members (internal item → critical function) |
|---|---|---|---|
| 1 | ระบบมีไฟเลี้ยงและพร้อมทำงาน | ตรวจว่าเสามีไฟเลี้ยงและระบบเปิดทำงานปกติ | `m_operating_power` → `operating_power` (critical) |
| 2 | กดปุ่ม SOS แล้วมีไฟและเสียงยืนยัน | กดปุ่มขอความช่วยเหลือแล้วมีไฟและเสียงตอบรับ | `m_sos_button` → `sos_button` (critical); `m_confirmation_signal` → `confirmation_signal` (critical) |
| 3 | สนทนาสองทางกับเจ้าหน้าที่ได้ชัดเจน | พูดและฟังกับเจ้าหน้าที่ศูนย์ได้ชัดทั้งสองทาง | `m_microphone` → `microphone` (critical); `m_speaker_two_way_audio` → `speaker_two_way_audio` (critical); `m_network_voip` → `network_voip` (critical) |
| 4 | ศูนย์เห็นจุดถูกต้องและกล้อง/การบันทึกทำงาน | ยืนยันกับศูนย์ว่าเห็นตำแหน่งถูกต้อง และภาพกล้อง/การบันทึกใช้งานได้ | `m_center_sees` → `network_voip` (critical); `m_camera_recording` → `camera_recording` (critical) |
| 5 | สภาพตู้ ป้าย และฐานเสาภายนอกเรียบร้อย | ตรวจความเรียบร้อยของตู้ ป้ายคำแนะนำ และฐานเสาจากภายนอก | `m_exterior` → (non-critical; condition result only, `photoPolicy` NONE this slice) |
| — | หมายเหตุเพิ่มเติม (ถ้ามี) | บันทึกข้อสังเกตทั่วไป ไม่บังคับ และไม่นับเป็นการตัดสินใจ | `m_note` → (non-critical, free text) |

Group 3 deliberately covers microphone, speaker, and network together because
a technician verifies them in one action — holding a two-way conversation with
the centre. Group 4 covers "the centre sees the correct point" together with
"camera and recording work," because both are confirmed in the same exchange
with the control centre. This is why the normal path is five decisions rather
than ten.

**Photo policy in this slice (group 5).** Group 5 is recorded as a *condition
result* only: its `photoPolicy` is **NONE** and no photo is captured, uploaded,
or enforced. This slice therefore makes **no** photo claim and does not satisfy
any photo portion of UAT. The seed's existing `m_exterior` `requiresPhoto = true`
flag predates photo upload; because upload is out of scope, V2 must set the
`m_exterior` item's `requiresPhoto` to **false** and choose `photoPolicy` NONE
for group 5 — an explicit reconciliation while building V2, never silently
ignored and never silently promised. Publish validation currently accepts only
`photoPolicy` NONE, so a version can never promise a photo the app cannot
collect. OPTIONAL and REQUIRED photo policies may be supported only in a later
runtime and version, after photo upload capability exists; at that point a new
published version (e.g. V3) can require photos with no schema or UI rewrite —
only new versioned data.

### The three outcomes (Thai only)

Each group is answered with exactly one outcome, shown as an icon-plus-text
control (never colour alone):

- **ปกติ** — the group is working as expected.
- **พบปัญหา** — the technician found a problem in this group.
- **ตรวจไม่ได้** — the group could not be tested on this visit.

No other status text appears. The words PASS/FAIL/NA/UNKNOWN, the enum names,
and criticality markers are never shown to the technician.

### Normal path — five decisions, under five minutes

On a healthy pole the technician taps **ปกติ** on all five groups and submits.
That is five decisions total; the general note stays empty and is not counted.
The design target is a monthly field visit completed in five minutes or less.

### Problem path — พบปัญหา

Choosing **พบปัญหา** reveals that group's **member diagnostics** and a required
**symptom note**:

- Each member of the group is listed by its Thai label with a per-member state:
  **ทำงานปกติ**, **มีปัญหา**, or **ตรวจไม่ได้**. Members are unset by default.
- The technician must mark **at least one member as มีปัญหา** (that is what
  makes the group outcome a problem) and must enter a non-empty symptom note.
- **Untested members are not assumed to pass.** A member left unset is recorded
  as UNKNOWN, not PASS. Only members explicitly marked ทำงานปกติ become PASS.

This keeps the record honest: when a mic is broken but the speaker was never
checked, the speaker is recorded UNKNOWN rather than falsely passing.

### Could-not-test path — ตรวจไม่ได้

Choosing **ตรวจไม่ได้** requires a **reason** and records **every covered
member of that group as UNKNOWN**. Nothing in a group that could not be tested
is recorded as passing.

### General note

A single optional free-text note applies to the whole visit. It is never
required, never blocks submission, and is not one of the five decisions.

## Presentation labels — two sources, kept distinct

Two different sources feed the Thai the technician sees, and they must not be
conflated:

- **Content labels come from versioned data.** Group and member display text is
  the Thai `label` / `help` stored on the checklist **version** (the group and
  item rows). The UI renders these directly from the pinned version; they are
  **not** routed through any hardcoded map. Re-wording a group is therefore a
  data change under a new version, never a code change.
- **Internal states that must be displayed go through one presentation-boundary
  mapper.** A single module at a presentation boundary — design-level
  suggestion: `src/presentation/thai-labels.ts`, **outside `src/domain`** — is
  the only place that turns an internal state or status code into Thai. It covers
  exactly the codes the UI itself must show: the group-outcome codes
  (`NORMAL` / `PROBLEM` / `UNTESTABLE` → ปกติ / พบปัญหา / ตรวจไม่ได้), the
  member-state codes (`OK` / `PROBLEM` / `UNTESTED` → ทำงานปกติ / มีปัญหา /
  ตรวจไม่ได้), and the work-order kind and status (folding in the maps currently
  inlined in `TodayWorkspace.tsx`). Each mapper is **exhaustive** over its enum
  and returns a **safe generic Thai phrase for any unrecognized code, never
  echoing the raw token** (for example an unknown status renders as a neutral
  Thai label such as "สถานะอื่น", not the enum name).

Internal **item kinds** (`BOOLEAN_PASS_FAIL` / `NUMBER` / `TEXT` / `PHOTO` /
`SELECT`) are **never rendered at all** — the grouped field UI has no place that
shows an item kind, so there is nothing to map. The current `{item.kind}` render
in `TodayWorkspace.tsx` is removed outright.

The following must **never** reach any user-facing screen, either as text or as
a decorative marker:

- response results (`PASS` / `FAIL` / `NA` / `UNKNOWN`);
- item kinds (`BOOLEAN_PASS_FAIL` / `NUMBER` / `TEXT` / `PHOTO` / `SELECT`);
- criticality (`CRITICAL` / `NON_CRITICAL`) or a criticality asterisk;
- maintenance/readiness/status enum identifiers;
- internal item codes, group keys, or critical-function keys;
- raw item-by-item fallback lists;
- the word "Checklist", and unnecessary "GPS" / "VoIP" / "End-to-End" jargon.

## Data model — flexible versioned group model

The existing spine is kept: `ChecklistTemplate` → `ChecklistTemplateVersion`
(frozen once published under the lifecycle below) → `ChecklistItem`. This design
adds a normalized, version-scoped group layer above the item layer. It
deliberately avoids repeating labels per work order and avoids any hardcoded
group-to-function map in code.

### New entity — field group (design-level names)

`ChecklistFieldGroup` (suggested table `checklist_field_group`), scoped to one
checklist version:

- `id` — UUID.
- `checklistVersionId` — FK to `ChecklistTemplateVersion` (version-scoped; a
  group belongs to exactly one version).
- `key` — stable identifier within the version (e.g. `power_readiness`);
  `@@unique([checklistVersionId, key])`.
- `label` — Thai display label.
- `helpText` — Thai help text (nullable).
- `order` — integer display order within the version.
- `required` — boolean; required groups must be answered to submit.
- `reasonPolicy` — behavior config for when a reason/symptom note is mandatory
  (default: reason required on ตรวจไม่ได้; symptom note required on พบปัญหา).
- `photoPolicy` — behavior config for when a photo is required. In this slice the
  only accepted value is **NONE**, because photo upload does not exist yet;
  publish validation currently accepts only NONE. OPTIONAL and REQUIRED are
  reserved for a later runtime and version, after upload capability exists, so a
  later published version can require photos as versioned data without a schema or
  UI rewrite.

Behavior config may be modelled as small enums or a compact JSON policy object;
the requirement is that "when a reason or photo is required" is **configurable
data on the group**, not branching hardcoded in the UI.

### Membership — one-to-many, group → items

A group covers one or more existing `ChecklistItem` rows of the same version.
Two normalized options, both acceptable; validate during planning:

1. **Preferred (minimal, exact one-to-many):** add nullable
   `fieldGroupId` (FK) and `memberOrder` (int) to `ChecklistItem`. An item
   belongs to at most one group; ungrouped items (e.g. the general note) carry a
   null `fieldGroupId`.
2. **Alternative:** an explicit join table `checklist_field_group_member`
   (`groupId`, `itemId`, `memberOrder`) if membership ever needs to be
   many-to-many.

Either way, membership is data, and the item retains the authoritative
`criticality` and `criticalFunctionKey` it already has. The group never stores
criticality or function keys — those stay on the item and are read only on the
server.

### Version lifecycle and editability

Future editability is expressed through a design-level checklist-version
lifecycle — **DRAFT → PUBLISHED → RETIRED** (state names to validate). The
schema does **not** model this lifecycle today: `ChecklistTemplateVersion` has no
lifecycle `status` and no `retiredAt` (it carries only `publishedAt` and
`isLocked`, which are insufficient to express DRAFT/PUBLISHED/RETIRED). The
lifecycle therefore **requires additive fields** — an explicit `status` and/or
lifecycle timestamp fields (at least a `retiredAt`) — added alongside the
existing columns. These are additive only; no existing column is dropped or
repurposed. Because a plain database foreign key cannot express "only a
PUBLISHED version may be referenced," referenceability is enforced by the
service/port publish and repoint operations (see Migration), not assumed from
the schema:

- **DRAFT** — the version and its groups, items, memberships, labels, order, and
  policies may be freely added, edited, and reordered. A draft is **not**
  referenceable by a `MaintenancePlan` and cannot be pinned by a work order.
- **PUBLISHED** — publishing runs the publish-time validations below and then
  **freezes** the whole version: groups, items, memberships, labels, order, and
  behavior policies become immutable. Only a published version may be referenced
  by a `MaintenancePlan` and pinned by a work order — enforced in the
  publish/repoint service operations, since a foreign key alone cannot express
  it.
- **RETIRED** — retirement stops a version from being referenced by any *new*
  plan or work order. It never deletes or alters the version, and never touches
  work orders already pinned to it or any historical response or snapshot.

Every editorial change — add, edit, reorder, activate, or retire a group or a
member — is therefore expressed the same way, with **no schema change and no UI
change**:

1. copy the current published version into a new **draft** version;
2. make the change in the draft (add / edit / reorder groups, members, labels,
   order, or policies);
3. **publish** the draft (validations run, then it freezes);
4. repoint the `MaintenancePlan` to the newly published version, and retire the
   old version once no active plan references it.

New work orders pin the new version; existing work orders keep the version they
already pinned. Nothing published is edited in place.

**Publish-time validations** (a draft that fails any of these cannot be
published):

- group `key` values are unique within the version, and group `order` yields a
  usable, unambiguous ordering (no duplicate order among active groups);
- every **required** group has at least one member;
- every membership references an item **of the same version** (no cross-version
  membership);
- every group, and every member the UI will render, carries a non-empty Thai
  display label;
- for the monthly definition, the members collectively cover the critical
  functions readiness expects, so a published monthly version can never silently
  drop a critical check;
- every group's `reasonPolicy` and `photoPolicy` is a supported, recognized value
  that the runtime can actually enforce — in this slice `photoPolicy` must be
  NONE (OPTIONAL and REQUIRED are rejected until photo upload exists).

### Immutability and history

- A **published** version's groups, memberships, items, labels, order, and
  behavior policies are immutable; editing means creating and publishing a new
  draft version (above). Retirement changes only referenceability, never content.
- `ChecklistResponse`, `ReadinessSnapshot`, and `WorkLog` remain append-only.
  This design adds no update or delete path to any of them.
- Each work order continues to **pin** its checklist version via
  `WorkOrder.checklistVersionId`; the pinned version determines both the groups
  shown and the canonical expansion at submit time. Retiring a version does not
  change what an already-pinned work order sees.

## API and data flow

### Bootstrap — grouped, no leakage

`getSyncBootstrap` (in `src/server/queries/sync.ts`) changes shape: for each
open work order it returns the pinned version's **groups** instead of a flat
item list. Per group it returns only display-safe fields:

```
group: {
  key,            // opaque identifier, never displayed
  label,          // Thai
  help,           // Thai, optional
  order,
  required,
  members: [ { memberKey, label /* Thai */ } ],   // memberKey opaque, never displayed
  reasonPolicy,   // drives which inputs the UI makes mandatory
  photoPolicy     // NONE in this slice; versioned for later capability
}
```

The bootstrap must **not** include `kind`, `criticality`, or
`criticalFunctionKey`. `memberKey` is the item's stable `code` used purely as an
opaque round-trip identifier; the UI renders only `label`.

### Submit — group outcomes in, canonical responses derived on the server

The `/api/inspections` request body changes from per-item results to group
outcomes, carried inside the existing idempotent mutation envelope:

```
payload: {
  workOrderId,
  groups: [
    {
      groupKey,
      outcome: 'NORMAL' | 'PROBLEM' | 'UNTESTABLE',   // transport codes; UI shows Thai
      members?: [ { memberKey, state: 'OK' | 'PROBLEM' | 'UNTESTED' } ],  // only for PROBLEM
      note?,     // required symptom note for PROBLEM
      reason?    // required reason for UNTESTABLE
    }
  ],
  generalNote?,   // optional; not a decision
  gps: { lat, lng }
}
```

Transport codes (`NORMAL`/`PROBLEM`/`UNTESTABLE`, `OK`/`PROBLEM`/`UNTESTED`) are
API tokens only and are never rendered; the UI maps them to Thai through the
presentation-boundary mapper. The client sends **no** criticality and **no**
function keys.

### Server canonicalization — the trust boundary

A new pure step (design-level: `canonicalizeFieldSubmission` under
`src/domain/checklist`) runs on the server before the existing
`submitInspection` pipeline. It receives the submitted group outcomes plus the
**pinned version's groups, memberships, and items loaded from the database**,
and produces the authoritative `EvaluatedResponse[]` the domain already
consumes. Rules:

- **ปกติ / NORMAL** → every member of the group → `PASS`.
- **พบปัญหา / PROBLEM** → per member: `OK` → `PASS`, `PROBLEM` → `FAIL`,
  `UNTESTED` or omitted → `UNKNOWN`. Requires at least one `PROBLEM` member and
  a non-empty symptom note.
- **ตรวจไม่ได้ / UNTESTABLE** → every member → `UNKNOWN`. Requires a non-empty
  reason.
- The general note maps to the `m_note` item as an `NA` response carrying the
  note text.

Crucially, each produced `EvaluatedResponse` takes its `criticality` and
`criticalFunctionKey` from the **item definition in the pinned version**, not
from the request. The current behavior of trusting client-supplied criticality
and function keys is removed. Fault derivation (`deriveFaults`) and the
critical-function collapse (`toCriticalCheckResults`) therefore operate only on
server-authoritative facts.

### Readiness — unchanged and authoritative

After canonicalization, the flow is exactly as today: `toCriticalCheckResults`
collapses per-function results (any `FAIL` ⇒ `FAIL`; else any `PASS` ⇒ `PASS`;
else `UNKNOWN`), `deriveFaults` opens faults for failed items,
`evaluateReadiness` applies precedence (DOWN > UNKNOWN > WATCH > READY, 7-day
grace), and an immutable `ReadinessSnapshot` is written. A critical member
marked มีปัญหา drives the pole to DOWN; a critical group marked ตรวจไม่ได้
leaves that function UNKNOWN (no fresh pass) and cannot yield READY.

### Persistence

`persist` continues to write one `ChecklistResponse` per expanded item, with:

- `result` = the canonical `PASS`/`FAIL`/`NA`/`UNKNOWN`;
- `note` = the group symptom note on that group's problem-member rows, the
  could-not-test reason on that group's untested-member rows, and the general
  note on the `m_note` row — all persisted in `ChecklistResponse.note`;
- GPS fields (`capturedLat`/`capturedLng`/`distanceMeters`/`locationException`/
  `reviewFlag`) exactly as today.

`ChecklistResponse.locationReason` remains reserved solely for the separate GPS
`>100 m` mandatory-reason rule and is not used for group reasons or symptom
notes. That GPS wiring is a different slice and is out of scope here.

## Migration and versioning strategy

1. **Additive schema migration.** Add the `checklist_field_group` table, the
   membership relation (nullable `fieldGroupId` + `memberOrder` on
   `ChecklistItem`, or the join table), and the additive **lifecycle fields** on
   `ChecklistTemplateVersion` (an explicit `status` and/or lifecycle timestamps
   including `retiredAt`, alongside the existing `publishedAt`/`isLocked`). This
   is purely additive — no column is dropped or repurposed, and no existing row
   changes meaning.
2. **Classify legacy versions on migration.** Every checklist version currently
   referenced by a plan, work order, or response — **including monthly version
   1** — is migrated to **PUBLISHED/frozen**, without altering its items, labels,
   or any content. Legacy versions that are **not** referenced take an explicit,
   safe default that the migration states rather than leaves implicit
   (recommended: mark them PUBLISHED/frozen too, so nothing legacy is silently
   left editable; DRAFT is acceptable only for a version provably unreferenced and
   intended for further editing).
3. **New content under a new version.** The current monthly version is already
   referenced (by the plan and the local demo work order) and must be migrated as
   legacy **PUBLISHED/frozen**. The five groups are introduced on a **new monthly
   checklist version** (see rollout below), not by editing the existing one.
4. **Referenceability enforced in services.** A plain database foreign key cannot
   express "only a PUBLISHED version may be referenced by a plan or pinned by a
   work order." That rule lives in the **service/port publish and repoint
   operations** and is covered by tests, not assumed from the schema.
5. **No backfill of history.** Existing responses and snapshots are left exactly
   as written; they remain readable at the item level for audit and reports.

## Rollout of a new monthly checklist version

To introduce the grouped experience for the monthly field test:

1. Apply the additive migration for the group table and membership.
2. Create monthly checklist **version 2** as a draft: re-create the same monthly
   items under the new version, add the five `ChecklistFieldGroup` rows (labels,
   help, order, `required = true`, reason/photo policy), and attach the
   memberships per the mapping table above. The general-note item stays
   ungrouped. Publish version 2 — the publish-time validations run and the
   version freezes.
3. Repoint the monthly `MaintenancePlan` to version 2. New monthly work orders
   then pin version 2 and render as five groups.
4. Version 1 is untouched. Any work order already pinned to version 1 keeps its
   pinned version and its evidence; nothing is rewritten.

This rollout is content/versioning work described here; it is not performed by
this document.

## Compatibility with old work orders

- **Closed or submitted work orders** keep their per-item `ChecklistResponse`
  rows and `ReadinessSnapshot` history verbatim; they stay auditable through the
  existing read paths and reports. This design adds no migration that alters
  them.
- **Open work orders pinned to a version that has no field groups** are not
  rendered as a raw item list (raw fallback is explicitly disallowed). Instead
  the grouped field list surfaces such a work order with a clear Thai advisory
  that it must be reissued under the current checklist version; a Planner
  reissues it (cancel + new work order under the grouped version) rather than
  the field UI degrading to per-item toggles.
- In practice there is no production history to reconcile: the system has not
  gone live (the QA/UAT gate is not passed) and the only monthly work order that
  exists is the guarded local demo, which is replaced on a freshly recreated
  local database via the local demo reset below — never re-pinned in place.

## Local demo reset

The guarded `pnpm db:seed:demo` fixture currently creates one `ASSIGNED` monthly
demo work order (`DEMO-LOCAL-EP01-MONTHLY`) pinned to the monthly version that
`pnpm db:setup` seeded. It is idempotent: a second run returns the existing work
order unchanged. That idempotency is preserved — **the automatic demo seed must
never mutate, delete, or re-pin an existing work order or its evidence.**

To move the local demo onto the grouped (published) monthly version, the
verified reset is a full recreation of the disposable local database, all inside
the existing fail-closed safety boundary (`LOCAL_DEMO_CONFIRM = SOS_LOCAL_DEMO`,
non-production `NODE_ENV`, a `localhost`/loopback host, and database name `sos`;
Neon and production are never touched):

1. tear down and recreate the exact local `sos` Docker volume, destroying the
   disposable local database;
2. run `pnpm db:setup` (migrate + PostGIS + reference seed) — once the monthly
   plan references the published grouped version per the Rollout section, this
   establishes that version as the monthly definition;
3. run `pnpm db:seed:demo`, so the newly created demo work order pins the grouped
   version.

If the database is **not** reset and a prior demo work order already exists,
`pnpm db:seed:demo` either returns it unchanged (current idempotent behavior) or
refuses with safe guidance to reset the local volume — it never overwrites,
re-pins, or edits the existing work order or its evidence. Planning may instead
adopt a version-suffixed demo code (for example a distinct
`DEMO-LOCAL-EP01-MONTHLY-V2`) so a fresh code creates a new work order without
colliding with the old one; in no case is an existing work order or its evidence
overwritten.

This reset is described here for planning; it is not implemented by this
document.

## Error handling

Server-side validation rejects a submission (with a Thai message; no raw enum in
the message) when:

- a submitted `groupKey` is not a group of the work order's pinned version;
- a `memberKey` does not belong to the named group in the pinned version;
- a **required** group is missing from the submission;
- outcome is `PROBLEM` but no member is marked `PROBLEM`, or the symptom note is
  empty;
- outcome is `UNTESTABLE` but the reason is empty;
- the work order has no pinned checklist version (existing
  `NO_CHECKLIST_VERSION`), or the pinned version defines no field groups (not
  eligible for grouped submission — reissue advisory, never raw fallback).

Existing behaviors are preserved: envelope structural validation, idempotent
replay by `mutationId` (a retry is a no-op), atomic persistence via the Prisma
transaction, and the GPS read/evaluation path. A GPS read failure surfaces the
same Thai guidance the field shell shows today.

## Accessibility (WCAG 2.2 AA)

- Each group is a labelled `fieldset`/`legend`; the group help is associated via
  `aria-describedby`.
- The three outcomes are a radio group with visible Thai labels and an icon per
  option — status by icon + text, never colour alone.
- Choosing พบปัญหา reveals the member-diagnostic region with managed focus and
  `aria-expanded`; the symptom note and (for ตรวจไม่ได้) the reason are labelled
  required fields, with validation messages exposed via `role="alert"`.
- Touch targets stay ≥ 44 px (the existing `min-h-11` controls), layout reflows
  at 320 px and 200% zoom, and animation respects reduced-motion.
- No information is conveyed by colour alone; no emoji icons, gradients, or
  decorative flourishes.

## Testing and UAT

Nothing here is "done" on a passing build alone; each slice ships with test
evidence, per the project release gate.

**Domain unit tests (pure, DB-free):**

- Canonicalization: NORMAL → all members PASS; PROBLEM → `OK`/`PROBLEM`/unset
  map to PASS/FAIL/UNKNOWN with untested members never PASS; UNTESTABLE → all
  UNKNOWN; general note → NA-with-note.
- Validation rejections for every error-handling case above.
- Criticality and function keys are always taken from item definitions, proven
  by a test where the request omits/forges them and readiness is unaffected.
- Presentation-boundary Thai mapper: every group-outcome, member-state,
  work-order-kind, and work-order-status code resolves to a Thai string, and any
  unrecognized code resolves to the safe generic Thai fallback without echoing
  the raw token. Group and member content labels are asserted to come from the
  versioned data, not from the mapper. Response results, item kinds, criticality,
  and keys are never rendered (item kinds are not mapped at all).

**Integration tests (DB-backed):**

- Bootstrap returns grouped structure with no `kind`/`criticality`/function
  leakage.
- Submit expands group outcomes to the correct per-item `ChecklistResponse`
  rows, with notes/reasons/general note persisted in `ChecklistResponse.note`,
  and idempotent on retry.
- A critical group problem drives DOWN; a critical group ตรวจไม่ได้ prevents
  READY; all groups ปกติ (with an approved baseline) yields READY — asserted via
  the written `ReadinessSnapshot`.
- Version pinning: a work order keeps its pinned version's groups even after the
  plan is repointed to a newer version.

**UAT alignment (`docs/spec/06`):** this design implements the monthly field
inspection scope defined in docs 01 and 08 (the "Monthly End-to-End" maintenance
policy), targeting a five-minute visit. Its relationship to the mandatory UAT
list is partial and must not be overstated:

- **Case #3** (QR scan + GPS + photo + all pass → READY) — this slice contributes
  only the **grouped-check pass → readiness** portion. It does **not** complete
  #3, because QR/photo capture and the GPS `>100 m` reason remain open.
- **Case #4** (critical fail → DOWN + Fault + corrective work order + email) —
  this slice contributes the **canonical critical-fail → DOWN + Fault** portion
  through server-authoritative expansion. It does **not** by itself prove or
  complete #4; the corrective-work-order and email steps must be verified against
  the existing downstream evidence before the case can be claimed.
- **Case #2** (auto-draft → edit/publish → assignment) — separate; not this
  slice.
- **Case #8** (GPS `>100 m` mandatory reason + review flag) — remains a separate
  open slice.

## Out of scope / non-goals

- **Photo upload wiring.** No capture, compression, storage, or attachment flow
  is built here. Group 5 is a condition result only (`photoPolicy` NONE), and V2
  sets the legacy `m_exterior` `requiresPhoto` to false as an explicit
  reconciliation rather than enforcing an uncapturable photo. Publish validation
  currently accepts only `photoPolicy` NONE; OPTIONAL and REQUIRED become
  available only in a later runtime and version, after which a new published
  version can require photos as pure versioned data, with no schema or UI rewrite.
- **Offline mutation queue.** No IndexedDB persistence or background sync queue
  is added; submission remains online, using the existing idempotent envelope.
- **GPS `>100 m` mandatory-reason wiring.** Unchanged and still open;
  `locationReason` stays reserved for it and is not reused for group data.
- **Group management UI.** No admin screen to author or edit groups in this
  slice. The data model and API boundaries are designed so one can be added
  later purely against the group tables.
- **Auth/Keycloak, reports, and the online map.** Unchanged.
- **Readiness, work-state, and authorization rules.** Unchanged in substance;
  the only trust change is that criticality and function keys are read from the
  pinned version instead of the request.

## Naming caveat

Table names (`checklist_field_group`), column names (`fieldGroupId`,
`memberOrder`, `reasonPolicy`, `photoPolicy`), the transport codes, the
lifecycle state names, and the suggested module paths are **design-level
suggestions** to confirm during planning. What is **required** regardless of
naming: versioned checklist definitions with a DRAFT → PUBLISHED → RETIRED
lifecycle where only published versions are referenceable and published content
is frozen; a normalized version-scoped field-group model with stable key, Thai
label/help, order, required flag, configurable reason/photo behavior, and
one-to-many membership to internal items; editorial change expressed by copying
to a new draft, publishing it, and repointing the plan — no schema or UI rewrite;
work orders that pin a version; changes that affect only future work orders; and
fully auditable, never-rewritten historical responses and readiness evidence.

## Acceptance criteria

1. The monthly field checklist presents exactly five required, outcome-oriented
   Thai groups plus one optional general note, defined entirely by versioned
   data (labels, help, order, membership), not hardcoded in the UI.
2. On a healthy pole the normal path is five decisions (one ปกติ per group) and
   the general note is optional and uncounted.
3. Each group is answered only as ปกติ / พบปัญหา / ตรวจไม่ได้; no response
   result, item kind, criticality marker, internal code, key, "Checklist", or
   unnecessary GPS/VoIP/End-to-End jargon appears on any user-facing screen.
   Group and member text comes from versioned data; only genuinely internal
   states that must be shown (outcomes, member states, work-order kind/status)
   pass through the presentation-boundary Thai mapper, which is exhaustive with a
   safe generic fallback and never echoes a raw token; item kinds are never
   rendered.
4. พบปัญหา reveals member diagnostics and a required symptom note, marks
   flagged members FAIL and explicitly-confirmed members PASS, and records every
   unmarked member as UNKNOWN (never assumed pass).
5. ตรวจไม่ได้ requires a reason and records every covered member as UNKNOWN.
6. The bootstrap exposes only display-safe group/member fields; the submit
   contract carries group outcomes only, with no client-supplied criticality or
   function keys.
7. The server loads the work order's pinned version and canonicalizes group
   outcomes into per-item responses using item-defined criticality and function
   keys, rejecting unknown or missing group/member data; readiness remains
   computed and server-authoritative and is written as an immutable snapshot.
8. Symptom notes, could-not-test reasons, and the general note persist in
   `ChecklistResponse.note`; `locationReason` is untouched.
9. Adding, editing, reordering, activating, or retiring a group or member is
   achievable by copying to a new draft version, changing it, publishing it, and
   repointing the plan — with no schema rewrite and no UI hardcoding. Publishing
   runs the publish-time validations and freezes the version; retirement only
   stops new use and never alters content; work orders pin their version; and
   historical responses and readiness snapshots are unchanged and auditable.
10. The plan is delivered with domain, integration, and UAT-aligned test
    evidence; it does not, by itself, claim production readiness or close the
    QA/UAT gate.

## Self-review

- No `TBD`, `TODO`, or placeholder tokens remain.
- No contradictions: the "frozen when published" rule and later editability are
  reconciled by the DRAFT → PUBLISHED → RETIRED lifecycle — edits happen only on
  a new draft, and the demo reset recreates the local database rather than
  mutating or re-pinning any work order. Outcomes, canonical results, persistence
  targets, and the trust boundary are each stated once and consistently; enum
  names appear only to enumerate what the UI must hide, never as user-facing text.
- Factually accurate about the schema: the lifecycle is not modeled today —
  `ChecklistTemplateVersion` carries only `publishedAt` and `isLocked` (no
  `status`, no `retiredAt`) — so the design requires additive lifecycle fields,
  migrates every referenced legacy version (including monthly v1) as
  PUBLISHED/frozen without content change, states an explicit default for
  unreferenced legacy versions, and enforces referenceability in services rather
  than by foreign key.
- Honest about photos and UAT: group 5 is a condition result only
  (`photoPolicy` NONE this slice), V2 sets `m_exterior` `requiresPhoto` to false,
  no enforced photo is promised, publish validation currently accepts only
  `photoPolicy` NONE (OPTIONAL/REQUIRED deferred to a later runtime and version),
  and the UAT mapping is explicitly partial — #3 is not completed (QR/photo/GPS
  open), #4 is contributed but not proven without downstream corrective-WO/email
  evidence, #2
  is separate, and #8 stays open.
- No promise of production readiness: the document is explicitly a design, does
  not implement anything, and states it does not close the QA/UAT gate.
- No mutation of existing versions or evidence: freeze-on-publish and append-only
  history are required throughout; changes create and publish new draft versions,
  and retirement never alters content.
- No technical enum leakage to users: content labels come from versioned data, a
  presentation-boundary Thai mapper (outside `src/domain`) covers only the
  internal states that must be shown — exhaustively and with a safe generic
  fallback — item kinds are never rendered, and the forbidden-on-screen list is
  explicit.
- The owner's non-negotiable flexibility requirement is preserved: groups,
  members, labels, order, and policies are versioned data, editable via new
  published versions with no schema or UI rewrite.
