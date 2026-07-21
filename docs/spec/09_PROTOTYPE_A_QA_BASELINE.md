# Prototype A - QA Baseline

วันที่ตรวจ: 21 กรกฎาคม 2569  
URL: `http://127.0.0.1:4173/?variant=A`  
Artifact: `../output/playwright/lighthouse-A.json` และ `prototype-A-desktop.png`

## Lighthouse baseline

- Performance: 100
- Accessibility: 88
- Best Practices: 96

คะแนนนี้เป็นของ throwaway prototype บนเครื่อง local ไม่ใช่ production SLA และไม่แทน manual WCAG/PWA testing

## Findings ที่ production ต้องแก้ก่อน release

1. `button-name`: ปุ่มไอคอน notification และ overflow ใน A ไม่มี accessible name
2. `color-contrast`: caption, secondary label, time และ status text บางตำแหน่ง contrast ต่ำ
3. `errors-in-console`: `/favicon.ico` ตอบ 404
4. A ปัจจุบันยังใช้ KPI card หลายใบ; production ต้องเปลี่ยนเป็น status rail ต่อเนื่องตาม UI spec
5. Map ต้องมี accessible list/table fallback และ map chunk ต้อง lazy-load

## Required verification after implementation

- Automated axe/Lighthouse accessibility ไม่มี critical/serious และ Lighthouse accessibility >=95 โดยไม่ waive WCAG 2.2 AA
- Manual keyboard, focus order, screen reader labels, 200% zoom, 320px reflow, status without color
- Mobile touch targets >=44px และ prefers-reduced-motion
- Performance p75 LCP <=2.5s, INP <=200ms, CLS <=0.1 บน staging ที่จำลองอุปกรณ์/เครือข่ายเป้าหมาย
- No console error, broken asset, missing favicon หรือ failed network dependency
- Visual regression สำหรับ dashboard A, Technician B และ Planner calendar C

## Disposition

Prototype ได้รับเลือกด้านโครงสร้าง A แต่ยังไม่ผ่าน production accessibility gate. รายการข้างต้นต้องเข้า backlog Sprint 1 และ trace ไปยัง automated/manual evidence ใน `requirements-traceability.csv`
