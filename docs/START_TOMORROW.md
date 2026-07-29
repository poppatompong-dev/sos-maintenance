# ☀️ เริ่ม session ถัดไป — SOS Maintenance

สรุปสั้น ๆ ก่อนเริ่ม แล้วมี **คำสั่งพร้อมใช้หนึ่งชุด** ให้คัดลอกไปวางได้เลยด้านล่าง

> **Checkpoint ปัจจุบัน (2026-07-29):**
> - QA-01 ยังเป็น **PARTIAL**; engineering gates ล่าสุดคือ unit 299,
>   integration 80 บน `sos_qa`, typecheck/lint/build และ runtime smoke แบบจำกัด
> - สี่ gap (`ASSET-06`, `RDY-06`, `OPS-05`, `RPT-02`) ถูกบันทึกว่า code-verified
> - `UI-03` ยังต้องเชื่อม `PhotoCaptureInput` เข้ากับ `TodayWorkspace` และ
>   ทดสอบ initial-survey capture ใน browser จริง
> - ผลจำลอง 27 จุดอยู่ใน `docs/INITIAL_SURVEY_SIMULATION_RUNBOOK.md` แต่ฐานข้อมูล
>   จำลองอยู่เฉพาะเครื่อง office และไม่ติดไปกับ Git
> - **ยังห้ามอ้างว่า production-ready** และผลจำลองไม่ใช่การสำรวจเสาจริง
> - Repo (private): **https://github.com/poppatompong-dev/sos-maintenance** — branch `main`

## เอกสารที่ต้องอ่านก่อนลงมือ (ตามลำดับ)
1. `AGENTS.md` (กติกาโปรเจกต์ที่บังคับใช้)
2. `docs/RESUME_HERE.md` (สถานะปัจจุบัน + ลำดับงานถัดไป) — **แหล่งความจริงหลัก**
3. **`docs/DEVELOPMENT_GUIDE.md`** (วิธีลงมือทำ slice ให้ถูกแบบของโปรเจกต์นี้ —
   หลักการที่ห้ามแหกพร้อมเหตุผล, ตัวอย่างจริงครบทุกชั้น, กลยุทธ์การทดสอบ,
   กับดักที่เคยเสียเวลามาแล้ว, เกณฑ์ "เสร็จ", จุดเริ่มของงานที่เหลือ)
   **อ่านก่อนเขียนโค้ด**
4. `docs/WORKLOG.md` (ประวัติ + เหตุผลการตัดสินใจ อ่าน entry 2026-07-29 สองอันบนสุด)
5. `requirements-traceability.csv` (requirement ไหนเสร็จ/ไม่เสร็จ พร้อมหลักฐาน)

> **หมายเหตุ:** flexible field checklist (`docs/superpowers/plans/2026-07-23-…`)
> **ทำเสร็จไปแล้วตั้งแต่ 2026-07-24** — เอกสารนั้นเก็บไว้เป็นประวัติและเป็น
> *ต้นแบบรูปแบบ plan* สำหรับงานใหญ่ (เช่น รายงาน PDF/Excel) เท่านั้น
> **อย่าเอาไป execute ซ้ำ**

## ข้อควรระวังที่พลาดบ่อย
- **Workspace ปัจจุบัน = `D:\sos-maintenance`** (ไม่ใช่ `C:\dev\...` แบบเดิม)
- **แอปใช้ port 3100 เท่านั้น** — port **3000 เป็นของ `thai-memo-app`** ที่ไม่เกี่ยวข้อง **ห้ามแตะ**
- **Docker:** มี volume ทั้ง `db-data` **และ** `keycloak-data` — **ห้าม `docker compose down -v`**
  ถ้าต้อง reset DB ให้ทำตาม **Task 14** (ลบเฉพาะ literal `sos-maintenance_db-data`, ไม่แตะ `keycloak-data`)
- **integration shell** ปล่อย `AUTH_MODE` / `AUTH_DEV_BYPASS` **ว่างไว้** (ให้ test ตั้ง auth เอง);
  **browser/demo shell** ใช้ approved internal mode ได้ (`AUTH_MODE=internal` + `LOCAL_DEMO_CONFIRM=SOS_LOCAL_DEMO`)
- **ห้ามสร้างข้อมูลปลอม, ห้ามแตะ production/Neon, ห้าม print/เก็บ secret**

## กติกาประจำวัน
```powershell
git pull      # ★ ก่อนเริ่มทุกครั้ง
# ... ทำงานตาม plan ...
git add -A && git commit -m "..." && git push   # ★ ก่อนเลิก/ก่อนย้ายเครื่อง
```

---

## 🗣️ คำสั่งพร้อมใช้ (คัดลอกทั้งบล็อกไปวางให้ Claude/Codex session ถัดไป)

```text
คุณกำลังทำงานต่อในโปรเจกต์ SOS Maintenance ที่ D:\sos-maintenance

ขั้นเตรียม:
1. cd D:\sos-maintenance แล้ว `git pull` ก่อนเป็นอย่างแรก
2. ยืนยัน checkpoint สะอาดและ sync แล้ว: `git status --short` ต้องไม่มีอะไรค้าง และ branch main ตรงกับ origin/main
3. อ่านให้ครบก่อนแตะโค้ด: AGENTS.md, docs/RESUME_HERE.md (ตาราง "5 จุด"),
   docs/DEVELOPMENT_GUIDE.md (สำคัญ — วิธีทำ slice, กับดัก, เกณฑ์เสร็จ),
   docs/WORKLOG.md (สอง entry บนสุดของ 2026-07-29), requirements-traceability.csv

งานหลัก:
- ทำ slice ถัดไปตามตารางใน docs/RESUME_HERE.md — ตอนนี้คือ UI-03 integration:
  เชื่อม PhotoCaptureInput กับ initial-survey field groups, อัปโหลดหลักฐานผ่าน
  attachment API, ส่ง attachmentIds ใน inspection envelope และทดสอบ required-photo
  refusal ก่อนกลับไปทำ QA-01
- ทำแบบ test-first (red → green → refactor), commit เป็น small vertical slice
- ยึดกติกาโปรเจกต์ปัจจุบัน (AGENTS.md) และอ่าน Next.js local docs ใน node_modules/next/dist/docs/ ก่อนเขียนโค้ด Next.js
- **ตรวจในแอปจริงเสมอ ไม่ใช่แค่ให้ test เขียว** — วันที่ 2026-07-26 การทดสอบสด
  เจอบั๊กข้อความ (multi-role) ที่ integration test 9 ตัวจับไม่ได้

สภาพแวดล้อม (บังคับ):
- ใช้ local Docker/PostGIS เท่านั้น ห้ามแตะ production/Neon
- integration/migration shell: ปล่อย AUTH_MODE และ AUTH_DEV_BYPASS ว่างไว้ (ให้ test ตั้ง auth เอง)
- browser/demo shell: ใช้ approved internal mode ได้ (AUTH_MODE=internal + LOCAL_DEMO_CONFIRM=SOS_LOCAL_DEMO)
- แอปใช้ port 3100 เท่านั้น (port 3000 เป็นของ thai-memo-app ที่ไม่เกี่ยวข้อง ห้ามแตะ)
- คำสั่งรัน dev ที่ถูกต้องคือ `pnpm dev -p 3100` — **ห้ามใส่ `--`**
  (`pnpm dev -- -p 3100` จะพังด้วย "Invalid project directory provided")
- ไม่มีไฟล์ .env ใน repo ต้อง set เองใน shell เดียวกัน:
  $env:DATABASE_URL = "postgresql://sos:sos@localhost:5432/sos?schema=public"
- ห้าม print หรือเก็บ connection string / secret ใด ๆ

Docker volume safety (บังคับ):
- มี volume ทั้ง db-data และ keycloak-data — ห้าม `docker compose down -v` เด็ดขาด
- ถ้าจำเป็นต้อง reset DB ให้ทำตาม Task 14 แบบ fail-closed: ลบเฉพาะ literal volume 'sos-maintenance_db-data'
  เท่านั้น (stop postgres → rm -f postgres → ตรวจว่ามี volume ชื่อนี้พอดี 1 อัน → docker volume rm → up -d postgres)
  และห้ามลบ sos-maintenance_keycloak-data

หลักการซื่อสัตย์:
- ห้ามสร้างข้อมูลปลอม (คน/สถานะ/พิกัด/ฮาร์ดแวร์)
- อัปเดต docs/WORKLOG.md, docs/RESUME_HERE.md และ checklist ในแผน ด้วย "หลักฐานที่สังเกตจริง" เท่านั้น
  (อย่าอ้างผล test ที่ไม่ได้รัน อย่าอ้างว่าปิด QA/UAT gate)

ปิดงาน:
- รัน gate ครบ: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`,
  และ `pnpm test:integration` — บันทึก exit code และยอด pass/fail ที่ได้จริง
- หลักฐานล่าสุด (2026-07-29): unit 299 ผ่าน / 32 ไฟล์ · integration 80 ผ่าน / 16 ไฟล์
  บนฐานข้อมูล fresh `sos_qa`; ต้องรันซ้ำหลังแก้ UI-03 และอย่าใช้ผลจำลองแทน UAT
- เมื่อ gate เขียวทั้งหมด ค่อย commit (ต้องมี trailer: Co-Authored-By: Claude <noreply@anthropic.com>) แล้ว push

รายงานปิดท้ายแบบกระชับ FACT / DECISION / NEXT / BLOCKER พร้อม:
ไฟล์ที่เปลี่ยน, คำสั่งที่รัน, ยอด pass/fail, exit code, เฉพาะ suite ที่ fail หรือที่เพิ่งเพิ่มใหม่,
commit SHA และสถานะการ push
```

---

_ถ้าเพิ่งเปิดเครื่องใหม่: ติดตั้ง Node 22 LTS, `corepack enable` (ได้ pnpm), Git + `gh`,
และ Docker Desktop (จำเป็นเฉพาะงาน DB) แล้ว `gh auth login` เป็นบัญชี `poppatompong-dev`
ก่อน clone repo — รายละเอียดอยู่ใน `docs/DEVELOPING.md`._
