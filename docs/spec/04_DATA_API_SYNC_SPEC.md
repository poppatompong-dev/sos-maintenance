# Data, API and Offline Sync Specification

## Domain model

AssetType, Asset, AssetComponent, Location, ChecklistTemplate/Version, MaintenancePlan, ScheduleBatch, WorkOrder, Assignment, WorkLog, ChecklistResponse, Fault, RepairAction, Attachment, HealthObservation, ReadinessSnapshot, Notification, IntegrationSource, ImportBatch, AuditEvent

UUID, timestamps, actor/source, version concurrency, soft retire. Checklist version ที่ถูกใช้แล้ว immutable

## Geo

PostGIS geography point SRID4326, lon/lat. Server คำนวณระยะ; >100m = location_exception, mandatory reason, Planner flag

## State machines

Work: DRAFT -> PUBLISHED/ASSIGNED -> IN_PROGRESS -> SUBMITTED -> CLOSED + REJECTED/REOPENED/CANCELLED. Schedule: DRAFT -> APPROVED/PUBLISHED. Fault: OPEN -> IN_REPAIR -> RETEST -> RESOLVED/REOPENED. Server validates role/state/evidence/separation of duties

## Readiness engine

Pure domain function รับ baseline/due/critical results/open faults แล้วคืน status + reasons + source refs; persist immutable snapshot. Run synchronously after critical commands + reconciliation job

## API

REST JSON/OpenAPI สำหรับ assets/components/locations, surveys/checklists/plans, schedules/work/fault/repair, observations/imports/reports/notifications/audit, mobile work-package/sync. Standard stable error code + Thai message + correlation ID + field errors; pagination/filter/sort; ETag/version where useful

## Offline sync

Work package มี asset/checklist/work/version/evidence requirements/expiry. Mutation envelope: mutationId UUID, deviceId, entity/action, baseVersion, clientOccurredAt, payload checksum, attachment manifest. Retry mutationId เดิมต้องได้ผลเดิมและไม่ duplicate. Conflict ส่ง server/client version + fields + recovery path ห้าม silent last-write-wins. งาน pending จน metadata/files ครบ

## Import

upload -> parse -> preview -> row validation -> confirm -> atomic commit/rollback -> result report. ห้าม silent partial overwrite. เก็บ checksum/source/actor/counts/row errors

## Health adapter

Provider-neutral: source, externalAssetKey, observedAt, overall/component status, raw checksum, batch/ref. V1 manual/import ก่อน API/SNMP

## Reporting

Dashboard/PDF/Excel ใช้ metric service เดียว. เก็บ UTC แสดง Asia/Bangkok/พ.ศ.; ระบุ generated-at/filter/freshness
