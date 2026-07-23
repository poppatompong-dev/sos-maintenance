# Codex Session Handoff — 2026-07-23

ใช้ไฟล์นี้เมื่อเปิด Codex session ใหม่ หรือย้ายไปใช้บัญชี Codex อื่น
แหล่งความจริงของงานคือ GitHub repository ไม่ใช่บทสนทนาเดิม

## เปิด session ใหม่ใน repo เดิม

```powershell
cd D:\sos-maintenance
git pull --ff-only
git status --short --branch
Get-Content docs\RESUME_HERE.md
Get-Content docs\HANDOFF_CLAUDE.md
Get-Content docs\ROADMAP_CHECKPOINT.md
Get-Content docs\ENGINEERING_LOOP.md
```

จากนั้นให้สรุปด้วยรูปแบบ `FACT / DECISION / NEXT / BLOCKER / EVIDENCE / REVIEW`
ก่อนลงมือ และทำงานทีละ vertical slice ตาม `codex-claude-loop`.

## สถานะที่ต้องรับช่วง

- Branch `main` ล่าสุดก่อนเอกสารนี้: `8ae02f9`; worktree ต้องสะอาดก่อนเริ่ม
- Production no-login internal mode ทำงานแล้ว; `/today`, bootstrap, readiness และ
  assets smoke ผ่าน
- `/today` ต่อ workflow จริงแล้ว แต่ production ยังไม่มี open work-order fixture
- Local quality ล่าสุด: 167/167 tests, typecheck, lint, build และ diff check ผ่าน
- **CI pnpm mismatch: แก้แล้ว (DONE)** — ลบ `version: 10` ที่ซ้ำใน `ci.yml`;
  `quality`+`integration` เขียว, integration **41/41 (8 files)** บน ephemeral
  PostGIS (Actions run 29977349490)
- **เครื่องนี้ไม่มี Docker/psql** — hands-on `/today` UAT ต้องใช้ local/staging DB
  ที่ควบคุมได้ และห้ามสร้างใบงานปลอมใน production
- **GPS >100m gap:** review flag มี แต่ mandatory reason ยังไม่มีใน schema/payload/UI
  → UAT case 8 ยังไม่ผ่าน
- ห้ามประกาศ production complete จนกว่าจะมี CI/runtime/UAT evidence ครบ

## หากเปลี่ยนบัญชี Codex

แนะนำให้เปลี่ยนหลังจากบันทึกและ push checkpoint แล้วเท่านั้น การเปลี่ยนบัญชีไม่ควร
เปลี่ยน code, GitHub repository, Vercel project หรือ Neon database เอง แต่ session/chat
context, สิทธิ์เข้าถึง repo และการตั้งค่าเฉพาะบัญชีอาจไม่ติดตามไป จึงต้องตรวจซ้ำ:

1. ใช้บัญชี GitHub ที่เข้าถึง private repo `poppatompong-dev/sos-maintenance` ได้
   และตรวจด้วย `gh auth status` หรือยืนยันว่า `git pull` สำเร็จ
2. เปิด Codex ที่ `D:\sos-maintenance` ไม่สร้าง repo/worktree ใหม่โดยไม่จำเป็น
3. ตรวจว่ามองเห็น skill `codex-claude-loop` ที่
   `C:\Users\poppa\.agents\skills\codex-claude-loop\SKILL.md`; หากใช้ Windows
   profile/บัญชีผู้ใช้คนละตัว ต้องติดตั้ง skill ใน profile นั้นใหม่
4. อ่านเอกสารชุดนี้ก่อนคุยกับ Claude และส่งต่อ `docs/HANDOFF_CLAUDE.md`
5. ห้ามคัดลอก `DATABASE_URL`, Neon password, token หรือ cookie ไปยังบัญชีใหม่/แชต
   ใหม่ ให้ใช้ environment หรือ secret manager ที่ปลอดภัยเท่านั้น

## สิ่งที่ไม่ควรทำตอนย้ายบัญชี

- ไม่รัน `git reset --hard`, ไม่ลบ `.env` ของเครื่องเดิม และไม่ลบข้อมูล production
- ไม่สร้างใบงานปลอมใน production เพียงเพื่อทำ browser UAT
- ไม่เปิด `AUTH_DEV_BYPASS=true` เพื่อแก้ blocker production
- ไม่ใช้ Neon production URL เป็นฐานทดสอบ integration อัตโนมัติ; CI มี PostGIS
  container ชั่วคราวให้ใช้ก่อน

## จุดเริ่มงานถัดไป

CI pnpm mismatch และ post-change DB integration = **DONE** แล้ว (บันทึกใน
`ROADMAP_CHECKPOINT.md`). งานถัดไป: **จัดเตรียม safe test environment และ implement
demo fixture ที่ production-safe และมี guard ชัดเจน** ก่อนให้เจ้าของทดสอบ `/today`
(ยังไม่ได้ทำ) — ห้ามสร้างใบงานปลอมใน production; แล้วปิดช่องว่าง GPS >100m mandatory
reason เพื่อให้ UAT case 8 ผ่าน
