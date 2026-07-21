# Architecture Decision Records

Each ADR records one significant, hard-to-reverse decision: context, the decision,
and its consequences. Superseding decisions get a new ADR that links back.

| ADR | Title | Status |
|----|----|----|
| [0001](0001-modular-monolith.md) | Modular full-stack monolith on Next.js | Accepted |
| [0002](0002-identity-keycloak.md) | Self-hosted Keycloak for identity & MFA | Accepted |
| [0003](0003-readiness-engine.md) | Computed readiness engine + immutable snapshots | Accepted |
| [0004](0004-offline-sync.md) | Offline sync: idempotent mutation envelopes, no silent last-write-wins | Accepted |
| [0005](0005-storage.md) | Private file storage behind a driver abstraction | Accepted |
| [0006](0006-jobs-outbox.md) | PostgreSQL-backed jobs & transactional outbox | Accepted |
| [0007](0007-map-tiles.md) | Online OSM tiles, configurable, no offline prefetch | Accepted |
| [0008](0008-reporting.md) | Single metric service for dashboard/PDF/Excel | Accepted |
| [0009](0009-audit-retention.md) | Append-only audit + lifetime+5y retention | Accepted |
| [0010](0010-backup-restore.md) | Daily backup, tested restore as a release gate | Accepted |
