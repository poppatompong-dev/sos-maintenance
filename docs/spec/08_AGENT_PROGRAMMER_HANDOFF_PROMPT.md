# Prompt สำหรับ Agent Programmer: ระบบบริหารซ่อมบำรุงเสา SOS เทศบาลนครนครสวรรค์

## บทบาทและภารกิจ

คุณคือ Senior Full-stack Engineer และ Solution Architect ประจำทีม จงออกแบบ พัฒนา ทดสอบ และจัดทำระบบบริหารซ่อมบำรุงทรัพย์สินแบบเว็บ PWA สำหรับเทศบาลนครนครสวรรค์ โดยรุ่นแรกต้องใช้งานจริงกับเสาขอความช่วยเหลือฉุกเฉิน SOS จำนวน 27 จุด

ระบบต้องตอบคำถามหลักให้ผู้บริหารได้ทันทีว่า “ขณะนี้เสาใดพร้อมใช้ เสาใดต้องเฝ้าระวัง เสาใดใช้งานไม่ได้ และเสาใดยังไม่มีข้อมูลที่เชื่อถือได้” พร้อมสืบย้อนกลับไปถึงผลตรวจ ผู้ปฏิบัติ เวลา พิกัด รูปหลักฐาน งานซ่อม และผู้ตรวจรับได้

ให้ทำงานจนได้ระบบที่รันได้จริง ไม่ใช่เพียง mockup หรือเอกสารออกแบบ เริ่มจากตรวจ workspace และสิ่งที่มีอยู่ก่อน หากเป็นโครงการใหม่ให้สร้างโครงสร้างที่เหมาะสม จากนั้นวางแผนเป็นช่วงสั้น ๆ ลงมือพัฒนา ทดสอบ และแก้ไขจนผ่านเกณฑ์รับมอบด้านล่าง ห้ามถามซ้ำในเรื่องที่ Prompt นี้ตัดสินไว้แล้ว ให้ถามเฉพาะกรณีขาด secret, บัญชี, เอกสารภายใน หรือข้อมูลที่ไม่สามารถสมมติได้อย่างปลอดภัย

## ข้อมูลพื้นฐานที่ยืนยันแล้ว

- เสา SOS เป็นความร่วมมือระหว่างเทศบาลนครนครสวรรค์กับ สภ.เมืองนครสวรรค์ ภายใต้ Smart Safety Zone 4.0
- สัญญาณเชื่อมไปยังศูนย์ CCOC ของ สภ.เมืองนครสวรรค์ ผ่านโครงข่าย Super Nodes ของเทศบาล
- วิธีใช้งานคือกดปุ่ม รับสัญญาณเสียง/ไฟ และสนทนากับเจ้าหน้าที่ตำรวจโดยตรง ระบบมีการบันทึกภาพผู้แจ้งและบริเวณรอบเสา
- แหล่งอ้างอิงสาธารณะ:
  - https://nsm.go.th/smart_city.php
  - https://nsm.go.th/detail_newspr.php?id_newspr=1172
  - https://www.nsm.go.th/download/magazine2565/12banroa_DEC_2022.pdf
  - แผนที่ KML: https://www.google.com/maps/d/kml?mid=1LTEEK33hjDxOnkS-BFICRQH2iaEh9uA&forcekml=1
- ข้อมูลสาธารณะยังไม่ระบุยี่ห้อ รุ่น Serial อุปกรณ์ภายใน แหล่งจ่ายไฟ ระบบสำรองไฟ หรือ API/SNMP ของระบบเดิม จึงต้องมีขั้นตอนสำรวจตั้งต้นและห้ามผูกระบบกับผู้ผลิตรายใด

## เป้าหมายและเกณฑ์สำเร็จรุ่นแรก

รุ่นแรกถือว่าสำเร็จเมื่อ:

1. มีทะเบียนเสา `EP01–EP27` ครบ พร้อมชื่อ พิกัด QR รูปถ่าย ส่วนประกอบ และผลสำรวจตั้งต้น
2. ผู้บริหารเห็นสถานะความพร้อมของทั้ง 27 จุดที่คำนวณจากหลักฐานล่าสุด ไม่ใช่สีที่ผู้ใช้เลือกเอง
3. ระบบสร้างร่างงานประจำรายสัปดาห์ รายเดือน และทุก 6 เดือน จากนั้นผู้วางแผนตรวจและเผยแพร่ได้
4. เจ้าหน้าที่ภาคสนามสแกน QR บันทึกเช็กลิสต์ GPS รูปถ่าย และผลตรวจได้ทั้งออนไลน์และออฟไลน์
5. การตรวจไม่ผ่านสร้างข้อขัดข้องและใบงานซ่อมที่ติดตามจนตรวจรับได้
6. มีแดชบอร์ด แผนที่ รายงาน PDF ภาษาไทย และ Excel ที่ข้อมูลตรงกัน
7. มี RBAC, MFA, audit log, การสำรองรายวัน คู่มือติดตั้ง และชุดทดสอบที่พิสูจน์ workflow สำคัญครบ

กรอบเวลาที่คาดหวังคือ 8–12 สัปดาห์ ระบบเปิดใช้ครบ 27 จุดพร้อมกันหลังผ่าน UAT ไม่ใช้การนำร่องทีละโซน

## ขอบเขตผลิตภัณฑ์

### อยู่ในขอบเขต

- แกนข้อมูล CMMS ที่รองรับ Asset Type และทรัพย์สินหลายประเภทในอนาคต
- โมดูลและหน้าจอใช้งานจริงในรุ่นนี้เฉพาะเสา SOS 27 จุด
- ทะเบียนทรัพย์สิน ส่วนประกอบ พิกัด รูป เอกสาร และ QR
- แผน PM, ปฏิทิน, การสร้างร่างงานซ้ำ, มอบหมาย และติดตามงาน
- เช็กลิสต์แบบ versioned, ผลตรวจ, fault, corrective work order และประวัติซ่อม
- บันทึกอาการ สาเหตุ วิธีแก้ และชิ้นส่วนที่เปลี่ยนเป็นข้อความ
- สถานะออนไลน์ที่บันทึกด้วยมือหรือ import CSV/Excel ในรุ่นแรก พร้อม integration adapter สำหรับ API/SNMP ในอนาคต
- PWA ภาษาไทย, ใช้มือถือได้, offline form/sync, QR, GPS และรูปถ่าย
- แจ้งเตือนในระบบและอีเมล
- Dashboard, map, PDF, Excel และ audit trail

### ไม่อยู่ในขอบเขต

- บัญชีผู้ใช้ของตำรวจหรือผู้รับจ้าง; รุ่นแรกใช้ภายในเทศบาลเท่านั้น
- การเก็บข้อมูลการกด SOS จริง ภาพ เสียง รายละเอียดผู้แจ้ง หรือข้อมูลคดีจาก CCOC
- ระบบคลังอะไหล่ ต้นทุน ค่าใช้จ่าย จัดซื้อ สัญญา หรือบัญชี
- ป้ายหรือประกาศสาธารณะเมื่อเสาเสีย; แจ้งเตือนภายในเท่านั้น
- แผนที่ออฟไลน์
- การเชื่อม API/SNMP จริงจนกว่าจะสำรวจและยืนยัน interface ของระบบเดิม
- SLA ตายตัวในช่วงเริ่มต้น; ให้เก็บข้อมูลเวลา 90 วันก่อนเสนอค่า SLA
- หน้าจอเฉพาะสำหรับทรัพย์สินประเภทอื่นในรุ่นแรก

## ผู้ใช้และสิทธิ์

ใช้ 4 บทบาท และบังคับสิทธิ์ที่ server ทุก endpoint:

1. **System Admin** — จัดการบัญชี บทบาท ค่าองค์กร Asset Type template integration และค่าระบบ
2. **Planner/Supervisor** — วางแผน สร้าง/อนุมัติตาราง มอบหมาย ตรวจหลักฐาน รับหรือส่งคืนงานซ่อม และออกรายงาน
3. **Technician** — รับงาน สำรวจ ตรวจ PM บันทึก fault ซ่อม แนบรูป/GPS และส่งงาน
4. **Executive/Auditor** — อ่าน dashboard แผนที่ ประวัติ และรายงานเท่านั้น ห้ามแก้ข้อมูลปฏิบัติการ

PM ที่ผ่านครบพร้อมหลักฐานสามารถปิดได้ทันที งานตรวจไม่ผ่านและงานซ่อมต้องให้ Planner/Supervisor ตรวจรับก่อนจึงจะปิดและคืนสถานะพร้อมใช้ ผู้ปฏิบัติงานห้ามตรวจรับงานซ่อมของตนเอง

## แบบข้อมูลหลัก

ออกแบบแกนกลางอย่างน้อยดังนี้ โดยใช้ UUID ภายในและเก็บ audit timestamps ทุกตาราง:

- `AssetType` — ชนิดทรัพย์สินและ metadata schema
- `Asset` — รหัส ชื่อ สถานะวงจรชีวิต หน่วยงาน พิกัด QR และข้อมูลเฉพาะชนิด
- `AssetComponent` — ชิ้นส่วน ยี่ห้อ รุ่น Serial วันที่ติดตั้ง ระดับ critical และสถานะ
- `Location` — ชื่อพื้นที่ พิกัด geography และข้อมูลช่วยนำทาง
- `ChecklistTemplate` และ `ChecklistTemplateVersion` — template ห้ามแก้ย้อนหลังเมื่อมีการใช้งานแล้ว
- `MaintenancePlan` — ประเภทงาน รอบ recurrence checklist และเงื่อนไขสร้างงาน
- `ScheduleBatch` — ตารางร่าง ผู้อนุมัติ และเวลาที่เผยแพร่
- `WorkOrder`, `Assignment`, `WorkLog` — งาน ผู้รับผิดชอบ เวลา และ state transition
- `ChecklistResponse` — คำตอบ ผลผ่าน/ไม่ผ่าน หมายเหตุ และ template version ที่ใช้
- `Fault` — อาการ ระดับ critical แหล่งที่พบ สถานะ และความสัมพันธ์กับงาน
- `RepairAction` — สาเหตุ วิธีแก้ ชิ้นส่วนที่เปลี่ยน และผล retest
- `Attachment` — รูป/เอกสาร metadata checksum และสิทธิ์เข้าถึง
- `HealthObservation` — สถานะ online/offline/unknown/degraded จาก manual, import หรือ adapter
- `ReadinessSnapshot` — สถานะที่คำนวณ พร้อมเหตุผลและข้อมูลต้นทาง
- `Notification` — ผู้รับ ช่องทาง สถานะส่ง และ idempotency key
- `IntegrationSource` และ `ImportBatch` — แหล่งข้อมูล การ map และผล import
- `AuditEvent` — append-only actor, action, entity, before/after metadata, IP/device และเวลา

ห้าม hard-code ตารางให้ใช้ได้เฉพาะ SOS แต่ UI และ template รุ่นแรกให้เฉพาะเจาะจงกับ SOS

## ทะเบียนตั้งต้น 27 จุด

Seed ข้อมูลต่อไปนี้ โดยเก็บพิกัดเป็น WGS84 `longitude, latitude` และให้เจ้าหน้าที่สำรวจยืนยันภายหลัง ห้ามถือว่าพิกัดสาธารณะเป็นหลักฐานภาคสนามสุดท้าย

| รหัส | ชื่อจุด | Longitude | Latitude |
|---|---|---:|---:|
| EP01 | ข้างป้ายอุทยานสวรรค์ (ฝั่งโกยี) | 100.1220556 | 15.6975278 |
| EP02 | ทางขึ้นสะพานเกาะกลาง | 100.1258611 | 15.7000278 |
| EP03 | ทางขึ้นสะพานแขวน | 100.128555555556 | 15.7022777777778 |
| EP04 | ลานกีฬาอุทยานสวรรค์ | 100.129166666667 | 15.7049166666667 |
| EP05 | สะพานเล็กเกาะกลาง | 100.1251231 | 15.7026748 |
| EP06 | หน้าประตู 8 (ตรงข้ามตรอกลิเก) | 100.130916666667 | 15.701 |
| EP07 | หน้าสถานีขนส่ง (ศูนย์ท่ารถ) | 100.1183712 | 15.7017082 |
| EP08 | ต้นซอยวัชระ | 100.1187648 | 15.6994607 |
| EP09 | หน้ามหาวิทยาลัยภาคกลาง | 100.1131188 | 15.6968514 |
| EP10 | ทางเข้าตลาดสวนขอบฟ้า | 100.1032672 | 15.6957272 |
| EP11 | ทางเข้าตลาดศรีนคร | 100.106362 | 15.683038 |
| EP12 | หน้าตลาดเพชรพิชญา | 100.1444562 | 15.7110947 |
| EP13 | แยกป่าช้าจีน | 100.131888888889 | 15.7207222222222 |
| EP14 | แยกนวมินทร์ | 100.117527777778 | 15.7207222222222 |
| EP15 | สามแยกปลดแอกข้างอุทยานสวรรค์ | 100.1299877 | 15.7056751 |
| EP16 | แยกก๋วยเตี๋ยวเจ๊สั้น | 100.126916666667 | 15.6978611111111 |
| EP17 | ตลาดบ่อนไก่ริมน้ำข้างสำนักงานทรัพย์สินฯ | 100.1436484 | 15.7053884 |
| EP18 | สถานีวิทยุแห่งประเทศไทยจังหวัดนครสวรรค์ | 100.1219125 | 15.6892978 |
| EP19 | หน้าวิทยาลัยเทคนิคนครสวรรค์ | 100.1163532 | 15.6923438 |
| EP20 | หน้าแฟลตพนักงานเทศบาล | 100.137138888889 | 15.7151388888889 |
| EP21 | หน้าโรงเรียนลาซาลโชติรวี | 100.139944444444 | 15.7193055555556 |
| EP22 | สามแยกชุมชนป่าไม้ ท้ายคลองญวน | 100.1267518 | 15.6930036 |
| EP23 | แยกท่าทอง | 100.102611111111 | 15.6795 |
| EP24 | หน้าเซเว่นฝั่งตรงข้าม สสจ.นครสวรรค์ | 100.1042521 | 15.7067421 |
| EP25 | สามแยกหน้าป้ายต้นแม่น้ำเจ้าพระยา | 100.1399548 | 15.7017224 |
| EP26 | หน้าตลาดรวยทรัพย์ | 100.107944444444 | 15.7161944444444 |
| EP27 | หน้าหมู่บ้านการุณรังษีตลาดใต้ | 100.102277777778 | 15.6731666666667 |

## การสำรวจตั้งต้น

ก่อนแสดงสถานะ Ready ต้องมี Initial Survey ที่เก็บอย่างน้อย:

- ยืนยันรหัส ชื่อจุด พิกัดจริง และภาพกว้าง/ภาพป้าย/ภาพอุปกรณ์
- ยี่ห้อ รุ่น Serial และวันที่ติดตั้งเท่าที่หาได้
- ปุ่ม SOS, ไฟ/เสียงยืนยัน, microphone, speaker, กล้องผู้แจ้ง, กล้องบริเวณ, ระบบบันทึกภาพ
- network/VoIP, switch/router/media converter/antenna เท่าที่พบ
- แหล่งจ่ายไฟ breaker, PSU, UPS/battery, surge protection และ grounding เท่าที่พบ
- ตู้ ซีล กันน้ำ สนิม รอยงัด ป้ายคำแนะนำ ฐานเสา น็อต ความสะอาด และสิ่งกีดขวาง
- ทดสอบ end-to-end ถึงผู้รับที่ CCOC พร้อมบันทึกชื่อ/รหัสผู้ร่วมทดสอบฝั่งศูนย์โดยไม่เก็บข้อมูลเหตุฉุกเฉินจริง
- ช่องหมายเหตุ “ไม่ทราบ/ไม่สามารถเปิดตรวจ” เพื่อไม่บังคับสร้างข้อมูลเท็จ

Initial Survey ต้องผ่าน Planner/Supervisor ก่อนจึงเริ่มสถานะตามปกติ

## แผนบำรุงรักษาและเช็กลิสต์

สร้าง template ที่แก้ไขและ version ได้:

1. **Weekly Center Check** — ตรวจ online/offline, health ของกล้อง/VoIP/เครือข่ายจากศูนย์หรือบันทึกผลจาก dashboard เดิม; รองรับ bulk import
2. **Monthly End-to-End Field Test** — ลงพื้นที่ ตรวจสภาพ กดปุ่ม ยืนยันไฟ/เสียง สนทนาสองทาง ตรวจว่าศูนย์เห็นจุดถูกต้อง ภาพกล้องทั้งสองมุมและการบันทึกทำงาน
3. **Semiannual Deep PM** — รวม monthly test และตรวจภายในตู้ ความสะอาด ขั้วต่อ สาย สภาพไฟ/UPS/battery การกันน้ำ/สนิม surge/grounding ฐานเสา ป้าย และ firmware/config backup หากอุปกรณ์รองรับ
4. **Corrective Repair and Retest** — อาการ สาเหตุ วิธีแก้ ชิ้นส่วนที่เปลี่ยน รูปก่อน/หลัง และ retest ฟังก์ชันหลักครบวงจร

ระบบสร้าง Schedule Batch เป็นร่างโดยอัตโนมัติ จัดกลุ่มเสาตามระยะทาง/พื้นที่อย่างสมเหตุผล แต่ให้ Planner ปรับวัน คน และลำดับก่อนเผยแพร่ งานร่างห้ามแจ้งเตือน Technician

## กติกาสถานะความพร้อม

ใช้ enum 4 ค่าและคำนวณจากข้อมูล ห้ามผู้ใช้เลือกสีเอง:

- `READY` — Initial Survey ผ่าน ผลตามรอบยังไม่หมดอายุ ฟังก์ชัน critical ล่าสุดผ่านทั้งหมด และไม่มี critical fault เปิดอยู่
- `WATCH` — มี non-critical defect หรืองานตรวจเลยกำหนดแต่ยังอยู่ใน grace period 7 วัน
- `DOWN` — ฟังก์ชันหลักข้อใดข้อหนึ่งไม่ผ่าน หรือมี critical fault เปิดอยู่
- `UNKNOWN` — ยังไม่มี baseline ที่อนุมัติ, ไม่มีข้อมูลเพียงพอ, หรือพ้นกำหนดตรวจเกิน grace period 7 วัน

ฟังก์ชัน critical เริ่มต้น ได้แก่ ปุ่ม SOS, ไฟ/เสียงยืนยัน, microphone, speaker/เสียงสองทาง, กล้องและภาพบันทึกที่กำหนด, network/VoIP และไฟเลี้ยงที่ทำให้ระบบทำงาน หากข้อใดไม่ผ่านให้ `DOWN` ทันที

ลำดับ precedence: critical failure/open critical fault → `DOWN`; ขาด baseline/ข้อมูลหมดอายุ → `UNKNOWN`; non-critical issue/อยู่ใน grace → `WATCH`; ผ่านครบ → `READY` ทุกการเปลี่ยนสถานะต้องสร้าง ReadinessSnapshot พร้อม reason codes

## Workflow ใบงาน

ใช้ state machine ที่ตรวจสอบได้ เช่น `DRAFT → PUBLISHED/ASSIGNED → IN_PROGRESS → SUBMITTED → CLOSED` และรองรับ `REJECTED/REOPENED`, `CANCELLED` ตามสิทธิ์

- ผลตรวจไม่ผ่านต้องสร้าง Fault และ Corrective Work Order แบบ idempotent โดยอัตโนมัติ
- สถานะ `DOWN` ต้องแจ้งเตือนในระบบและอีเมลทันที
- Repair ต้องมีรูปก่อน/หลัง สาเหตุ วิธีแก้ และ retest; Planner ตรวจรับหรือส่งคืนพร้อมเหตุผล
- เก็บเวลาพบเหตุ รับงาน เริ่มงาน มาตรการชั่วคราว ซ่อมเสร็จ ส่งตรวจ และตรวจรับ เพื่อคำนวณ MTTA/MTTR
- 90 วันแรกยังไม่บังคับ SLA ให้แสดง baseline และ distribution ก่อน จากนั้นทำ SLA เป็นค่าปรับแต่งได้ ไม่ hard-code
- ห้ามลบใบงานหรือผลตรวจที่ปิดแล้ว ใช้ correction/reopen พร้อม audit trail

## งานภาคสนามและ Offline PWA

- หน้า Technician ต้อง mobile-first และติดตั้งเป็น PWA ได้ผ่าน HTTPS
- ดาวน์โหลด work package ที่ได้รับมอบหมายไว้ล่วงหน้า รวมข้อมูลเสา เช็กลิสต์ และข้อมูลจำเป็น
- ใช้ IndexedDB เก็บ draft, checklist, GPS, รูป และ sync queue ระหว่าง offline
- ทุก mutation ใช้ client-generated UUID/idempotency key เพื่อป้องกันข้อมูลซ้ำ
- แสดงสถานะ `ยังไม่ซิงก์`, `กำลังซิงก์`, `ซิงก์ไม่สำเร็จ`, `ซิงก์แล้ว` ชัดเจน
- งานยังไม่ถือว่าเสร็จในระบบส่วนกลางจนข้อมูลและหลักฐานอัปโหลดสำเร็จ
- เมื่อ conflict ให้เก็บ server version ห้าม last-write-wins เงียบ ๆ และให้ผู้ใช้/Planner เห็นรายการที่ต้องแก้
- สแกน QR เพื่อเปิด asset/work order ที่ถูกต้อง
- บันทึก GPS ณ เวลาตรวจ หากห่างพิกัด asset เกิน 100 เมตรให้เตือน บังคับเหตุผล และติดธงให้ผู้ตรวจรับ แต่ยังอนุญาตบันทึก
- บังคับรูปหลักฐานตาม checklist ที่กำหนด บีบอัดก่อนอัปโหลดโดยไม่ทำลาย metadata สำคัญ
- แผนที่ใช้เมื่อออนไลน์เท่านั้น ออฟไลน์ยังดูข้อมูลจุด/พิกัดและกรอกงานได้ แต่ห้าม prefetch tile จาก OpenStreetMap

## Dashboard, Map และรายงาน

Dashboard ต้องมี:

- จำนวนและสัดส่วน Ready/Watch/Down/Unknown พร้อมเวลาข้อมูลล่าสุด
- แผนที่ 27 จุด แยกสีตามสถานะ คลิกดูเหตุผล ผลตรวจล่าสุด fault และงานถัดไป
- งานวันนี้ ใกล้ครบกำหนด เกินกำหนด และค้างตรวจรับ
- แนวโน้ม readiness, PM compliance, fault ซ้ำ, MTTA/MTTR และเวลาหยุดใช้งาน
- กรองตามช่วงเวลา สถานะ โซน ผู้รับผิดชอบ และประเภทงาน

รายงาน:

- PDF A4 ภาษาไทย พร้อมชื่อเทศบาล ช่วงรายงาน วันที่พิมพ์ และพื้นที่โลโก้/ลายเซ็นที่ปรับได้
- Excel แยก sheet สำหรับทะเบียน, สถานะล่าสุด, งาน PM, faults/repairs และ raw checklist
- ตัวเลขและรายการใน Dashboard/PDF/Excel ต้องใช้ query/definition เดียวกัน
- แสดงวันที่แก่ผู้ใช้เป็น พ.ศ. แต่เก็บ timestamp มาตรฐาน ISO/UTC และแปลงตาม `Asia/Bangkok`

## การแจ้งเตือน

- Notification center ภายในระบบ
- อีเมลทันทีเมื่อเสาเป็น `DOWN`, งานซ่อมถูกส่งคืน หรือ sync/import สำคัญล้มเหลว
- Daily digest สำหรับงานใกล้ครบกำหนด
- Weekly digest สำหรับงานเกินกำหนดและข้อมูล `UNKNOWN`
- ใช้ SMTP adapter ผ่าน Nodemailer โดยตั้งค่าจาก environment; ไม่ผูกกับบริการอีเมลเสียเงิน
- มี retry, delivery log และ idempotency ป้องกันส่งซ้ำ

## Interface และ Integration

จัดทำ REST API ที่มี OpenAPI spec สำหรับ resource หลักอย่างน้อย:

- `/api/asset-types`, `/api/assets`, `/api/assets/{id}/components`
- `/api/checklist-templates`, `/api/maintenance-plans`, `/api/schedule-batches`
- `/api/work-orders`, `/api/faults`, `/api/repair-actions`
- `/api/health-observations`, `/api/imports`, `/api/reports`
- `/api/mobile/work-packages`, `/api/mobile/sync`

รองรับ import CSV/Excel สำหรับทะเบียนและ HealthObservation โดยมี preview, validation, row-level error และ rollback ทั้ง batch ห้ามเขียนทับข้อมูลดีบางส่วนแบบเงียบ ๆ

สร้าง integration contract แบบ provider-neutral: source, external asset key, observed-at, status, component, raw payload checksum และ import batch ระบบเดิมที่ยังไม่ทราบ API ให้ใช้ manual/bulk import ก่อน เมื่อได้ API/SNMP ภายหลังให้เพิ่ม adapter โดยไม่เปลี่ยน domain model

## Tech Stack: ฟรีและโอเพนซอร์สเป็นข้อบังคับ

ห้ามใช้ software license, paid API หรือ SaaS ที่จำเป็นต่อการทำงานหลัก เลือก dependency ที่เป็นโอเพนซอร์สและบันทึก license inventory

- **Application:** Next.js App Router + TypeScript แบบ full-stack monolith แยก domain/service/repository ชัดเจน
- **UI:** Tailwind CSS + shadcn/ui; รองรับ responsive และ keyboard/accessibility
- **Database:** PostgreSQL + PostGIS; migration อยู่ใน source control
- **Authentication:** self-hosted Keycloak ผ่าน OIDC พร้อม TOTP MFA
- **Offline:** Service Worker + IndexedDB; ทำ sync protocol เองอย่างมี idempotency
- **Map:** MapLibre หรือ Leaflet กับ OpenStreetMap online tiles พร้อม attribution และ tile URL ปรับได้; ห้าม offline tile download
- **Files:** abstraction แบบ object/file storage; รุ่นแรกใช้ persistent volume บน VPS ได้ และเปลี่ยนเป็น S3-compatible self-hosted ภายหลังโดยไม่แก้ domain
- **PDF:** HTML/CSS print template ผ่าน Playwright/Chromium
- **Excel:** ExcelJS หรือไลบรารีโอเพนซอร์สเทียบเท่า
- **Email:** Nodemailer + SMTP ขององค์กร
- **Jobs:** background worker/cron ที่มี persistent job state ใน PostgreSQL ไม่ใช้ in-memory timer เป็นแหล่งจริงเพียงอย่างเดียว
- **Deployment:** Docker Compose + Caddy สำหรับ HTTPS; แยก app, worker, PostgreSQL/PostGIS, Keycloak และ persistent volumes
- **Testing:** Vitest/Jest ตามความเหมาะสม + Playwright E2E + API/integration tests

ค่า VPS, domain, storage และ SMTP infrastructure อาจมีต้นทุน แต่ตัวระบบต้องไม่บังคับซื้อไลเซนส์หรือสมัคร paid API

## Security, Privacy และการเก็บรักษาข้อมูล

- HTTPS ทุกหน้า, secure cookies, CSRF protection, CSP/security headers, rate limiting และ input/file validation
- Keycloak MFA บังคับสำหรับ Admin, Planner/Supervisor และ Executive/Auditor; ตั้งค่าให้บังคับ Technician ได้
- RBAC และ asset/work-order authorization ตรวจที่ server ห้ามพึ่งการซ่อนปุ่มหน้าเว็บ
- ไฟล์ต้องตรวจ MIME/extension/size, ตั้งชื่อใหม่, เก็บนอก public path และเข้าผ่าน authorized endpoint
- AuditEvent เป็น append-only และแสดงประวัติสำคัญใน UI
- ใช้ soft delete/retire สำหรับ master data ที่ถูกอ้างอิงแล้ว
- ไม่เก็บข้อมูลเหตุฉุกเฉินจริงหรือข้อมูลประชาชน
- เก็บประวัติใบงานและหลักฐานตลอดอายุทรัพย์สินและต่ออีก 5 ปี
- สำรองฐานข้อมูลและไฟล์รายวัน เก็บสำเนาแยกจาก VPS หลัก ยอมรับข้อมูลสูญหายสูงสุด 24 ชั่วโมงและตั้งเป้ากู้คืนภายใน 1 วันทำการ
- ทำ restore drill และบันทึกผลอย่างน้อยทุกไตรมาส

## เกณฑ์ทดสอบขั้นต่ำ

### Unit/Domain tests

- readiness precedence และการเปลี่ยน Ready/Watch/Down/Unknown
- grace period 7 วันและการหมดอายุของผลตรวจ
- recurrence รายสัปดาห์/เดือน/6 เดือน รวมวันหยุดและ timezone Bangkok
- critical checklist failure สร้าง Fault/Corrective WO เพียงครั้งเดียว
- RBAC ของทุก state transition
- GPS distance 100 เมตรและเหตุผลกรณีนอกรัศมี
- report metric definitions และการแปลง พ.ศ.

### Integration tests

- migration + seed 27 จุดและพิกัดถูกต้อง
- Keycloak OIDC/MFA/RBAC
- upload/download ไฟล์แบบมีสิทธิ์
- CSV/Excel preview, validation, rollback และ duplicate handling
- background jobs, email retry และไม่ส่งซ้ำ
- daily backup script และ restore procedure ใน environment ทดสอบ

### E2E/UAT scenarios

1. Admin/Planner ตรวจทะเบียน 27 จุด สร้าง Initial Survey และอนุมัติ baseline
2. ระบบสร้างตารางร่าง ผู้วางแผนแก้ไขและเผยแพร่ ช่างเห็นเฉพาะงานที่มอบหมาย
3. ช่างสแกน QR ตรวจผ่านครบพร้อม GPS/รูป แล้วสถานะเป็น Ready
4. กล้องหรือเสียงสองทางไม่ผ่าน เสาเป็น Down ทันที มี Fault, Corrective WO และอีเมล
5. ช่างซ่อมและส่ง retest; เสายังไม่ Ready จน Planner ตรวจรับ
6. งานเลยกำหนดเปลี่ยนเป็น Watch และหลัง grace 7 วันเป็น Unknown
7. ช่างทำงาน offline แนบหลายรูป ปิด/เปิด PWA แล้วข้อมูลยังอยู่ จากนั้น sync ครั้งเดียวโดยไม่ duplicate
8. GPS เกิน 100 เมตรบังคับเหตุผลและแสดงธงแก่ผู้ตรวจรับ
9. Executive ดู/ส่งออกได้แต่แก้ข้อมูลไม่ได้
10. PDF ภาษาไทยและ Excel ตรงกับ Dashboard ในช่วงเวลาเดียวกัน
11. เปิดครบ 27 จุดพร้อมกันหลัง UAT โดยไม่มี asset ใดขาด baseline หรือสถานะ

## UX และคุณภาพ

- ภาษาไทยเป็นค่าเริ่มต้น ใช้คำศัพท์สม่ำเสมอ: ทรัพย์สิน, เสา SOS, แผนบำรุงรักษา, ใบงาน, ผลตรวจ, ข้อขัดข้อง, งานซ่อม, ตรวจรับ, พร้อมใช้, เฝ้าระวัง, ใช้งานไม่ได้, ยังไม่ทราบ
- Mobile-first สำหรับ Technician; Desktop-first สำหรับ Planner/Dashboard แต่ทุกหน้าต้อง responsive
- สีสถานะต้องมี icon/text ไม่ใช้สีอย่างเดียว
- แสดง loading, empty, offline, stale, validation และ recovery states ชัดเจน
- หน้า asset ต้องเห็นสถานะและเหตุผล, ผลตรวจล่าสุด, fault เปิด, งานถัดไป, component และ timeline ในที่เดียว
- รองรับเบราว์เซอร์ Chromium ปัจจุบันและ Safari/iOS ที่รองรับ PWA ตามสมควร

## UI Direction Decision ที่ยืนยันแล้ว

ใช้แบบ A "ศูนย์ควบคุมเสา SOS บนแผนที่" เป็น primary shell สำหรับ Planner/Supervisor และ Executive/Auditor โดย status rail + แผนที่ 27 จุด + action ledger ต้องตอบได้ทันทีว่าเสาใดพร้อมใช้และต้องทำอะไรต่อ

- Technician ใช้ field-first shell จากแนว B: วันนี้ / สแกน QR / งานของฉัน
- Planner calendar ใช้แนว C เป็นหน้ารอง ไม่ใช่หน้าแรก
- เมนูหลักต่อ role ไม่เกิน 5; หนึ่งหน้ามี primary action เดียว
- ห้าม gradient, glassmorphism, decorative orb/blob/glow, card wall, pill เกินจำเป็น, 3D illustration, emoji icon และ generic AI/marketing copy
- ความพรีเมียมมาจาก typography, spacing, hierarchy, restrained color และ interaction ที่แม่นยำ
- สีสถานะต้องมี icon/text/reason; WCAG 2.2 AA, focus visible, touch >=44px, 320px reflow, 200% zoom, reduced motion
- p75 LCP <=2.5s, INP <=200ms, CLS <=0.1; initial shell JS <=200KB gzip ไม่รวม lazy map/report; Technician Today จาก cache <=1.5s บน Android ระดับกลาง
- Lazy map/chart/scanner/report; image compression worker; pagination/virtualization
- `throwaway-ui-prototype` เป็น visual reference ห้ามนำตรงไป production
- อ่าน `docs/` ทั้งชุดและใช้ `06_DELIVERY_QA_UAT.md` เป็น release gate

## แผนส่งมอบที่คาดหวัง

1. Bootstrap repository, architecture decision records, CI, Docker และ test harness
2. Auth/RBAC, generic asset core, PostGIS, seed 27 จุด, map และ Initial Survey/QR
3. Checklist versioning, maintenance plans, calendar, schedule approval และ work-order state machine
4. Fault/repair/retest, readiness engine, notification center และ email
5. Offline PWA, work package, IndexedDB sync, GPS, QR และ media upload
6. Dashboard, PDF/Excel, import/adapter contract และ 90-day SLA baseline metrics
7. Security hardening, backup/restore, full E2E/UAT, production deployment และคู่มือ

## สิ่งที่ต้องส่งมอบ

- Source code และ migration/seed ที่ reproducible
- `.env.example` โดยไม่มี secret
- Docker Compose สำหรับ development และ production พร้อม persistent volumes
- OpenAPI spec และตัวอย่าง import template
- ชุดทดสอบ unit/integration/E2E พร้อมคำสั่งรัน
- คู่มือติดตั้ง อัปเกรด สำรอง กู้คืน และ troubleshooting
- คู่มือผู้ใช้ 4 บทบาทภาษาไทย
- Checklist template ทั้ง 4 ประเภทและรายงาน PDF/Excel ตัวอย่าง
- Architecture/decision records โดยเฉพาะ offline sync, readiness rules, auth และ storage
- License inventory ยืนยันว่า dependency หลักใช้ฟรี/โอเพนซอร์ส
- UAT checklist และหลักฐานผลทดสอบครบ 27 จุด

## Definition of Done

อย่ารายงานว่างานเสร็จเพียงเพราะ build ผ่าน ให้ตรวจ requirement-by-requirement และแสดงหลักฐานคำสั่งทดสอบ ผล migration/seed การรัน Docker การทำงาน E2E offline/online สิทธิ์ผู้ใช้ รายงาน และ backup/restore ระบบต้องไม่มี paid dependency ที่จำเป็น ไม่มีข้อมูลตัวอย่างปลอมหลงใน production และไม่มี workflow สำคัญที่เป็นเพียงปุ่มหรือ mock เมื่อพบข้อจำกัดจากอุปกรณ์จริงหรือระบบ CCOC ให้บันทึกเป็นข้อเท็จจริง แยกจากสมมติฐาน และใช้ manual/import fallback โดยไม่ลดเป้าหมายของระบบหลัก
