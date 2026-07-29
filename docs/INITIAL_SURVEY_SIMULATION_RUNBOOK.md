# Initial Survey Simulation — 2026-07-29

เอกสารนี้เป็น handoff ของการจำลองสำรวจตั้งต้น 27 จุดที่ทำบนเครื่อง office
เป็นฐานข้อมูล local แยกจากระบบเดิมและ production

## ผลที่ตรวจยืนยันแล้ว

| รายการ | ผล |
|---|---:|
| จุดสำรวจ | 27 จุด (`EP01`–`EP27`) |
| ใบงานสำรวจตั้งต้นปิดแล้ว | 27/27 |
| baseline อนุมัติแล้ว | 27/27 |
| ผลตรวจที่บันทึก | 351 รายการ |
| หลักฐานภาพ DEMO | 135 ภาพ (5 ภาพต่อจุด) |
| พร้อมใช้ | 15 |
| เฝ้าระวัง | 5 |
| ใช้งานไม่ได้ | 3 |
| ยังไม่ทราบ | 4 |

สถานการณ์ที่ใช้:

- `EP01`–`EP15`: ผลวิกฤตผ่านทั้งหมด → `READY`
- `EP16`–`EP20`: ข้อขัดข้องที่ไม่วิกฤต → `WATCH` และเกิด `NON_CRITICAL` fault 5 รายการ
- `EP21`–`EP23`: ปุ่ม SOS ไม่ผ่าน → `DOWN` และเกิด `CRITICAL` fault 3 รายการ
- `EP24`–`EP27`: กลุ่มผลวิกฤตตรวจไม่ได้ → `UNKNOWN` ด้วยเหตุ `CRITICAL_RESULT_MISSING`

งานใช้ลำดับจริง `ASSIGNED → IN_PROGRESS → SUBMITTED → CLOSED` โดยช่าง
`สมชาย` เป็นผู้ส่งผล และ Planner/System Admin เป็นผู้ตรวจรับ/อนุมัติ เพื่อทดสอบ
separation of duties ด้วย

## ขอบเขตเครื่อง office

- ฐานข้อมูล: `sos_initial_sim` ใน Docker Postgres local
- เว็บจำลอง: `http://localhost:3110`
- ระบบเดิมที่ `http://localhost:3100` ไม่ถูกหยุดหรือแก้ไข
- production/Neon ไม่ถูกแตะต้อง
- ฐานข้อมูลและไฟล์ภาพ local **ไม่ถูกส่งผ่าน Git**; เมื่อย้ายไปบ้านต้องสร้างใหม่
  หรือใช้ฐานข้อมูล local ของเครื่องบ้านตามขั้นตอนของโปรเจกต์

## สิ่งที่ผลนี้พิสูจน์ / ยังไม่พิสูจน์

ผลนี้พิสูจน์ readiness engine, fault derivation, state transition, baseline
approval, RBAC/SoD และ attachment API ใน workflow จริงได้ระดับหนึ่ง

ยังไม่ถือเป็น QA-01 หรือ CUT-01 เพราะการจำลองใช้ local supplemental groups และ
ยิง API เพื่อสร้างผล/แนบภาพ หลังตรวจ source ปัจจุบันพบว่า
`src/components/PhotoCaptureInput.tsx` ยังไม่มี consumer ใน
`src/components/TodayWorkspace.tsx`; จึงยังต้องเชื่อม UI สำรวจตั้งต้นและทดสอบ
camera/file fallback ใน browser จริงก่อนปิด `UI-03` และ QA-01

## งานถัดไปที่บ้าน

1. `git pull --ff-only`
2. อ่าน `docs/RESUME_HERE.md` และเอกสารนี้
3. ทำ `UI-03` ให้ครบ vertical slice: render capture ตาม `photoPolicy`, upload
   ผ่าน attachment API, ส่ง `attachmentIds` ใน inspection envelope และมี test
   ปฏิเสธเมื่อรูป required หาย
4. รัน `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` และ browser UAT
5. กลับไปทำ QA-01 ตาม `docs/QA-01_EVIDENCE_2026-07-29.md`

อย่าอ้างผลจำลองนี้เป็นการสำรวจเสาจริงของเทศบาล และอย่าใช้ฐานข้อมูลจำลองแทน
หลักฐาน cutover ของเสาจริง
