# UX/UI Specification - Selected Direction A

## Decision

แบบ A "ศูนย์ควบคุมบนแผนที่" เป็น primary shell ของ Planner/Executive. นำ B มาใช้เป็น Technician mobile shell และ C เป็น secondary Planner calendar

## Principles

- Premium จาก typography, spacing, hierarchy และความแม่นยำ
- หน้าแรกตอบ “เสาไหนพร้อมใช้/ต้องทำอะไรต่อ” ภายใน 5 วินาที
- เมนูหลักไม่เกิน 5 ต่อ role; หนึ่งหน้ามี primary action เดียว
- ภาษาไทยตรงงาน ห้าม generic AI/marketing copy
- ห้าม gradient, glassmorphism, orb/blob/glow, card wall, pill เกินจำเป็น, 3D illustration, emoji icon
- สถานะมี icon/text/reason ไม่ใช้สีอย่างเดียว

## Information architecture

Planner/Executive: ภาพรวมและแผนที่ / ใบงาน / ปฏิทิน / ทะเบียนเสา / รายงาน. Admin settings แยกตามสิทธิ์

Technician mobile: วันนี้ / สแกน QR / งานของฉัน. Profile/sync/sign-out อยู่ avatar menu

## Dashboard A

Utility header + status rail ต่อเนื่อง + main 65/35 (map 27 จุด + action ledger). Map/list ใช้ selection เดียวกัน. Detail drawer แสดง status/reason/latest inspection/open fault/next work/timeline. Map lazy-load และต้องมี accessible list/table fallback

## Technician B

Today โหลด IndexedDB ก่อน; QR เหนือ fold; next job เด่นหนึ่งรายการ; timeline วันนี้; sync state เห็นชัด. Checklist touch >=44px, sticky save/next. GPS >100m บังคับ reason + review flag. Offline completion ต้องบอกว่ายังไม่เสร็จที่ server จน sync สำเร็จ

## Planner calendar C

Draft batch, unscheduled queue, week/month/agenda และ inspector. Auto-generated เป็น draft; Planner approve ก่อน publish; draft ห้ามแจ้งช่าง

## Accessibility WCAG 2.2 AA

Semantic landmarks/headings/labels/errors; keyboard + visible focus; contrast; 320px reflow; 200% zoom; no hover/gesture-only; screen-reader status; ทดสอบ Chromium/Android/Safari iOS PWA ตามสมควร; prefers-reduced-motion

## Performance budgets p75

LCP <=2.5s, INP <=200ms, CLS <=0.1; initial shell JS <=200KB gzip ไม่รวม lazy map/report; Technician Today จาก cache <=1.5s บน Android ระดับกลาง. Lazy map/chart/scanner/report; image compression worker; pagination/virtualization; no paid font/tracker/API

## Required states

default/loading/empty/validation/permission denied/offline/pending sync/sync error/stale/forbidden/not found/recoverable server error พร้อม recovery copy/action

## Prototype boundary

`throwaway-ui-prototype` เป็น throwaway visual reference ห้ามนำตรงไป production ต้อง rebuild tokens/components และมี visual regression CI
