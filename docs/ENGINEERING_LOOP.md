# Engineering Loop — SOS Maintenance

แนวทางพัฒนาหลักของโปรเจคนี้คือ **sequential engineering loop** วนทีละ vertical
slice ที่วัดผลได้ จนกว่าจะผ่านทั้ง code quality, runtime และ review

## Installed loop skill

ติดตั้งและนำ `codex-claude-loop` มาใช้เป็น operating procedure แล้วที่
`C:\Users\poppa\.agents\skills\codex-claude-loop\SKILL.md`:

- Claude Code รับผิดชอบวางแผนและลงมือใน slice ที่กำหนด
- Codex ตรวจ plan, diff, quality gates, security impact และ runtime evidence
- ทุก slice ต้องมี handoff, review verdict และ checkpoint ก่อนเริ่ม slice ถัดไป

### Initial adoption review — 2026-07-22

**REVIEW: CONDITIONAL PASS** สำหรับ commit `769370b` (internal no-login mode)

- ผ่าน: production API แบบไม่ส่ง Authorization ตอบ 200, validation route ตอบ 400,
  readiness ยังมาจาก DB, และ unit/typecheck/lint/build ผ่าน
- เปิดความเสี่ยง: public Vercel URL ให้สิทธิ์ภายในเต็มรูปแบบตามการตัดสินใจใช้ระบบ
  ภายในแบบไม่มี login ต้องจำกัด network หรือยอมรับ owner-approved exception
- ค้างตรวจ: รัน `pnpm test:integration` หลังการเปลี่ยนโหมด โดยต้องมี
  `DATABASE_URL` ใน environment ของเครื่องที่รัน
- ยังไม่ใช่การประกาศ production complete: workflow UI, dashboard actions และ UAT
  ยังอยู่ใน queue ด้านล่าง

## วงรอบมาตรฐาน

```text
CHECKPOINT
    ↓
DEFINE SLICE + ACCEPTANCE CRITERIA
    ↓
INSPECT CURRENT EVIDENCE
    ↓
IMPLEMENT ONE SMALL CHANGE
    ↓
TEST → TYPECHECK → LINT → BUILD
    ↓
DEPLOY / RUNTIME SMOKE
    ↓
SELF-REVIEW + TEAM REVIEW
    ↓
UPDATE CHECKPOINT + COMMIT/PUSH
    ↓
NEXT SLICE
```

## กติกาของแต่ละรอบ

1. เริ่มจาก `docs/ROADMAP_CHECKPOINT.md` และ commit ล่าสุดเสมอ
2. เลือกงานเพียงหนึ่ง slice พร้อมเกณฑ์ผ่านที่ตรวจได้ เช่น HTTP status,
   จำนวน test, response shape, changed files และ deployment status
3. ตรวจหลักฐานเดิมก่อนแก้ เพื่อไม่วนแก้ปัญหาที่ไม่ได้เป็น root cause
4. แก้โค้ดให้อยู่ในขอบเขตแคบที่สุด และรักษา domain rules เดิม
5. รันตามระดับความเสี่ยง:
   - ทุก code change: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
   - DB/API change: `pnpm test:integration` และ production smoke
   - UI change: browser/a11y smoke และตรวจ workflow จริง
6. Review diff, security impact, migration impact และ rollback ก่อน commit
7. อัปเดต checkpoint ด้วยผลจริงเท่านั้น แล้ว commit/push

## Current queue

| ลำดับ | Slice | Acceptance criteria | สถานะ |
|---:|---|---|---|
| 1 | Internal no-login mode | production API no Authorization → 200; validation ยังทำงาน | DONE |
| 2 | CI pnpm resolution | ลบ `version: 10` ที่ซ้ำ; `quality`+`integration` เขียว | DONE (run 29977349490, `8ae02f9`) |
| 3 | Post-change DB integration | integration suite ผ่านหลัง internal-mode change | DONE (41/41, 8 files, ephemeral PostGIS) |
| 4 | Safe test env + guarded demo fixture | จัดเตรียม local/staging DB; demo work order ที่ production-safe และมี guard ชัดเจน; ห้ามเขียนลง production | DONE (local Docker PostGIS healthy; `pnpm db:seed:demo` fail-closed, local-`sos`-only, idempotent) |
| 5 | Workflow UI `/today` UAT | ด้วย fixture บน non-production DB: start → checklist/GPS → submit → `SUBMITTED` | DONE (happy path) — browser UAT บน `localhost:3100/today` ผ่าน; ยังเหลือ dashboard actions / offline / QR / photo |
| 6 | GPS >100m mandatory reason | wiring DTO/service/UI + tests (คอลัมน์ `ChecklistResponse.locationReason` มีอยู่แล้ว) → ปิด UAT case 8 | OPEN / NEXT (gap ยืนยันแล้ว) |
| 7 | Dashboard actions | dashboard เรียกข้อมูล DB และเปิดรายละเอียด/งานได้จริง | QUEUED |
| 8 | Security boundary | Vercel URL จำกัดเครือข่าย หรือบันทึก owner-approved exception | OPEN |
| 9 | UAT/review | QA/UAT, rollback และ review ผ่านก่อนประกาศ complete | BLOCKED UNTIL 4–8 |

### Current slice review — 2026-07-22

**REVIEW: CONDITIONAL PASS** สำหรับ Workflow UI `/today` ก่อน production smoke

- เพิ่ม `TodayWorkspace` ให้โหลด bootstrap, แสดงใบงานจริง, เริ่มงานผ่าน state
  machine, อ่าน GPS, ส่ง checklist envelope พร้อม SHA-256 และเปลี่ยนเป็น `SUBMITTED`
- ใช้ `mutationId` เดิมเมื่อ retry หลัง evidence write สำเร็จแต่ transition ยังไม่ผ่าน
  จึงไม่สร้าง checklist evidence ซ้ำจากการกดซ้ำโดยไม่ตั้งใจ
- production shell/API smoke ผ่าน: `/today` 200 พร้อม shell ใหม่,
  `/api/sync/bootstrap` 200 และ `/api/readiness/overview` 200 (`source=db`, 27 จุด)
- ยังไม่ปิด slice: production มี open work order = 0 จึงยังไม่มี fixture ให้กด
  start/submit ใน browser จริง และ `pnpm test:integration` ต้องรันบนเครื่องที่มี
  `DATABASE_URL`
- ขอบเขตที่ยังไม่ทำใน slice นี้: QR scan, IndexedDB offline mutation queue,
  photo attachment และ dashboard actions

### Current slice review — 2026-07-23 (guarded demo fixture + `/today` UAT)

**REVIEW: PASS (happy path)** สำหรับ queue item 4 (fixture) และ item 5 (`/today` UAT)

- Local Docker Desktop + PostGIS ใช้งานได้บนเครื่องนี้แล้ว; `pnpm db:seed:demo` เป็น
  fail-closed (guard ตรวจ `LOCAL_DEMO_CONFIRM`, non-production, loopback host,
  db=`sos` ก่อนต่อ Prisma) และ idempotent — รันครั้งแรก `created`, ครั้งที่สอง
  `already present`; ไม่แตะ production/Neon
- Browser UAT บน `http://localhost:3100/today`: demo หนึ่งใบสถานะ ASSIGNED พร้อม
  checklist จริง 10 รายการ; `ASSIGNED→IN_PROGRESS` 200, `POST /api/inspections`
  201, transition → `SUBMITTED` 200, ไม่มี console error
- DB evidence: `WorkOrder.status=SUBMITTED` version 2, 10 `ChecklistResponse` ภายใต้
  `clientMutationId` เดียว, distance 0 m (mock ที่ EP01), 1 `ReadinessSnapshot`
  ค่า `UNKNOWN`, work_log 2 transitions
- หลังส่งผลตรวจ `/today` แสดง open work orders = 0 อย่างถูกต้อง เพราะ bootstrap ตัด
  `SUBMITTED` ออก — ยืนยันความสำเร็จผ่าน API/DB ไม่ใช่ pill ที่ค้างบนหน้าจอ
- Gates: `pnpm test` 182/182 (22 files), `pnpm test:integration` 43/43 (9 files),
  typecheck/lint/build/`git diff --check` exit 0
- ยังไม่ปิด release: GPS >100m mandatory-reason wiring ยังไม่มี (คอลัมน์
  `locationReason` มีอยู่แล้ว, item 6 = NEXT); public Vercel URL ยังเป็น OPEN security
  exception; ต้อง rotate Neon credential ก่อน production. **ไม่ใช่ production-ready**

## Review checklist ก่อนเปลี่ยนเป็น DONE

- สิ่งที่แก้ตรงกับ acceptance criteria และไม่ขยาย scope เงียบ ๆ
- ไม่มี secret/token/cookie/connection string ใน diff, log, chat หรือ clipboard
- domain readiness, idempotency, conflict และ immutable evidence ยังไม่ถูก bypass
- API response และ error status ถูกต้องทั้ง success/validation/failure
- tests ผ่านพร้อมจำนวนและ exit code
- deployment ที่ตรวจเป็น commit เดียวกับที่ review
- มี runtime smoke ไม่ใช่แค่ build ผ่าน
- checkpoint และ worklog ระบุ blocker ที่เหลืออย่างตรงไปตรงมา

## Recovery เมื่อ loop ติด

- ห้าม retry คำสั่งเดิมซ้ำโดยไม่มีข้อมูลใหม่
- แยก failing unit ให้เล็กลง และบันทึก error ที่แท้จริง
- ถ้าพบ root cause เดิมซ้ำ ให้ freeze loop และรายงาน `BLOCKER`
- ลด scope ไปยัง slice ที่ทำให้ progress กลับมาวัดได้
- ห้ามเปลี่ยนสถานะเป็น DONE เพื่อให้ loop จบ

## รูปแบบรายงานทีม

```text
FACT: หลักฐานล่าสุดและ commit/deployment ที่ตรวจ
DECISION: DONE / IN PROGRESS / BLOCKED
NEXT: slice ถัดไปที่ทำได้ทันที
BLOCKER: สิ่งที่ต้องการหรือ root cause ที่ยังค้าง
EVIDENCE: tests, HTTP status, browser smoke, changed files, exit code
REVIEW: จุดเสี่ยงหรือข้อสังเกตจากการทบทวน
```
