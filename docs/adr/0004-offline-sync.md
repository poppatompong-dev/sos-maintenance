# ADR 0004 — Offline sync: idempotent mutation envelopes, no silent last-write-wins

Status: Accepted · Date: 2026-07-21

## Context
Field technicians work in weak-signal areas. Work packages are downloaded ahead
of time; checklists, GPS and photos are captured offline and synced later. Data
loss and duplicates are unacceptable.

## Decision
Each offline mutation is an **envelope**: `mutationId (client UUID)`, `deviceId`,
`entity/action`, `baseVersion`, `clientOccurredAt`, payload checksum, attachment
manifest. The server is **idempotent** on `mutationId` (retry ⇒ same result, no
duplicate). Optimistic concurrency uses `baseVersion`; on conflict the server
returns both versions + fields + a recovery path — **never a silent
last-write-wins**. Work is `pending` until metadata **and** files upload.

## Consequences
- Requires `clientMutationId` uniqueness + per-aggregate `version` (in schema).
- Conflicts are surfaced to the user/Planner for resolution.
- IndexedDB holds the durable client queue; server is the system of record.
