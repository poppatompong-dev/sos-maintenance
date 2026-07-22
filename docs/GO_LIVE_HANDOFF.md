# Go-Live Handoff — แผนทำงานกับทีม

เอกสารนี้ใช้เป็นแผนปฏิบัติการสำหรับช่วงก่อนเจ้าของโปรเจคกลับบ้าน และเป็น
handoff ให้ทีมทำงานต่อโดยไม่ต้องรอเจ้าของหน้าจอ

**Checkpoint อ้างอิง:** [`ROADMAP_CHECKPOINT.md`](ROADMAP_CHECKPOINT.md)  
**Commit ล่าสุดที่ตรวจ:** `43f310c`  
**Production:** https://sos-maintenance-vert.vercel.app  
**สถานะตั้งต้น:** `BLOCKED` ที่ Auth/Keycloak และ workflow UI

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

### นาที 5–15: ปิด Auth blocker ถ้ามีข้อมูลพร้อม

ถ้ามี Keycloak ที่เข้าถึงจากอินเทอร์เน็ต ให้ตั้งค่าใน Vercel Production เฉพาะตัวแปร:

- `KEYCLOAK_ISSUER`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET` (ถ้าเป็น confidential client)

ตั้ง redirect URL ของ client ให้ตรงกับ production URL และทดสอบ login OIDC/TOTP

ถ้ายังไม่มี Keycloak public instance หรือไม่มี client credentials ให้รายงาน
`BLOCKED_EXTERNAL_AUTH` ทันที ห้ามสร้างค่าปลอมและห้ามวนแก้ DB ซ้ำ

### นาที 15–25: ตรวจด้วย runtime evidence

หลังตั้งค่าแล้วต้อง redeploy และตรวจตามลำดับ:

1. `GET /` → `200`
2. login จริงผ่าน Keycloak → ได้ session จริง
3. `GET /api/readiness/overview` หลัง login → `200`
4. `GET /api/sync/bootstrap` ด้วย role technician → `200`
5. role ผิด/ไม่มี session → `401` หรือ `403` ตามกรณี
6. ตรวจ deployment status และ log โดยไม่เปิด secret

ถ้าไม่มี login จริง ให้คงสถานะ `BLOCKED` แม้หน้า shell จะตอบ `200`

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

1. ตรวจและแก้ Auth configuration เมื่อมีค่า Keycloak ผ่านช่องทางปลอดภัย
2. ทำ authenticated smoke test และ RBAC/object authorization test
3. ต่อ workflow ที่ยังเป็น shell: `/today`, dashboard action, inspection, sync,
   fault และ work-order transition
4. รัน quality gate ทุกครั้งหลังแก้โค้ด:
   `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
5. อัปเดต `ROADMAP_CHECKPOINT.md` และ `WORKLOG.md` พร้อมหลักฐานจริง
6. commit/push เฉพาะการเปลี่ยนแปลงที่ตรวจแล้ว

## เกณฑ์หยุดงานและแจ้งเจ้าของทันที

- ไม่มี public Keycloak หรือไม่มี client credentials
- ต้องใช้ `AUTH_DEV_BYPASS=true` เพื่อให้ API ผ่าน
- API ยัง `401` หลัง login จริง
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
