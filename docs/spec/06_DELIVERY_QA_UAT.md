# Delivery, QA and UAT Plan

## Sequence 8-12 weeks

1. Foundation: repo/CI/Docker/ADR/auth/test
2. Asset core: PostGIS/seed27/survey/QR/private media
3. Maintenance: checklist/plans/calendar/schedule/work states
4. Fault/readiness: auto fault/WO/repair/retest/approval/notification
5. Field PWA: work package/IndexedDB/QR/GPS/photo/conflict/idempotency
6. Insights: dashboard/map/import/PDF/Excel/baseline metrics
7. Hardening: security/performance/backup/UAT/deploy/cutover

ทุกช่วงเป็น tested vertical slice ไม่มี mock workflow

## Tests

Unit/domain: readiness/grace/recurrence timezone/idempotency/RBAC/GPS/metrics/พ.ศ.

Integration: migration+seed, Keycloak, files, atomic import, jobs/outbox/email, backup/restore

E2E/UAT: roles, browser/mobile, online/offline, reports

## Mandatory UAT

1. 27 assets + baseline approval
2. auto draft -> edit/publish -> assignment
3. QR/GPS/photo/pass -> READY
4. critical fail -> DOWN + Fault + WO + email
5. repair/retest -> Planner accept -> READY
6. overdue -> WATCH -> after 7 days UNKNOWN
7. offline close/reopen -> sync once no duplicate
8. GPS >100m reason + review flag
9. Executive read/export cannot mutate
10. Dashboard/PDF/Excel match same filter
11. cutover 27 with no missing baseline/status

## Non-functional gates

WCAG 2.2 AA automated+manual; LCP/INP/CLS/JS budgets; no critical/high security finding; offline queue durable/idempotent; restore verified; Thai PDF and Excel verified

## Traceability

Sprint 1 สร้าง `requirements-traceability.csv`: requirement ID (ASSET/PM/WO/RDY/OFF/RPT/SEC/OPS) -> design -> implementation -> automated/UAT test -> evidence. ห้ามปิด requirement ไม่มี evidence

## CI

format/lint/typecheck/unit/API/integration/migration/build/dependency-license-security scan/Playwright critical E2E/accessibility smoke/report snapshot

## Cutover

Staging separate; baseline 27; users/roles/MFA/SMTP/backup ready; freeze+backup+migration+smoke+rollback; go-live all 27 after UAT; hypercare owner/daily review

## Definition of Done

Requirement evidence, real workflows, open-source core, reproducible deploy/migration/seed, tests/manuals/security/reports consistency/backup restore proof. Build pass aloneไม่พอ
