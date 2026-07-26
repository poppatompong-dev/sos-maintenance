# คู่มือพัฒนาต่อ — SOS Maintenance

> เอกสารนี้ตอบคำถามว่า **"จะลงมือทำงานชิ้นถัดไปยังไงให้ถูกแบบของโปรเจกต์นี้"**
> — ต่างจาก [`ARCHITECTURE.md`](ARCHITECTURE.md) ที่ตอบว่า *อะไรอยู่ตรงไหน*
> และต่างจาก [`RESUME_HERE.md`](RESUME_HERE.md) ที่ตอบว่า *ตอนนี้ถึงไหนแล้ว*
>
> ถ้าคุณเพิ่งเข้ามาในโปรเจกต์นี้ อ่านตามลำดับ: `AGENTS.md` →
> [`RESUME_HERE.md`](RESUME_HERE.md) → เอกสารนี้ → [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## 1. หลักการที่ห้ามแหก (และเหตุผลว่าทำไม)

หลักการเหล่านี้ไม่ใช่ความชอบส่วนตัว — มันมาจาก spec และแต่ละข้อมีที่บังคับใช้จริงในโค้ด
ถ้าจะแหก ต้องคุยกับเจ้าของงานก่อน ไม่ใช่ตัดสินใจเอง

### 1.1 ความพร้อมเป็นสิ่งที่ "คำนวณ" ไม่ใช่ "เลือก"
ไม่มีที่ไหนในระบบที่คนกดเลือกได้ว่าเสาต้นนี้ "พร้อมใช้" สถานะต้องออกมาจาก
`evaluateReadiness()` ใน `src/domain/readiness/engine.ts` เสมอ โดยดูจากหลักฐานจริง

**เหตุผล:** ความเสี่ยงอันดับหนึ่งของโครงการนี้คือ *false READY* — เสาที่ระบบบอกว่าพร้อม
แต่จริงๆ กดปุ่ม SOS แล้วไม่มีอะไรเกิดขึ้น (`docs/spec/07`) ถ้ายอมให้คนเลือกสถานะได้
ระบบทั้งระบบก็ไร้ความหมาย

**ผลในทางปฏิบัติ:** ทุกครั้งที่มีอะไรเปลี่ยนซึ่งอาจกระทบความพร้อม คุณต้อง
เรียก engine ใหม่ แล้วเขียน `ReadinessSnapshot` แถวใหม่ (append-only ห้าม update)
ดูตัวอย่างที่ทำถูกได้ที่ `src/server/services/approve-baseline.ts` —
แม้แต่ตอน "อนุมัติ baseline" ซึ่งฟังดูเหมือนควรทำให้เป็น READY
ก็ยัง**คำนวณใหม่** และถ้าฟังก์ชันวิกฤตยังไม่ผ่านก็ออกมาเป็น `DOWN` ตามจริง
(มี unit test ตรึงพฤติกรรมนี้ไว้โดยเฉพาะ — อย่าลบ)

### 1.2 `src/domain` ต้องบริสุทธิ์
ห้าม import Prisma, ห้าม `fetch`, ห้าม Next.js, ห้ามอ่าน `process.env`, ห้ามเรียก
`Date.now()` (ให้รับ `now: Date` เข้ามาเป็น parameter แทน)

**เหตุผล:** กฎธุรกิจต้องเทสต์ได้โดยไม่ต้องมีฐานข้อมูล — unit test 285 ตัวรันจบใน
ไม่ถึงหนึ่งวินาที และรันได้โดยไม่ต้องเปิด Docker เลย ถ้ากฎเริ่มพัวพันกับ IO
เมื่อไหร่ ความเร็วนั้นหายทันที

### 1.3 ห้ามสร้างข้อมูลปลอม
ห้ามใส่ชื่อคนสมมติ, พิกัดสมมติ, สถานะสมมติ, หรือข้อเท็จจริงเรื่องฮาร์ดแวร์ที่ไม่รู้จริง
ถ้ายังไม่มีข้อมูล ให้แสดง "ยังไม่ทราบ" อย่างซื่อสัตย์

**เคสจริง:** ตอนทำ "เลือกช่างที่รับผิดชอบ" งานหยุดรอเจ้าของงานยืนยันชื่อช่างจริง
(**สมชาย**) แทนที่จะใส่ชื่อสมมติไปก่อน — และ API ปฏิเสธ `assigneeUserId`
ที่ไม่มีตัวตนจริงด้วย `ASSIGNEE_INVALID` ก่อนแตะฐานข้อมูล

### 1.4 UI ต้องซื่อสัตย์
ห้ามมีปุ่มที่กดแล้วไม่เกิดอะไร ห้ามมีลิงก์ `href="#"` ห้ามมีปุ่มที่เซิร์ฟเวอร์
รับประกันว่าจะปฏิเสธแน่ๆ — ให้ **อธิบายว่าขาดอะไร** แทน

**ตัวอย่างที่ทำถูก:** `src/components/BaselineApproval.tsx` จะไม่แสดงปุ่มอนุมัติ
ถ้ายังไม่มีใบงานสำรวจตั้งต้น แต่จะขึ้นข้อความว่า
"ยังอนุมัติไม่ได้ — จุดติดตั้งนี้ยังไม่มีใบงานสำรวจตั้งต้น" และเมนูที่ยังไปไหนไม่ได้
ใน `AppRail.tsx` จะ disabled พร้อมป้าย "เร็วๆ นี้" ไม่ใช่ลิงก์ตายเงียบๆ

### 1.5 เซิร์ฟเวอร์คือผู้มีอำนาจตัดสินเสมอ
UI กรองปุ่มให้ดูสมเหตุสมผลได้ แต่ทุกคำขอต้องผ่าน RBAC ฝั่งเซิร์ฟเวอร์
และผ่านกฎ domain อีกชั้น การกรองใน UI คือ UX ไม่ใช่ security

---

## 2. ทิศทางการพึ่งพาของโค้ด

```
src/domain/**          กฎบริสุทธิ์ ไม่รู้จักใครเลย
      ↑
src/server/services/** ประกอบ domain + เรียกผ่าน "port" (interface)
      ↑
src/server/adapters/** implement port ด้วย Prisma
      ↑
src/app/api/**         route: auth → parse → เรียก service → map error
      ↑
src/app/**, components UI
```

ลูกศรชี้ขึ้น = ชั้นล่างไม่รู้จักชั้นบน **ห้ามให้ `domain` รู้จัก `server`
และห้ามให้ `services` รู้จัก Prisma**

`src/server/queries/**` เป็นทางลัดสำหรับ **อ่านอย่างเดียว** (หน้าจอ server component
เรียกตรงได้) การเขียนต้องผ่าน service เสมอ

---

## 3. กายวิภาคของหนึ่ง slice (ตัวอย่างจริง: `ASSET-06` อนุมัติ baseline)

งานชิ้นนี้ทำเสร็จเมื่อ 2026-07-26 และเป็นตัวอย่างที่ครบทุกชั้น
ลอกโครงนี้ไปใช้กับงานชิ้นถัดไปได้เลย

### ขั้น 0 — สำรวจก่อนเขียน (อย่าข้าม)
ก่อนเขียนโค้ดบรรทัดแรก ตอบให้ได้ว่า:
- spec ว่าไว้ยังไง (`docs/spec/` — ลำดับความน่าเชื่อถือดูใน `docs/README.md`)
- schema มีฟิลด์รองรับอยู่แล้วหรือยัง
- policy มี permission ไว้แล้วหรือยัง
- enum ที่ต้องใช้มีอยู่แล้วหรือยัง

**ในเคสนี้พบว่า repo เตรียมไว้ให้เกือบหมดแล้ว:** `spec/08` บรรยาย flow ไว้ชัด,
policy มี `survey:approve` (Planner) กับ `survey:submit` (ช่าง) รออยู่โดยยังไม่มีใครใช้,
schema มี `baselineApprovedAt` / `baselineApproverId` / relation `BaselineApprover`,
และ `ReadinessTrigger` มีค่า `BASELINE_APPROVED` อยู่แล้ว → **ไม่ต้องทำ migration เลย**

การสำรวจ 15 นาทีนี้ประหยัดเวลาไปมาก และทำให้ไม่ต้องเดาว่าจะออกแบบยังไง

### ขั้น 1 — กฎบริสุทธิ์ใน `src/domain` (เขียนเทสต์ก่อน)
```
src/domain/asset/baseline.ts        ← กฎ
src/domain/asset/baseline.test.ts   ← 14 เทสต์
src/domain/asset/index.ts           ← re-export (ทุก module ทำแบบนี้)
```

รูปแบบที่ใช้ทั้งโปรเจกต์: ฟังก์ชันบริสุทธิ์รับ "ข้อเท็จจริง" เข้าไป
แล้วคืน decision object ไม่ throw
```ts
export function canApproveBaseline(ctx): BaselineApprovalDecision
// → { allowed: true } หรือ { allowed: false, code, reason }
```

**สิ่งที่ decision ต้องมีเสมอ:**
- `code` — enum ให้เครื่องอ่าน (map เป็น HTTP status ได้)
- `reason` — ข้อความไทยให้คนอ่าน **ห้ามโชว์ enum ดิบให้ผู้ใช้เห็น**
  (มีเทสต์ตรวจว่าทุกคำปฏิเสธมีอักษรไทยจริง)

**หลักคิดสำคัญ — ไม่แน่ใจให้ปฏิเสธ (fail closed):** ถ้าไม่รู้ว่าใครเป็นคนส่ง
ใบงานสำรวจ ระบบ**ปฏิเสธ** (`SUBMITTER_UNKNOWN`) แทนที่จะปล่อยผ่านเงียบๆ
เพราะพิสูจน์การแยกหน้าที่ไม่ได้

### ขั้น 2 — service + port ใน `src/server/services`
```
approve-baseline.ts       ← ประกอบ domain + เรียก port
approve-baseline.test.ts  ← 16 เทสต์ ใช้ in-memory port
```

โครงที่ใช้ซ้ำได้:
```ts
export interface ApproveBaselinePort {          // 1. นิยาม port
  loadByCode(code): Promise<State | null>;
  persist(input): Promise<void>;
}
export class BaselineApprovalError extends Error { readonly code: string }  // 2. error มี code

export async function approveBaseline(port, cmd) {
  assertCan(cmd.actor.roles, 'survey:approve');   // 3. RBAC ก่อนโหลดอะไรทั้งสิ้น
  const asset = await port.loadByCode(cmd.code);  // 4. โหลดข้อเท็จจริง
  // 5. ตัดสินด้วย domain
  // 6. คำนวณความพร้อมใหม่
  await port.persist({ ... });                    // 7. ให้ adapter จัดการ atomicity
}
```

**ลำดับสำคัญ:** `assertCan` ต้องมาก่อนการโหลดข้อมูล — เพื่อไม่ให้คนที่ไม่มีสิทธิ์
เดาการมีอยู่ของข้อมูลจากความต่างของ error หรือเวลาตอบกลับ
(มีเทสต์ตรวจว่า `port.loadByCode` ไม่ถูกเรียกเลยเมื่อไม่มีสิทธิ์)

**กับดักที่เคยพลาดจริง — วนลูป role:** ผู้ใช้หนึ่งคนมีได้หลาย role
(`AUTH_MODE=internal` ให้ครบทั้ง 4) ถ้าเขียนลูปแบบ "เก็บผลของ role สุดท้าย"
ข้อความ error จะผิด — เคยตอบว่า "เฉพาะผู้วางแผนเท่านั้น" ทั้งที่เหตุผลจริงคือ
"อนุมัติไปแล้ว" **ให้ยึดคำปฏิเสธที่เจาะจงสถานะเสมอ** เหนือกว่า `NOT_AUTHORIZED`
ทั่วไป ดูวิธีเขียนที่ถูกใน `approve-baseline.ts`
(หมายเหตุ: `transition-work-order.ts` ยังใช้ pattern เดิมอยู่ — ถ้าไปแตะไฟล์นั้น
เมื่อไหร่ ควรแก้ให้เหมือนกัน)

### ขั้น 3 — adapter ใน `src/server/adapters`
`prisma-baseline-port.ts` — ที่เดียวที่รู้จัก Prisma

**สิ่งที่ adapter รับผิดชอบ:**
- แปลงแถวในฐานข้อมูล → ข้อเท็จจริงที่ domain เข้าใจ
- ความ atomic: ใช้ `client.$transaction`
- optimistic concurrency: `updateMany` แล้วเช็ค `count === 0`
```ts
const updated = await tx.asset.updateMany({
  where: { id, version: input.expectedVersion, baselineApproved: false },
  data: { ..., version: { increment: 1 } },
});
if (updated.count === 0) throw new BaselineApprovalError('CONCURRENT_UPDATE', '...');
```
เงื่อนไข `baselineApproved: false` ใน `where` คือกันการอนุมัติซ้อนกันสองคำขอพร้อมกัน
— ถ้าเช็คแค่ในโค้ดข้างบนจะมีช่องว่างระหว่างอ่านกับเขียน

**กับดัก Prisma:** เลือก relation เดิมสองแบบใน `select` ก้อนเดียวไม่ได้
ตอนต้องการทั้ง "ใบงานที่กำลังทำ" และ "ใบงานสำรวจตั้งต้นล่าสุด" ต้องยิงสอง query
(ดู `getAssetDetail` ใน `src/server/queries/assets.ts`)

### ขั้น 4 — route ใน `src/app/api`
```ts
export const dynamic = 'force-dynamic';
const port = createPrismaBaselinePort();   // สร้างครั้งเดียวนอก handler

export async function POST(req, ctx) {
  try {
    const session = requireAnyPermission(await getSession(req), ['survey:approve']);
    const { code } = await ctx.params;     // Next 16: params เป็น Promise
    return json(await approveBaseline(port, { code, actor: session, now: new Date() }));
  } catch (err) {
    return errorResponse(err);             // map error → HTTP ที่เดียว
  }
}
```
route ต้องบาง — ไม่มีกฎธุรกิจในนี้

**อย่าลืม:** error class ใหม่ต้องไปลงทะเบียนใน `src/server/http/respond.ts`
ไม่งั้นจะกลายเป็น 500 ทั้งที่ควรเป็น 409

### ขั้น 5 — UI
- ปุ่มที่ต้องเรียก API → client component (`'use client'`)
- หน้าเพจ → server component เรียก `queries/` ตรง
- ปฏิเสธอย่างซื่อสัตย์ตามข้อ 1.4
- ข้อความจากเซิร์ฟเวอร์เอามาแสดงตรงๆ อย่าเขียนข้อความซ้ำในฝั่ง client
  (ไม่งั้นสองที่จะเพี้ยนกันเมื่อกฎเปลี่ยน)
- `router.refresh()` หลังทำสำเร็จ ให้ server component โหลดสถานะใหม่

### ขั้น 6 — integration test
`route.itest.ts` วางข้างๆ route ยิงผ่าน `POST` จริงไปยัง Postgres จริง

**ต้องครอบคลุมทุกทางปฏิเสธ ไม่ใช่แค่ทางที่สำเร็จ** ของ `ASSET-06` มี 9 เทสต์:
401 ไม่มี session · 403 ช่าง · 403 ผู้บริหาร · 404 ไม่พบเสา · 409 ทั้ง 4 แบบ ·
200 พร้อมตรวจว่าเขียน snapshot **ครบหนึ่งแถวพอดี**

สร้าง fixture ของตัวเองด้วย `randomUUID()` แล้วลบทิ้งใน `afterAll` เสมอ

---

## 4. กลยุทธ์การทดสอบ — และทำไมแค่เทสต์เขียวถึงไม่พอ

| ชั้น | คำสั่ง | ต้องใช้ Docker | ครอบคลุมอะไร |
|---|---|---|---|
| Unit | `pnpm test` | ไม่ | กฎ domain, service (ใช้ in-memory port) |
| Integration | `pnpm test:integration` | ใช่ | route จริง → Postgres จริง, transaction, RBAC |
| ทดสอบสด | `pnpm dev -p 3100` | ใช่ | UI, session จริง, การประกอบร่างทั้งหมด |

**`pnpm typecheck` จับสิ่งที่ vitest จับไม่ได้** — ร่างแรกของ
`approve-baseline.test.ts` ใช้ชื่อฟิลด์ผิดเป็น `{ functionKey, passed }`
ทั้งที่ของจริงคือ `{ key, label, result }` เทสต์**ผ่าน**เพราะ engine
ไม่เจอค่า PASS/FAIL แล้วหลุดไปทาง READY พอดี — เท่ากับมีเทสต์สองตัวที่ไม่ได้ตรวจอะไรเลย
typecheck คือตัวที่จับได้ **อย่ารัน `pnpm test` อย่างเดียวแล้วคิดว่าปลอดภัย**

**การทดสอบสดจับสิ่งที่เทสต์ทั้งสองชั้นจับไม่ได้** — บั๊กข้อความ multi-role
ในข้อ 3 ขั้น 2 หลุดผ่าน unit 285 ตัวและ integration 9 ตัวมาได้
เพราะ session ในเทสต์มี role เดียว แต่ของจริงมีสี่ **ทุก slice ต้องเปิดแอปดูจริง**

**วิธีทดสอบสดที่ปลอดภัย** (ทำตามนี้ทุกครั้ง):
1. สร้าง fixture ชั่วคราว ชื่อไม่ซ้ำของจริง (เช่น `EP_UATBL`)
2. ทดสอบ
3. **ลบทิ้งแล้วยืนยันว่าลบจริง**
4. เช็คว่า demo ที่ป้องกันไว้และ 27 เสายังครบ

ห้ามแตะ `DEMO-LOCAL-*` และห้ามแตะ production/Neon เด็ดขาด

---

## 5. ธรรมเนียมที่ต้องตาม

**ข้อความผู้ใช้เป็นภาษาไทยเสมอ** และใช้คำเดียวกันทั้งระบบ:
พร้อมใช้ / เฝ้าระวัง / ใช้งานไม่ได้ / ยังไม่ทราบ · ใบงาน · ผลตรวจ · ข้อขัดข้อง ·
งานซ่อม · ตรวจรับ — คำแปลรวมอยู่ที่ `src/presentation/thai-labels.ts`

**เวลา:** เก็บเป็น UTC แปลงเป็น Asia/Bangkok + พ.ศ. เฉพาะตอนแสดงผล
(`src/domain/shared/thai-date.ts`) ห้ามเรียก `new Date()` ใน domain

**Idempotency:** ทุก mutation ที่มาจากมือถือต้องมี `clientMutationId`
ส่งซ้ำต้องเป็น no-op ไม่ใช่เขียนซ้ำ

**ห้ามใช้ของที่ต้องจ่ายเงินใน core** — ตรวจ license ก่อนเพิ่ม dependency
แล้วอัปเดต `docs/LICENSE_INVENTORY.md`

**Commit:** slice เล็กๆ แนวตั้ง ครบชั้น + ข้อความอธิบาย *ทำไม* ไม่ใช่แค่ *อะไร*
ปิดท้ายด้วย `Co-Authored-By: Claude <noreply@anthropic.com>`
**push ทุกครั้งก่อนเลิก** เพราะ git คือช่องทางเดียวที่งานเดินทางข้ามเครื่อง

---

## 6. กับดักที่เคยเจอจริง (อ่านก่อนเสียเวลาซ้ำ)

| กับดัก | อาการ | ทางแก้ |
|---|---|---|
| `pnpm dev -- -p 3100` | `Invalid project directory provided, no such directory: ...\-p` | ตัด `--` ออก ใช้ `pnpm dev -p 3100` |
| ไม่มีไฟล์ `.env` ใน repo | `pnpm db:*` / integration ล้มแบบงงๆ | ตั้ง `$env:DATABASE_URL` ใน shell เดียวกัน |
| integration ตก 2 ตัวใน `read-routes.itest.ts` | คาดว่า seed ว่าง แต่ DB มี demo ค้าง | ปกติสำหรับเครื่องที่รัน `db:seed:demo` แล้ว **ไม่ใช่ regression** — CI ที่ DB สะอาดผ่านหมด |
| CI `integration` แดง แต่ `quality` เขียว | `docker pull postgis` timeout ตอน Initialize containers | infra ชั่วคราว — `gh run rerun <id> --failed` **อ่าน log ก่อนโทษโค้ด** |
| `docker compose down -v` | ลบ volume `keycloak-data` ไปด้วย | **ห้ามใช้เด็ดขาด** ถ้าต้อง reset ลบเฉพาะ `sos-maintenance_db-data` |
| แก้ Vercel env แล้วเว็บ 503 | ค่าที่เซฟไปเป็นค่าว่าง และ Sensitive flag ทำให้ดูย้อนไม่ได้ | **ลบตัวแปรทิ้งแล้วสร้างใหม่** อย่าแก้ทับ · 503 = ว่าง, 401 = มีแต่ผิด, 200 = ถูก |
| port 3000 | ไม่ใช่ของโปรเจกต์นี้ | เป็นของ `thai-memo-app` **ห้ามแตะ** ใช้ 3100 เท่านั้น |

**หนี้เทคนิคที่รู้อยู่ ยังไม่แก้** (หยิบทำได้เลย ชิ้นเล็ก):
- ข้อความเหตุผล `CRITICAL_RESULT_MISSING` มี placeholder หลุดให้ผู้ใช้เห็นดิบๆ:
  `ไม่มีผลตรวจล่าสุดของฟังก์ชันวิกฤต "{label}"` — เกิดตอน branch นี้ทำงานกรณี
  "ไม่มี critical check เลย" ซึ่งไม่มี label ไปแทน (`src/domain/readiness/engine.ts`)
- `requiresPhoto` มีใน schema และใน checklist definition แต่**ไม่ถูกบังคับใช้ฝั่งเซิร์ฟเวอร์เลย**
  ตอนนี้ส่งใบสำรวจโดยไม่แนบรูปได้ ต้องแก้พร้อมกับ `UI-03`
- `transition-work-order.ts` ยังใช้ pattern "เก็บผลของ role สุดท้าย" (ดูข้อ 3 ขั้น 2)

---

## 7. คำสั่งที่ใช้บ่อย

```powershell
# ไม่ต้องใช้ Docker
pnpm test          # unit (baseline 2026-07-26: 285 ผ่าน / 30 ไฟล์)
pnpm typecheck
pnpm lint
pnpm build

# ต้องใช้ Docker + env ใน shell เดียวกัน
docker compose up -d postgres
$env:DATABASE_URL = "postgresql://sos:sos@localhost:5432/sos?schema=public"
$env:AUTH_MODE = "internal"

pnpm test:integration   # baseline: 78 ผ่าน / 2 ตก บนเครื่องที่มี demo, 80/80 บน DB สะอาด
pnpm dev -p 3100
pnpm db:setup           # migrate + postgis + seed (ตั้งฐานใหม่)
pnpm db:seed:demo       # ใบงาน demo แบบ fail-closed เฉพาะ local
```

> `integration` shell ควรปล่อย `AUTH_MODE` / `AUTH_DEV_BYPASS` **ว่างไว้**
> ให้เทสต์ตั้งเอง · `browser/demo` shell ใช้ `AUTH_MODE=internal` ได้

---

## 8. เกณฑ์ว่า "เสร็จ" (จาก `docs/spec/06`)

build ผ่านอย่างเดียว **ไม่นับว่าเสร็จ** ต้องครบทุกข้อ:

- [ ] กฎอยู่ใน `src/domain` พร้อมเทสต์
- [ ] service ทดสอบด้วย in-memory port
- [ ] integration test ครอบคลุมทั้งทางสำเร็จและทางปฏิเสธ
- [ ] **เปิดแอปจริงแล้วลองด้วยมือ** — fixture ชั่วคราว สร้าง/ทดสอบ/ลบ/ยืนยันว่าลบแล้ว
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` เขียวหมด
- [ ] อัปเดต `requirements-traceability.csv` ด้วย **หลักฐานที่สังเกตเห็นจริง**
      (ห้ามอ้างผลเทสต์ที่ไม่ได้รัน — spec เขียนว่า *ห้ามปิด requirement ไม่มี evidence*)
- [ ] เขียน `docs/WORKLOG.md` บอกว่าทำอะไร **ทำไม** และ **อะไรที่ยังไม่ได้ทำ**
- [ ] อัปเดต `docs/RESUME_HERE.md` ถ้างานถัดไปเปลี่ยน
- [ ] commit + **push**

**ห้ามอ้างว่า "พร้อมใช้งานจริง"** จนกว่าจะรัน QA/UAT gate ตาม
`docs/spec/06_DELIVERY_QA_UAT.md` แบบเป็นทางการ (`QA-01` ยังไม่เคยทำ)

---

## 9. งานที่เหลือ — จุดเริ่มเจาะจงของแต่ละชิ้น

เจ้าของงานตัดสินใจเมื่อ 2026-07-26 ว่าต้องทำ**ครบทั้ง 5 จุด**ก่อนประกาศพร้อมใช้จริง
จุดที่ 1 (`ASSET-06`) เสร็จแล้ว ลำดับและรายละเอียดอยู่ใน
[`RESUME_HERE.md`](RESUME_HERE.md) ส่วนนี้เสริมจุดเริ่มทางเทคนิค

### `RDY-06` คำนวณความพร้อมใหม่ตามเวลา (ชิ้นถัดไป)
**ปัญหา:** เสาที่เงียบไปเฉยๆ ไม่มีอะไรมาทำให้เปลี่ยนจาก เฝ้าระวัง → ยังไม่ทราบ
ตอนนี้ความพร้อมอัปเดตเฉพาะตอนมีใบตรวจใหม่เข้ามาเท่านั้น

**มีอยู่แล้ว:** cron รายวันใน `vercel.json` ยิงไปที่ `/api/jobs/tick`
· logic โหลดข้อเท็จจริงความพร้อมรายเสาใน `prisma-baseline-port.ts`
(ผล PASS/FAIL ล่าสุดต่อฟังก์ชันวิกฤต, ข้อขัดข้องที่เปิดอยู่, กำหนดตรวจถัดไป)

**ต้องทำ:** ยกส่วนโหลดข้อเท็จจริงออกมาเป็น loader ที่ใช้ร่วมกัน **อย่าเขียนซ้ำเป็นชุดที่สอง**
แล้วเติม logic คำนวณใน `run-job-tick.ts` (ตอนนี้แค่นับจำนวนเสาใน scope)

**คำถามออกแบบที่ต้องตัดสินก่อนเขียน:** เขียน `ReadinessSnapshot` ทุกรอบ
หรือเฉพาะตอนสถานะ*เปลี่ยน*? spec บอกว่า "ทุกการเปลี่ยนสถานะ" ต้องมี snapshot
ซึ่งชวนให้ตีความว่าเขียนเฉพาะตอนเปลี่ยน แต่ถ้าเขียนทุกรอบก็จะได้ประวัติที่ต่อเนื่องกว่า
27 เสา × ทุกวัน = ปีละหนึ่งหมื่นแถว ซึ่งไม่ได้เยอะ **ถามเจ้าของงานก่อน อย่าเดา**

### `OPS-05` ส่งอีเมล
`run-job-tick.ts` ปล่อยการแจ้งเตือนช่อง EMAIL ค้างเป็น `PENDING` ไว้อย่างตั้งใจ
ไม่เคยทิ้ง — ฝั่งคิวถูกต้องแล้ว ที่ขาดคือตัวส่งจริง (Nodemailer)
**ทำตาม pattern ของช่อง in-app:** claim แถวแบบ atomic `PENDING → SENT`
เพื่อไม่ให้ tick สองตัวที่ทำงานพร้อมกันส่งซ้ำ

### `UI-03` ถ่ายรูปหน้างาน
backend เสร็จแล้ว (`SEC-03`) — `POST /api/attachments` ตรวจ MIME จาก byte จริง
ไม่เชื่อค่าที่ client แจ้ง · ตัวอย่างการใช้กล้องที่ใกล้ที่สุดคือ
`src/components/QrScanner.tsx` (`getUserMedia`) · เจ้าของงานเลือกแล้วว่าให้
checklist สำรวจตั้งต้นได้ก่อน **แต่ต้องยืนยันรูปแบบ UX กับเจ้าของงานก่อนลงมือ**
· อย่าลืมว่า `requiresPhoto` ยังไม่ถูกบังคับใช้ฝั่งเซิร์ฟเวอร์ (ดูข้อ 6)

### `RPT-02` รายงาน PDF / Excel
ชิ้นใหญ่ที่สุด **ต้องเขียนเอกสารแผนก่อนเขียนโค้ด** ใช้
`docs/superpowers/plans/2026-07-23-flexible-field-checklist.md` เป็นต้นแบบรูปแบบ
· ฝั่งข้อมูลพร้อมแล้ว — `src/domain/metrics` เป็นนิยามเดียวที่ dashboard ใช้อยู่
ซึ่งเป็นเงื่อนไขของ UAT ข้อ 10 (ตัวเลขต้องตรงกัน)
· **ข้อควรระวัง:** ต้องเป็น free/OSS เท่านั้น และการฝังฟอนต์ไทยใน PDF
คือส่วนที่ยากจริง ไม่ใช่การ generate — ทดสอบสระบน/ล่างและวรรณยุกต์ให้ครบก่อนตัดสินใจเลือก library

---

## 10. เอกสารอื่นที่เกี่ยวข้อง
- `AGENTS.md` — กติกาย่อสำหรับ AI assistant (อ่านอัตโนมัติทุก session)
- [`RESUME_HERE.md`](RESUME_HERE.md) — สถานะปัจจุบัน + ลำดับงาน **แหล่งความจริงหลัก**
- [`WORKLOG.md`](WORKLOG.md) — ประวัติและเหตุผลของทุกการตัดสินใจ
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — โครงสร้างโค้ด, readiness pipeline, ports/adapters
- [`DESIGN.md`](DESIGN.md) — ระบบดีไซน์ UI, token, การเข้าถึง (WCAG 2.2 AA)
- [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md) — fixture demo แบบ fail-closed
- [`DEVELOPING.md`](DEVELOPING.md) — การทำงานข้ามเครื่อง
- `../requirements-traceability.csv` — requirement ไหนเสร็จ/ไม่เสร็จ พร้อมหลักฐาน
- `docs/spec/` — requirement ต้นฉบับ (01–09)
