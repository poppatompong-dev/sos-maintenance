# Solution Architecture

## Style

Modular full-stack monolith แยก domain/service/repository + worker processes ลด operational complexity ใน 8-12 สัปดาห์ แต่รักษา module boundaries

## Free/open-source stack

Next.js App Router + TypeScript; Tailwind + shadcn customized; PostgreSQL/PostGIS; Keycloak OIDC/TOTP; Service Worker/IndexedDB; MapLibre/Leaflet + OSM online; Playwright PDF; ExcelJS; Nodemailer/SMTP; PostgreSQL-backed jobs; Docker Compose + Caddy; private file volume ผ่าน storage abstraction

ห้าม paid core dependency และต้องมี license inventory

## Components

- Web/PWA role-aware shell
- REST API/OpenAPI, validation/authz/commands/queries
- Modules: Asset, Survey, Maintenance, Work, Fault/Repair, Readiness, Report, Notification, Import, Audit
- Worker: recurrence, stale/readiness reconciliation, import, email retry, report, cleanup
- PostgreSQL/PostGIS: system of record + jobs/outbox/audit
- Keycloak identity/MFA
- Private storage authorized download
- Caddy TLS/security headers/reverse proxy/limits

## Reliability

Transactional outbox; idempotency keys; optimistic concurrency; immutable used checklist versions/readiness snapshots; append-only audit; reproducible migrations; liveness/readiness endpoints

## Deployment

Compose services: caddy, app, worker, postgres-postgis, keycloak, backup job; volumes db/keycloak/uploads/backup. Separate local/staging/production config/secrets/data

## Configuration

`.env.example`: DB, Keycloak, SMTP, base URL, storage, upload limits, map URL/attribution, timezone, backup, retention, adapter flags - never secrets

## Observability

Structured JSON logs + correlation/request/job/import IDs; metrics latency/error/DB pool/queue age/sync-import-email failure/storage/backup freshness. Never log token/password/photo payload/PII

## ADR required

Modular monolith, Keycloak, offline sync/conflict/idempotency, readiness, storage, jobs/outbox, map tile policy, report, audit/retention, backup/restore
