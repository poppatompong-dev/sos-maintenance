# ☀️ อ่านตอนเช้า — ทำงานต่อจากที่ไหนก็ได้

สวัสดีตอนเช้าครับ 🙂 สรุปสั้น ๆ ให้สบายใจก่อน:

> **ทำงานต่อได้จากทุกที่ ทุกเครื่อง** — โค้ดและเอกสารทั้งหมดอยู่บน GitHub แล้ว
> (ตรวจแล้ว local = GitHub เป๊ะ ไม่มีอะไรค้างบนเครื่องที่บ้าน) เครื่องที่บ้าน
> **ไม่ต้องเปิดอีกก็ได้**

Repo (ส่วนตัว): **https://github.com/poppatompong-dev/sos-maintenance**

> **Checkpoint ปัจจุบัน (2026-07-23):** เอกสารนี้มี prompt รุ่นเก่าเพื่อเป็นประวัติ
> ให้เริ่มจาก `docs/RESUME_HERE.md` และ `docs/SESSION_HANDOFF_CODEX.md` เสมอ
> งานปัจจุบันอยู่หลัง DB wiring แล้ว: แก้ CI pnpm mismatch และตรวจ UAT ต่อ

---

## อะไร "เดินทาง" ไปกับคุณ / อะไร "ไม่ไป"

| ✅ ไปด้วย (อยู่บน GitHub) | ❌ อยู่กับเครื่องบ้านเท่านั้น |
|---|---|
| โค้ดทั้งหมด, Prisma schema, seed | บทสนทนากับ Claude ในเครื่องนี้ |
| เอกสารทุกไฟล์ (`docs/`) | ความจำโปรเจกต์ของ Claude เครื่องนี้ |
| ประวัติงาน + การตัดสินใจ (WORKLOG) | `node_modules`, `.next`, `.env` (สร้างใหม่ได้) |
| การตั้งค่าเครื่องมือ (pin เวอร์ชัน ฯลฯ) | ฐานข้อมูล dev (สร้างใหม่จาก seed ได้) |

**สำคัญ:** ถ้าเปิด Claude Code ที่เครื่องใหม่ มันจะเป็นห้องแชทใหม่ (ไม่รู้จักงานเดิม)
— แต่ไม่เป็นไร เพราะเอกสารในโปรเจกต์เล่าครบ แค่บอก Claude ว่า
**"อ่าน docs/RESUME_HERE.md และ docs/WORKLOG.md แล้วทำงานต่อ"** เดี๋ยวมันเข้าใจทันที

---

## ตั้งเครื่องใหม่ (ทำครั้งเดียว)

ติดตั้งของพวกนี้ก่อน:
1. **Node.js 22 LTS** — https://nodejs.org
2. **pnpm** — ได้อัตโนมัติด้วย `corepack enable`
3. **Git** + **GitHub CLI (`gh`)** — https://cli.github.com
4. **Docker Desktop** — https://docker.com *(จำเป็นเฉพาะงาน DB ของ Sprint 4; ถ้าแค่เปิดดู UI ยังไม่ต้องมี)*
5. (แนะนำ) **VS Code** — เปิดโปรเจกต์แล้วมันจะแนะนำ extension ให้เอง

**ล็อกอิน GitHub ให้เป็นบัญชีเดิม** (repo เป็น private ของบัญชี `poppatompong-dev`):
```powershell
gh auth login
```
> ถ้าเครื่องใหม่ใช้บัญชี GitHub อื่น จะเข้า repo ไม่ได้ — ต้องเป็น `poppatompong-dev`
> หรือถูกเชิญเป็น collaborator ก่อน

---

## เริ่มทำงาน (คัดลอกไปวางได้เลย)

```powershell
# 1. ดึงโค้ด
git clone https://github.com/poppatompong-dev/sos-maintenance.git C:\dev\sos-maintenance
cd C:\dev\sos-maintenance

# 2. ตั้งค่าอัตโนมัติ (ลง deps + สร้าง .env + ยก Docker ถ้ามี)
pwsh ./scripts/bootstrap.ps1

# 3. เปิดแอปดู (ยังไม่ต้องมี Docker ก็ดู UI ได้)
pnpm dev
#   → http://localhost:3000       หน้าศูนย์ควบคุม (Dashboard A)
#   → http://localhost:3000/today  หน้าเจ้าหน้าที่ภาคสนาม (PWA)

# 4. ยืนยันว่าทุกอย่างปกติ
pnpm test        # ควรได้ 167 ผ่าน
```

---

## กติกาประจำวัน (กันงานหาย เวลาเด้งไปมาหลายเครื่อง)

```powershell
git pull          # ★ ทำก่อนเริ่มงานทุกครั้ง
# ... ทำงาน ...
git add -A && git commit -m "อธิบายสั้น ๆ" && git push   # ★ ทำก่อนเลิก/ก่อนย้ายเครื่อง
```
ขอแค่ **pull ก่อนเริ่ม, push ก่อนเลิก** เท่านั้น งานจะตามคุณไปทุกเครื่องเอง

---

## ตอนนี้อยู่ตรงไหน / ก้าวต่อไป

- เสร็จแล้ว: **Sprint 1 (ฐานราก) + 2 (domain logic) + 3 (UI + PWA)** — 129 tests ผ่าน
- แอปเปิดดูได้จริงที่ `/` และ `/today` (แสดงสถานะจริง: 27 จุดยัง "ยังไม่ทราบ" เพราะยังไม่ได้สำรวจ)
- **ก้าวถัดไปปัจจุบัน:** แก้ pnpm mismatch ใน CI, ตรวจ integration บน PostGIS ชั่วคราว,
  แล้วทำ UAT `/today` เมื่อมีใบงานจริง — รายละเอียดอยู่ใน `docs/RESUME_HERE.md`

ไม่ต้องรีบครับ พักผ่อนให้เต็มที่ งานรออยู่บน GitHub ครบถ้วน 🌙

---

## 🗣️ พรุ่งนี้สั่งอะไร (คำสั่งพร้อมใช้ — คัดลอกไปวางได้เลย)

**เคล็ดลับการสั่งให้ได้งานดี:**
- เปิดหัวทุกครั้งด้วยการให้ Claude อ่านเอกสารก่อน (มันจะเข้าใจงานทันที)
- **สั่งทีละก้อน** (ทีละ Sprint / ทีละ flow) อย่าสั่งรวดเดียวหมด — จะได้ทดสอบ + push เป็นช่วง ๆ
- จบทุกก้อนขอให้ **"ทดสอบให้ผ่าน แล้ว commit + push"** เสมอ

**คำสั่งเปิดหัว (พิมพ์ก่อนเสมอ):**
> "อ่าน `docs/RESUME_HERE.md` และ `docs/WORKLOG.md` ก่อน สรุปให้ฟังว่าตอนนี้อยู่ตรงไหน แล้วรอรับคำสั่งถัดไป"

จากนั้นสั่งตามลำดับนี้ (ก้อนละครั้ง):

**① Sprint 4 — ต่อฐานข้อมูลจริง (ต้องมี Docker ก่อน)**
> "ทำ Sprint 4: ยก Docker, สร้าง migration แรกจาก schema, seed 27 จุด, เขียน Prisma repository ต่อกับ InspectionPort และให้หน้า Dashboard ดึงจาก DB จริง เปิด integration test ใน CI ด้วย ทำให้ test/typecheck/build ผ่านแล้ว commit + push"

**② Sprint 5 — ระบบล็อกอิน + สิทธิ์**
> "ทำ Sprint 5: ต่อ Keycloak (OIDC login + session) และบังคับ RBAC policy ที่มีอยู่แล้วในทุก route/server action ทดสอบว่าแต่ละบทบาทเข้าถึงตามสิทธิ์ แล้ว commit + push"

**③ flow สำรวจตั้งต้น → พร้อมใช้**
> "ทำหน้าสำรวจตั้งต้น (Initial Survey) + สแกน QR + ฟอร์มเช็กลิสต์ ให้ช่างกรอกและส่ง, Planner อนุมัติ baseline, สถานะเสาเปลี่ยนจาก 'ยังไม่ทราบ' เป็น 'พร้อมใช้' ครบวงจร ทดสอบ E2E แล้ว commit + push"

**④ flow ตรวจไม่ผ่าน → ซ่อม → ตรวจรับ**
> "ทำ flow ตรวจไม่ผ่าน: สร้าง Fault + ใบงานซ่อมอัตโนมัติ, แจ้งเตือน DOWN (in-app + email), ช่างซ่อม+retest, Planner ตรวจรับ แล้วสถานะกลับพร้อมใช้ ทดสอบครบ commit + push"

**⑤ ทำงานออฟไลน์จริง**
> "ทำ offline PWA: IndexedDB queue + sync ตาม mutation envelope ที่มีอยู่ ทดสอบ offline→online ไม่ซ้ำ commit + push"

**⑥ รายงาน + แผนที่**
> "ทำรายงาน PDF ภาษาไทย + Excel จาก metric service เดียว และแผนที่ MapLibre (online) พร้อม list fallback commit + push"

**⑦ ปิดงาน (ก่อนส่งมอบ)**
> "รัน UAT 11 ข้อ + security review + backup/restore ตาม docs/spec/06 แล้วสรุปว่าผ่าน release gate หรือยัง"

> ภาพรวมทั้งหมดอ้างอิงแผน 7 เฟสใน `docs/spec/08` — ตอนนี้เฟส 1 เสร็จ, เฟส 2–6 ทำ
> domain logic ไว้แล้วเหลือต่อ DB/UI, เฟส 7 คือ hardening/UAT
