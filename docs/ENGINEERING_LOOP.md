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
| 2 | Workflow UI `/today` | เริ่มงาน/ส่งผลตรวจ/sync ทำงานจริงบน browser | NEXT |
| 3 | Dashboard actions | dashboard เรียกข้อมูล DB และเปิดรายละเอียด/งานได้จริง | NEXT |
| 4 | Post-change DB integration | integration suite ผ่านหลัง internal-mode change | PENDING |
| 5 | Security boundary | Vercel URL จำกัดเครือข่าย หรือบันทึก owner-approved exception | OPEN |
| 6 | UAT/review | QA/UAT, rollback และ review ผ่านก่อนประกาศ complete | BLOCKED UNTIL 2–5 |

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
