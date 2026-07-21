# ADR 0010 — Daily backup, tested restore as a release gate

Status: Accepted · Date: 2026-07-21

## Context
A single-VPS deployment must survive data loss. A backup that has never been
restored is not a backup.

## Decision
**Daily** DB (`pg_dump`) + uploads (`tar`) backups to a location **separate from
the app VPS** (`infra/backup.sh`, backup service). Targets: **RPO ≤ 24h, RTO ≤ 1
workday**. Backups are encrypted/restricted/monitored. A **quarterly staging
restore drill** with integrity/time/owner evidence is mandatory, and **release is
blocked without a tested restore** (doc 05/06 gate).

## Consequences
- Restore procedure + drill evidence are first-class deliverables.
- Backup freshness is a monitored metric; failure alerts an owner.
- Off-box copy is required in real deployments (the volume is a placeholder).
