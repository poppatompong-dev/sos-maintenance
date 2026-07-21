# ADR 0006 — PostgreSQL-backed jobs & transactional outbox

Status: Accepted · Date: 2026-07-21

## Context
Recurrence generation, readiness reconciliation, import processing, email retry,
report generation and cleanup must survive restarts and not double-fire. An
in-memory timer alone is not a source of truth.

## Decision
Persist **job state in PostgreSQL**; the worker process claims and runs jobs. Side
effects that must be exactly-once (notably email) use a **transactional outbox**
written in the same transaction as the state change, then delivered with retry +
idempotency keys.

## Consequences
- Jobs are durable and observable (queue age is a metric).
- Slightly more DB work than a naive cron; worth it for correctness.
- Notification sending is decoupled from request handling and de-duplicated.
