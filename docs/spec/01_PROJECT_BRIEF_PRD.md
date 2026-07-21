# Product Brief and PRD

## Product statement

เว็บ PWA ภายในเทศบาลสำหรับสำรวจ ตรวจบำรุง ซ่อม ตรวจรับ และรายงานเสา SOS 27 จุด ต้องตอบได้ทันทีว่าเสาใด READY, WATCH, DOWN หรือ UNKNOWN พร้อมหลักฐานย้อนหลัง

## Outcomes รุ่นแรก

- EP01-EP27 มีทะเบียน พิกัด QR รูป component และ Initial Survey
- สถานะคำนวณจากหลักฐาน ห้ามเลือกสีเอง
- สร้างร่าง Weekly/Monthly/Semiannual PM; Planner ตรวจและ publish
- ช่างทำ QR/GPS/photo/checklist ได้ online/offline
- Critical fail สร้าง Fault และ Corrective WO แบบ idempotent
- Planner ตรวจรับงานซ่อม; ผู้ซ่อมห้ามรับงานตนเอง
- Dashboard/map/PDF/Excel ใช้ metric definition เดียวกัน
- RBAC, MFA, audit, daily backup และ restore drill ใช้งานจริง

## Success metrics

Primary: เสา 27 จุดมีสถานะที่ยังสด อธิบายเหตุผล และสืบกลับถึงหลักฐานได้

ติดตาม baseline coverage, credible status coverage, PM compliance, first-pass pass rate, repeat fault, MTTA, MTTR, downtime และ offline sync success. 90 วันแรกเก็บ baseline ก่อนเสนอ SLA ห้าม hard-code SLA

## Users

- System Admin: account/role/org/template/integration/system
- Planner/Supervisor: plan, approve/publish, assign, review, accept/reject, report
- Technician: survey, PM, fault, repair, evidence, submit
- Executive/Auditor: read/export only

บังคับสิทธิ์ที่ server ทุก endpoint และ object

## In scope

Generic CMMS core + SOS-specific V1 UI; asset/component/location/QR/media; versioned checklist; maintenance plan/calendar/schedule batch; work/fault/repair/retest/approval/audit; manual/CSV/Excel health import; PWA offline; in-app/email; dashboard/online map/PDF/Excel

## Out of scope

ตำรวจ/ผู้รับจ้าง, ข้อมูลเหตุ SOS/ประชาชน/คดี, inventory/cost/procurement/accounting, public outage, offline map, live API/SNMP ก่อนสำรวจ, fixed SLA 90 วันแรก, UI ทรัพย์สินอื่น

## Maintenance policy

1. Weekly Center Check - online/offline และ health/manual import
2. Monthly End-to-End - physical, button, indicators, two-way audio, cameras/recording, CCOC
3. Semiannual Deep PM - monthly + cabinet/connector/power/UPS/battery/water/rust/surge/grounding/base/sign/config backup
4. Corrective Repair/Retest - symptom, cause, fix, changed parts text, before/after photos, critical retest

## Readiness

- READY: approved baseline, current evidence, critical all pass, no open critical fault
- WATCH: noncritical issue หรือ overdue ภายใน grace 7 วัน
- DOWN: critical fail หรือ open critical fault
- UNKNOWN: missing/unapproved baseline, insufficient data หรือเลย grace

Precedence DOWN > UNKNOWN > WATCH > READY ตามเงื่อนไข ทุก transition สร้าง immutable ReadinessSnapshot + reason/source

Critical initial set: SOS button, confirmation signal, microphone, speaker/two-way audio, required camera/recording, network/VoIP, operating power

## Workflow

DRAFT -> PUBLISHED/ASSIGNED -> IN_PROGRESS -> SUBMITTED -> CLOSED; รองรับ REJECTED/REOPENED/CANCELLED ตามสิทธิ์ ห้ามลบ closed work/evidence ให้ correction/reopen พร้อม audit

## Acceptance

Seed 27 จุดตรง master prompt; UAT 11 scenarios ผ่าน; ไม่มี paid core dependency; production workflows ไม่มี mock; คู่มือ install/upgrade/backup/restore/troubleshoot และคู่มือ 4 roles ครบ
