# SOS Maintenance System - Project Handoff Pack

สถานะ: Ready for engineering kickoff  
เจ้าของระบบ: เทศบาลนครนครสวรรค์  
ขอบเขตรุ่นแรก: เสา SOS 27 จุด  
UI Decision: แบบ A - ศูนย์ควบคุมเน้นแผนที่

## วิธีใช้

1. Product Owner อ่าน `01_PROJECT_BRIEF_PRD.md` และ `07_DECISIONS_RISKS_OPEN_ITEMS.md`
2. UX/Frontend อ่าน `02_UX_UI_SPEC_A.md` และเปิด `../throwaway-ui-prototype/?variant=A`
3. Backend/Architect/DevOps อ่าน `03_SOLUTION_ARCHITECTURE.md`, `04_DATA_API_SYNC_SPEC.md`, `05_SECURITY_OPERATIONS.md`
4. QA/UAT ใช้ `06_DELIVERY_QA_UAT.md` เป็น release gate
5. Agent Programmer เริ่มจาก `08_AGENT_PROGRAMMER_HANDOFF_PROMPT.md` และอ้างอิงเอกสารทั้งหมด

## Source of truth

เมื่อข้อมูลขัดกัน: decision ล่าสุดใน `07` > PRD/acceptance ใน `01` และ `06` > technical specs `03-05` > Agent prompt > prototype. Prototype เป็น visual reference เท่านั้น ไม่ใช่ production code

## Definition of Ready

- ยืนยัน scope/out-of-scope และ UAT owner
- เตรียม VPS/domain/SMTP หรือ local substitutes สำหรับ development
- ยืนยันว่า API/SNMP เดิมยังไม่พร้อมและเริ่มด้วย manual/import
- ยอมรับว่าอุปกรณ์จริงต้องเก็บผ่าน Initial Survey
- รับทราบนโยบายห้ามเก็บข้อมูลเหตุ SOS จริง

## รายการเอกสาร

- `01_PROJECT_BRIEF_PRD.md` - outcome, scope, roles, workflow, rules
- `02_UX_UI_SPEC_A.md` - IA, design system, responsive, accessibility, performance
- `03_SOLUTION_ARCHITECTURE.md` - stack, services, jobs, deployment, observability
- `04_DATA_API_SYNC_SPEC.md` - data, state machine, API, import, offline sync
- `05_SECURITY_OPERATIONS.md` - identity, file, audit, retention, backup/runbook
- `06_DELIVERY_QA_UAT.md` - roadmap, tests, traceability, cutover, DoD
- `07_DECISIONS_RISKS_OPEN_ITEMS.md` - confirmed decisions, risks, open inputs
- `08_AGENT_PROGRAMMER_HANDOFF_PROMPT.md` - master execution prompt ฉบับอัปเดต
- `09_PROTOTYPE_A_QA_BASELINE.md` - Lighthouse baseline และ accessibility findings ของแบบ A
