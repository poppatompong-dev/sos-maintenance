# ADR 0009 — Append-only audit + lifetime+5y retention

Status: Accepted · Date: 2026-07-21

## Context
The system needs a trustworthy history (who/what/when) and a legally sensible
retention policy, while never storing real emergency-incident or citizen data.

## Decision
`AuditEvent` is **append-only** (login, role/config/template/schedule/work,
approval, import/export, correction) with actor, action, entity, before/after
metadata, IP/device — and **no secrets/tokens/PII payloads**. Closed work &
evidence are retained for **asset lifetime + 5 years**; referenced master data is
**soft-retired**, never hard-deleted. Purge requires approval + audit.

## Consequences
- No deletes on closed work/evidence — use correction/reopen with audit trail.
- Storage grows; retention prune + compression/quotas manage it (doc 07 risk).
- Data policy forbids SOS-incident, citizen audio/image, and case data entirely.
