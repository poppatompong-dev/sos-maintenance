# SOS Maintenance — Roadmap Checkpoint

เอกสารนี้คือจุดตรวจความคืบหน้าหลักของโปรเจค เปิดดูได้จาก GitHub ที่
`docs/ROADMAP_CHECKPOINT.md` และต้องอัปเดตทุกครั้งที่สถานะของ milestone หรือ
หลักฐานการทดสอบเปลี่ยนแปลง

**สถานะล่าสุดที่ตรวจจริง:** 2026-07-23 (Asia/Bangkok) — หลัง push `8ae02f9` (CI pnpm fix + integration green)
**Production URL:** https://sos-maintenance-vert.vercel.app  
**Repository:** https://github.com/poppatompong-dev/sos-maintenance  
**Branch:** `main`

## สรุปสำหรับผู้บริหาร

**สถานะรวม: INTERNAL MODE ACTIVE — ตัด login ตามคำสั่งเจ้าของโปรเจคแล้ว และ production smoke ผ่าน**

ส่วนแกนธุรกิจ ฐานข้อมูล และการ deploy ของ shell ผ่านแล้ว เดิม production API ตอบ
`401 Unauthorized` เพราะยังไม่มี Keycloak แต่ owner decision ล่าสุดคือไม่ใช้ login
และให้ระบบทำงานใน `AUTH_MODE=internal` แทน หน้า `/today` ต่อกับ workflow API แล้ว
แต่ deployment ต้องอยู่หลัง network boundary ภายใน เพราะทุก request จะมีสิทธิ์เต็ม

`AUTH_MODE=internal` เป็นโหมดที่ตั้งใจเปิดใช้ตามคำสั่งล่าสุด ไม่ใช่ dev bypass แต่ห้าม
ใช้กับ URL ที่เปิดสาธารณะโดยไม่มี network restriction งาน `/today` เริ่มเชื่อมกับ
bootstrap และ workflow API แล้ว; production shell/API smoke ผ่าน แต่ยังไม่มี open work
order fixture สำหรับทดสอบ happy path ใน browser

## Checkpoint ตาม milestone

| Milestone | สถานะ | หลักฐานล่าสุด | เงื่อนไขปิดงาน |
|---|---|---|---|
| Sprint 1 — Foundation | DONE | Next.js, Prisma schema, PostGIS, seed 27 จุด, CI และ ADR อยู่ใน repo | ไม่มีงานค้างในขอบเขต sprint |
| Sprint 2 — Domain layer | DONE | readiness, RBAC, work state machine, GPS, sync และ metrics มี unit tests | กฎธุรกิจต้องคง pure และมี tests |
| Sprint 3 — UI/PWA shell | IN PROGRESS | `/today` production 200 พร้อม shell ใหม่; client workflow ต่อ bootstrap/start/submit แล้ว | fixture browser/a11y smoke และ offline queue ยังต้องตรวจ |
| Sprint 4 — DB wiring | DONE | integration suite **41/41 (8 files)** ผ่านบน CI ephemeral PostGIS (run 29977349490); Neon migration/PostGIS/seed/Prisma adapter ผ่าน | integration suite ต้องผ่าน — ผ่านแล้ว |
| CI pipeline (pnpm resolution) | DONE | ลบ `version: 10` ที่ซ้ำใน `ci.yml`; `pnpm/action-setup@v4` อ่าน pin `pnpm@10.34.5`; `quality`+`integration` เขียว (run 29977349490) | ทั้งสอง job เขียวโดยไม่ต้องใช้ Neon secret — ผ่านแล้ว |
| Sprint 5 — Auth/RBAC | DEFERRED | owner เลือก no-login internal mode; Keycloak ถูกพักไว้ | network boundary และ internal-mode smoke ผ่าน |
| Sprint 6 — REST/API | PASS WITH SECURITY EXCEPTION | routes, integration evidence และ no-login production smoke ผ่าน | authenticated API gate replaced by internal-mode smoke; network boundary remains open |
| Vercel deployment | PASS WITH SECURITY EXCEPTION | latest deployment Ready; no-login API smoke ผ่าน | ต้องจำกัด network หรือยอมรับ public exposure เป็น security exception |
| Security release gate | BLOCKED | ต้อง rotate Neon credential อีกครั้งก่อน production | secret rotation, no secret in Git/logs, rollback evidence |
| QA/UAT release gate | BLOCKED | ต้องทดสอบ no-login API และ workflow UI | `docs/spec/06_DELIVERY_QA_UAT.md` ผ่านพร้อม exception ที่อนุมัติ |

## หลักฐาน runtime ล่าสุด

ผลนี้เป็นหลักฐานจาก production ที่ตรวจแล้ว ไม่ใช่ผลจาก build อย่างเดียว

| Probe | ผล | ความหมาย |
|---|---:|---|
| `GET /` | 200 | dashboard shell render ได้ |
| `GET /today` | 200 | technician shell render ได้ |
| `GET /work-orders` | 200 | work-order shell render ได้ |
| `GET /offline` | 200 | offline fallback render ได้ |
| `GET /api/readiness/overview` | 200 | no-login smoke ผ่าน; response source `db`, rollup 27 จุด UNKNOWN |
| `GET /api/sync/bootstrap` | 200 | no-login smoke ผ่าน; work package ว่างตามข้อมูลปัจจุบัน |
| `GET /api/assets` | 200 | no-login smoke ผ่าน; 27 assets, first `EP01` |
| `POST /api/inspections` invalid body | 400 | route ผ่าน internal actor แล้ว Zod validation ทำงาน |
| authorized `GET /api/jobs/tick` | 200 | DB/cron runtime ตอบสนองแล้ว |
| unit tests | 167/167, 21 files | logic และ server tests ผ่านหลัง internal-mode change |
| integration tests | 41/41, 8 files | DB-backed integration **เขียวบน CI** ephemeral PostGIS (run 29977349490, 3.89s); post-change rerun ยืนยันแล้ว |
| CI quality / integration jobs | success (47s / 1m0s) | GitHub Actions run 29977349490, commit `8ae02f9` — pnpm resolution fixed |
| typecheck / lint / build / diff check | PASS (exit 0) | quality gate ใน repo ผ่าน |

## งานเร่งด่วนบน critical path

| ลำดับ | งาน | ผู้รับผิดชอบ | สถานะ/หลักฐานที่ต้องส่งกลับ |
|---:|---|---|---|
| 1 | ตั้ง `AUTH_MODE=internal` ใน Vercel Production | ทีม deploy | DONE; env เก่า `AUTH_DEV_BYPASS`/`AUTH_SECRET` ถูกนำออก |
| 2 | ยืนยัน network boundary ของ URL ที่จะใช้งานภายใน | เจ้าของบัญชี + ทีม | OPEN SECURITY EXCEPTION; Vercel URL ยัง public |
| 3 | ทดสอบ API/readiness/sync โดยไม่ login | ทีมพัฒนา | DONE; HTTP 200/400 และ response shape ผ่าน |
| 4 | ปิด Workflow UI `/today` และต่อ dashboard actions/navigation | ทีมพัฒนา | `/today`/bootstrap/readiness production smoke ผ่าน; fixture browser/UAT ยังรอใบงานเปิด |
| 5 | หมุน Neon database credential ก่อน release | เจ้าของบัญชี + ทีม deploy | rotation timestamp และ redeploy result; ห้ามบันทึกค่า secret |
| 6 | Redeploy และรัน QA/UAT gate | ทีมทั้งหมด | test totals, smoke results, known issues, rollback point |

## ข้อจำกัดและช่องว่างที่ยืนยันแล้ว (2026-07-23)

- **เครื่องพัฒนาปัจจุบันไม่มี Docker และไม่มี psql** จึงรัน DB ในเครื่องไม่ได้ —
  hands-on `/today` workflow UAT ยังต้องใช้ local/staging DB ที่ควบคุมได้ และ
  **ห้ามสร้างใบงานปลอมใน production** เพื่อทดสอบ
- **GPS >100m mandatory reason ยังไม่มี:** review flag ทำงาน แต่ *เหตุผลบังคับ*
  เมื่อพิกัดห่างจากเสา >100m ยังไม่ถูกแทนใน schema/payload/UI → **UAT case 8 ใน
  `docs/spec/06` ยังไม่ผ่าน**; ห้ามประกาศ QA/UAT DONE จนกว่าจะปิดช่องว่างนี้พร้อม test
- **Next slice = จัดเตรียม safe test environment + demo fixture ที่ production-safe
  และมี guard ชัดเจน** ก่อนเจ้าของทดสอบ `/today` — **ยังไม่ได้ทำ** อย่ารายงานว่าเสร็จ
- **คงเดิม:** `AUTH_MODE=internal` เป็น owner-approved แต่การเปิด **public Vercel URL
  ยังเป็น OPEN security exception** (ยังไม่ได้รับ owner acceptance) — ทุก caller ได้สิทธิ์
  เต็ม ต้องจำกัด network หรือให้ owner ยอมรับอย่างชัดเจนในภายหลัง; และต้อง **rotate Neon
  credential** ก่อน release

## Definition of Done สำหรับ Production

จะไม่รายงานว่า deploy สำเร็จหรือพร้อมใช้งาน จนกว่าจะมีหลักฐานครบดังนี้:

- no-login internal request เรียก readiness overview และ technician bootstrap ได้ `200`
- network boundary ป้องกันผู้ใช้นอกขอบเขตองค์กร หรือมีการบันทึก exception อย่างชัดเจน
- validation, idempotency, readiness และ state machine ยังทำงานครบ
- สร้าง/ส่งผลตรวจ/สร้าง fault/เปลี่ยนสถานะงานซ่อมได้ครบตามสิทธิ์
- sync ซ้ำไม่สร้างรายการซ้ำ และ conflict ไม่ถูกทับเงียบ ๆ
- dashboard แสดงสถานะจาก DB จริงของ EP01–EP27 พร้อม evidence
- cron และ worker ตรวจได้จาก log/status โดยไม่รั่ว secret
- `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
  ผ่าน
- UAT ตาม `docs/spec/06_DELIVERY_QA_UAT.md` ผ่าน และมี rollback checkpoint

## วิธีดูความคืบหน้า

1. เปิดไฟล์นี้จาก GitHub หรือ clone ล่าสุดแล้วรัน `git pull`
2. ดูหัวข้อ **สรุปสำหรับผู้บริหาร** ก่อน
3. ดูตาราง **Checkpoint ตาม milestone** เพื่อรู้ว่างานติดช่วงใด
4. ดู **หลักฐาน runtime ล่าสุด** เพื่อแยก build ผ่านออกจากใช้งานจริง
5. ดู **งานเร่งด่วนบน critical path** เพื่อรู้ว่าใครต้องทำอะไรต่อ

ทุกการอัปเดตต้องใส่วันที่, ผู้รับผิดชอบ, หลักฐาน, และ blocker ใหม่ในไฟล์นี้หรือ
`docs/WORKLOG.md`; ห้ามเปลี่ยนสถานะเป็น DONE จากการคาดเดา

แผนปฏิบัติการก่อนกลับบ้านและ handoff ให้ทีมอยู่ที่
[`GO_LIVE_HANDOFF.md`](GO_LIVE_HANDOFF.md)

แนวทาง loop engineer ที่ใช้กับทุก slice อยู่ที่
[`ENGINEERING_LOOP.md`](ENGINEERING_LOOP.md)

## จุดอ้างอิงสำหรับผู้ช่วยคนถัดไป

- เริ่มอ่านไฟล์นี้ก่อน แล้วอ่าน [`RESUME_HERE.md`](RESUME_HERE.md)
- กฎ release อยู่ที่ [`spec/06_DELIVERY_QA_UAT.md`](spec/06_DELIVERY_QA_UAT.md)
- การตั้งค่า production อยู่ที่ [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md)
- ห้าม commit connection string, token, cookie หรือ secret ใด ๆ
