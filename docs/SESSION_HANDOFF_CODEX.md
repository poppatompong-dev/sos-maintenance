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

- Branch `main` ล่าสุดก่อนเอกสารนี้: `019e453`; worktree ต้องสะอาดก่อนเริ่ม
- Production no-login internal mode ทำงานแล้ว; `/today`, bootstrap, readiness และ
  assets smoke ผ่าน
- `/today` ต่อ workflow จริงแล้ว แต่ production ยังไม่มี open work-order fixture
- Local quality ล่าสุด: 167/167 tests, typecheck, lint, build และ diff check ผ่าน
- CI blocker ล่าสุด: `.github/workflows/ci.yml` ระบุ pnpm `10` ขัดกับ
  `package.json` ที่ pin `pnpm@10.34.5`; แก้ให้ตรงกันแล้วตรวจทั้ง quality/integration
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

แก้ pnpm mismatch ใน CI → รัน quality gates → push → ตรวจ GitHub Actions → บันทึก
ผล integration ใน `ROADMAP_CHECKPOINT.md` แล้วค่อยวางแผน UAT เมื่อมีใบงานจริง
