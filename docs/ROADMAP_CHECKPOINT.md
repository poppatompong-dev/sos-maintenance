# SOS Maintenance — Roadmap Checkpoint

เอกสารนี้คือจุดตรวจความคืบหน้าหลักของโปรเจค เปิดดูได้จาก GitHub ที่
`docs/ROADMAP_CHECKPOINT.md` และต้องอัปเดตทุกครั้งที่สถานะของ milestone หรือ
หลักฐานการทดสอบเปลี่ยนแปลง

**สถานะล่าสุดที่ตรวจจริง:** 2026-07-22 (Asia/Bangkok)  
**Production URL:** https://sos-maintenance-vert.vercel.app  
**Repository:** https://github.com/poppatompong-dev/sos-maintenance  
**Branch:** `main`

## สรุปสำหรับผู้บริหาร

**สถานะรวม: BLOCKED — ยังไม่พร้อมใช้งานจริงสำหรับผู้ใช้**

ส่วนแกนธุรกิจ ฐานข้อมูล และการ deploy ของ shell ผ่านแล้ว แต่ production API ที่
ผู้ใช้ต้องใช้จริงยังตอบ `401 Unauthorized` เพราะยังไม่มี Keycloak OIDC ที่เข้าถึง
จากอินเทอร์เน็ตและค่า client ของ production นอกจากนี้หน้า `/today` ยังเป็น UI shell
บางส่วน ปุ่มเริ่มงาน/เมนูบางรายการยังไม่มี workflow จริง

ห้ามแก้ blocker นี้ด้วย `AUTH_DEV_BYPASS=true` ใน production

## Checkpoint ตาม milestone

| Milestone | สถานะ | หลักฐานล่าสุด | เงื่อนไขปิดงาน |
|---|---|---|---|
| Sprint 1 — Foundation | DONE | Next.js, Prisma schema, PostGIS, seed 27 จุด, CI และ ADR อยู่ใน repo | ไม่มีงานค้างในขอบเขต sprint |
| Sprint 2 — Domain layer | DONE | readiness, RBAC, work state machine, GPS, sync และ metrics มี unit tests | กฎธุรกิจต้องคง pure และมี tests |
| Sprint 3 — UI/PWA shell | PARTIAL | `/`, `/today`, `/offline` ตอบ 200; manifest/service worker ใช้งานได้ | ปุ่มและ navigation ต้องเชื่อม workflow จริง |
| Sprint 4 — DB wiring | DONE | Neon migration, PostGIS, seed และ Prisma adapter ผ่าน | integration suite ต้องผ่าน |
| Sprint 5 — Auth/RBAC | BLOCKED | API readiness และ sync ตอบ 401 บน production; ยังไม่มี live Keycloak env | login OIDC/TOTP, JWT, RBAC/object authorization ผ่าน e2e |
| Sprint 6 — REST/API | PARTIAL | routes และ integration tests ผ่าน; production ยังเรียก API ไม่ได้เมื่อไม่มี login | authenticated API smoke ผ่านทุก critical route |
| Vercel deployment | PARTIAL | public shell 200; authorized cron smoke 200 | redeploy หลัง env ครบ และ smoke ผ่านโดยผู้ใช้จริง |
| Security release gate | BLOCKED | ต้อง rotate Neon credential อีกครั้งก่อน production | secret rotation, no secret in Git/logs, rollback evidence |
| QA/UAT release gate | BLOCKED | ยังติด Auth และ workflow UI | `docs/spec/06_DELIVERY_QA_UAT.md` ผ่านครบทุกข้อ |

## หลักฐาน runtime ล่าสุด

ผลนี้เป็นหลักฐานจาก production ที่ตรวจแล้ว ไม่ใช่ผลจาก build อย่างเดียว

| Probe | ผล | ความหมาย |
|---|---:|---|
| `GET /` | 200 | dashboard shell render ได้ |
| `GET /today` | 200 | technician shell render ได้ |
| `GET /work-orders` | 200 | work-order shell render ได้ |
| `GET /offline` | 200 | offline fallback render ได้ |
| `GET /api/readiness/overview` | 401 | ยังไม่มี authenticated production session |
| `GET /api/sync/bootstrap` | 401 | technician offline bootstrap ยังใช้ไม่ได้ |
| authorized `GET /api/jobs/tick` | 200 | DB/cron runtime ตอบสนองแล้ว |
| unit tests | 166/166 | logic และ server tests ผ่าน |
| integration tests | 41/41, 8 files | DB-backed integration ผ่านกับ Neon |
| typecheck / lint / build / diff check | PASS | quality gate ใน repo ผ่าน |

## งานเร่งด่วนบน critical path

| ลำดับ | งาน | ผู้รับผิดชอบ | สถานะ/หลักฐานที่ต้องส่งกลับ |
|---:|---|---|---|
| 1 | จัดหา/เปิดใช้ Keycloak public instance และ realm `sos` | เจ้าของบัญชี + ทีม | issuer URL, client ID, redirect URL; secret ห้ามส่งในแชต |
| 2 | ตั้ง `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` ใน Vercel Production | ทีม deploy | deployment ID และ env names เท่านั้น |
| 3 | ทำ login OIDC + TOTP และทดสอบ API ด้วย session จริง | ทีมพัฒนา | HTTP status, route, role, ไม่เปิดเผย token/cookie |
| 4 | ต่อปุ่ม `/today`, dashboard actions และ navigation ให้เป็น workflow จริง | ทีมพัฒนา | browser smoke/UAT evidence |
| 5 | หมุน Neon database credential ก่อน release | เจ้าของบัญชี + ทีม deploy | rotation timestamp และ redeploy result; ห้ามบันทึกค่า secret |
| 6 | Redeploy และรัน QA/UAT gate | ทีมทั้งหมด | test totals, smoke results, known issues, rollback point |

## Definition of Done สำหรับ Production

จะไม่รายงานว่า deploy สำเร็จหรือพร้อมใช้งาน จนกว่าจะมีหลักฐานครบดังนี้:

- ผู้ใช้จริง login ผ่าน Keycloak OIDC และ TOTP ได้
- role ที่ไม่อนุญาตได้รับ `403` และผู้ไม่ login ได้ `401`
- readiness overview และ technician bootstrap ตอบ `200` หลัง login
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

## จุดอ้างอิงสำหรับผู้ช่วยคนถัดไป

- เริ่มอ่านไฟล์นี้ก่อน แล้วอ่าน [`RESUME_HERE.md`](RESUME_HERE.md)
- กฎ release อยู่ที่ [`spec/06_DELIVERY_QA_UAT.md`](spec/06_DELIVERY_QA_UAT.md)
- การตั้งค่า production อยู่ที่ [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md)
- ห้าม commit connection string, token, cookie หรือ secret ใด ๆ
