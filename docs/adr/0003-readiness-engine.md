# ADR 0003 — Computed readiness engine + immutable snapshots

Status: Accepted · Date: 2026-07-21

## Context
Executives must trust the READY/WATCH/DOWN/UNKNOWN status of each pole. Status
must be **derived from evidence**, never a colour a user picks, and every change
must be explainable and traceable.

## Decision
Implement readiness as a **pure domain function** (`src/domain/readiness`) taking
an evidence snapshot (approved baseline, latest critical results, open faults,
next-due + grace) and returning `status + reasons[] (coded) + evaluatedAt`.
Precedence is strict: **DOWN > UNKNOWN > WATCH > READY**; grace = 7 days. It runs
synchronously after critical commands and via a reconciliation job. Every
transition persists an **immutable `ReadinessSnapshot`** with reason codes.

## Consequences
- Fully unit-testable with no IO (17 tests cover all transitions & the grace
  boundary); reason codes are stable identifiers safe to persist.
- The engine cannot read a clock or DB itself — callers assemble the snapshot,
  keeping determinism.
- Snapshots are append-only history; status is reproducible from evidence.
