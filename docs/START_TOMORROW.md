# ☀️ เริ่ม session ถัดไป — SOS Maintenance

สรุปสั้น ๆ ก่อนเริ่ม แล้วมี **คำสั่งพร้อมใช้หนึ่งชุด** ให้คัดลอกไปวางได้เลยด้านล่าง

> **Checkpoint ปัจจุบัน (2026-07-23, ปิดวัน):**
> - Design ของ **flexible field checklist** ได้รับ **owner approval** และ
>   **implementation plan เสร็จสมบูรณ์** แล้ว — แต่ **ยังไม่เริ่ม implement**
>   (งานวันนี้เป็น docs-only เท่านั้น ไม่มีการรัน runtime test)
> - **slice ถัดไป = flexible field checklist** (ทำก่อน) แล้วจึงกลับไป GPS >100m reason
> - Repo (private): **https://github.com/poppatompong-dev/sos-maintenance** — branch `main`

## เอกสารที่ต้องอ่านก่อนลงมือ (ตามลำดับ)
1. `AGENTS.md` (กติกาโปรเจกต์ที่บังคับใช้)
2. `docs/RESUME_HERE.md` (สถานะปัจจุบัน + ลำดับงานถัดไป)
3. `docs/WORKLOG.md` (ประวัติ + เหตุผลการตัดสินใจ)
4. **Approved design:** `docs/superpowers/specs/2026-07-23-flexible-field-checklist-design.md`
5. **Implementation plan (execute จาก Task 1):** `docs/superpowers/plans/2026-07-23-flexible-field-checklist.md`

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
3. อ่านให้ครบก่อนแตะโค้ด: AGENTS.md, docs/RESUME_HERE.md, docs/WORKLOG.md,
   approved design (docs/superpowers/specs/2026-07-23-flexible-field-checklist-design.md),
   และ implementation plan (docs/superpowers/plans/2026-07-23-flexible-field-checklist.md)

งานหลัก:
- Execute แผน docs/superpowers/plans/2026-07-23-flexible-field-checklist.md ตั้งแต่ Task 1 ไปตามลำดับ
- ทำแบบ test-first (red → green → refactor), commit เป็น small vertical slice, ให้ Codex review คั่นระหว่าง task ที่มีความหมาย
- ยึดกติกาโปรเจกต์ปัจจุบัน (AGENTS.md) และอ่าน Next.js local docs ใน node_modules/next/dist/docs/ ก่อนเขียนโค้ด Next.js

สภาพแวดล้อม (บังคับ):
- ใช้ local Docker/PostGIS เท่านั้น ห้ามแตะ production/Neon
- integration/migration shell: ปล่อย AUTH_MODE และ AUTH_DEV_BYPASS ว่างไว้ (ให้ test ตั้ง auth เอง)
- browser/demo shell: ใช้ approved internal mode ได้ (AUTH_MODE=internal + LOCAL_DEMO_CONFIRM=SOS_LOCAL_DEMO)
- แอปใช้ port 3100 เท่านั้น (port 3000 เป็นของ thai-memo-app ที่ไม่เกี่ยวข้อง ห้ามแตะ)
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
- รัน gate ครบตาม Task 16: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`,
  และ `pnpm test:integration` — บันทึก exit code และยอด pass/fail ที่ได้จริง
- เมื่อ gate เขียวทั้งหมด ค่อย commit (ต้องมี trailer: Co-Authored-By: Claude <noreply@anthropic.com>) แล้ว push

รายงานปิดท้ายแบบกระชับ FACT / DECISION / NEXT / BLOCKER พร้อม:
ไฟล์ที่เปลี่ยน, คำสั่งที่รัน, ยอด pass/fail, exit code, เฉพาะ suite ที่ fail หรือที่เพิ่งเพิ่มใหม่,
commit SHA และสถานะการ push
```

---

_ถ้าเพิ่งเปิดเครื่องใหม่: ติดตั้ง Node 22 LTS, `corepack enable` (ได้ pnpm), Git + `gh`,
และ Docker Desktop (จำเป็นเฉพาะงาน DB) แล้ว `gh auth login` เป็นบัญชี `poppatompong-dev`
ก่อน clone repo — รายละเอียดอยู่ใน `docs/DEVELOPING.md`._
