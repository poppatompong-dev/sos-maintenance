# Go-Live Handoff — แผนทำงานกับทีม

เอกสารนี้ใช้เป็นแผนปฏิบัติการสำหรับช่วงก่อนเจ้าของโปรเจคกลับบ้าน และเป็น
handoff ให้ทีมทำงานต่อโดยไม่ต้องรอเจ้าของหน้าจอ

**Checkpoint อ้างอิง:** [`ROADMAP_CHECKPOINT.md`](ROADMAP_CHECKPOINT.md)  
**Commit ล่าสุดที่ตรวจ:** `43f310c`  
**Production:** https://sos-maintenance-vert.vercel.app  
**สถานะตั้งต้น:** `INTERNAL MODE IN PROGRESS` หลัง owner เลือกตัด login; ต้อง redeploy/smoke test

## เป้าหมาย

เป้าหมายคือให้ผู้ใช้จริง login ได้และทำงานหลักได้บน production พร้อมหลักฐาน
runtime ไม่ใช่เพียงหน้าเว็บ render หรือ build ผ่าน

## แผน 30 นาทีสุดท้ายก่อนกลับบ้าน

### นาที 0–5: ยืนยันสถานะและรักษาความปลอดภัย

- ทีมตรวจ `git status`, commit ล่าสุด และ Vercel deployment ล่าสุด
- ห้ามเปลี่ยน `AUTH_DEV_BYPASS` เป็น `true`
- ห้ามส่ง connection string, secret, token หรือ cookie ในแชต
- ห้ามหมุน/แก้ secret ผ่านช่อง Note หรือช่องที่ไม่ใช่ Value
- ถ้าพบรหัสผ่าน DB เคยแสดงบนหน้าจอ ให้บันทึกเป็น security blocker และหมุนภายหลังผ่านช่องทางปลอดภัย

### นาที 5–15: เปิดโหมด internal ตามคำสั่งเจ้าของ

ตั้งค่าใน Vercel Production:

- `AUTH_MODE=internal`

ไม่ต้องตั้ง Keycloak และไม่ต้องมี login ตาม owner decision ล่าสุด แต่ต้องบันทึกว่า
ทุก request จะใช้ internal operator และมีสิทธิ์เต็ม

### นาที 15–25: ตรวจด้วย runtime evidence

หลังตั้งค่าแล้วต้อง redeploy และตรวจตามลำดับ:

1. `GET /` → `200`
2. `GET /api/readiness/overview` โดยไม่ login → `200`
3. `GET /api/sync/bootstrap` โดยไม่ login → `200`
4. ตรวจ validation, idempotency และ state transition ตาม domain rules
5. ตรวจ deployment status และ log โดยไม่เปิด secret

ถ้า deployment ยังเป็น public URL โดยไม่มี network boundary ให้คงสถานะ
`SECURITY_EXCEPTION` แม้ API จะตอบ `200`

### นาที 25–30: ส่ง handoff checkpoint

ทีมต้องส่งข้อความสรุปสั้น ๆ ตามแบบนี้:

```text
FACT: commit/deployment/endpoint ที่ตรวจล่าสุด
DECISION: DONE หรือ BLOCKED เท่านั้น พร้อมเหตุผล
NEXT: งานถัดไปที่ทำต่อได้ทันที
BLOCKER: สิ่งที่ต้องการจากเจ้าของบัญชีหรือระบบภายนอก
EVIDENCE: test totals, HTTP status, deployment status, changed files
SECURITY: ยืนยันว่าไม่มี secret/token/cookie อยู่ในข้อความหรือ commit
```

## งานหลังเจ้าของกลับบ้าน

ทีมทำต่อได้เองในขอบเขตนี้:

1. ตั้ง `AUTH_MODE=internal` และ redeploy
2. ทำ no-login smoke test, validation และ domain/state-machine test
3. ต่อ workflow ที่ยังเป็น shell: `/today`, dashboard action, inspection, sync,
   fault และ work-order transition
4. รัน quality gate ทุกครั้งหลังแก้โค้ด:
   `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
5. อัปเดต `ROADMAP_CHECKPOINT.md` และ `WORKLOG.md` พร้อมหลักฐานจริง
6. commit/push เฉพาะการเปลี่ยนแปลงที่ตรวจแล้ว

## เกณฑ์หยุดงานและแจ้งเจ้าของทันที

- deployment ยังไม่มี `AUTH_MODE=internal`
- API ยัง `401` หลัง redeploy internal mode
- public URL ถูกเปิดโดยไม่มี network boundary และยังไม่มี owner decision บันทึก exception
- DB migration/cron ล้มเหลว
- มี secret หลุดในแชต, log, Note, clipboard หรือ commit
- build ผ่านแต่ workflow จริงยังทำงานไม่ได้

## Definition of Done

ยังห้ามประกาศว่า “ใช้งานได้จริง” จนกว่าจะมีครบ:

- login OIDC/TOTP จริง
- readiness และ sync API ตอบ `200` หลัง login
- RBAC/object authorization ผ่านทั้งกรณีอนุญาตและปฏิเสธ
- สร้างและส่งผลตรวจ รวมถึง flow งานซ่อม ได้จริง
- offline sync ป้องกัน duplicate และ conflict แบบไม่ทับเงียบ
- test, integration, typecheck, lint, build ผ่าน
- production smoke และ QA/UAT ตาม `docs/spec/06_DELIVERY_QA_UAT.md` ผ่าน
- มี rollback checkpoint และไม่มี secret ใน Git/log/chat
