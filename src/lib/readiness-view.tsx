import type { ReadinessStatus } from '@/domain/readiness';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  HelpCircleIcon,
} from '@/components/icons';

/**
 * Presentation view-model for readiness status. Status is always conveyed with
 * icon + Thai text (never colour alone — WCAG 2.2 AA, spec requirement).
 */
export interface StatusMeta {
  label: string;
  hint: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactElement;
  /** Tailwind classes for chip (tint bg + accessible ink) and the solid dot. */
  chip: string;
  dot: string;
  solidText: string;
}

export const STATUS_META: Record<ReadinessStatus, StatusMeta> = {
  READY: {
    label: 'พร้อมใช้',
    hint: 'ผ่านการตรวจล่าสุดครบ',
    Icon: CheckCircleIcon,
    chip: 'bg-ready-tint text-ready-ink',
    dot: 'bg-ready',
    solidText: 'text-ready-ink',
  },
  WATCH: {
    label: 'เฝ้าระวัง',
    hint: 'มีข้อสังเกตหรือใกล้ครบกำหนด',
    Icon: ClockIcon,
    chip: 'bg-watch-tint text-watch-ink',
    dot: 'bg-watch',
    solidText: 'text-watch-ink',
  },
  DOWN: {
    label: 'ใช้งานไม่ได้',
    hint: 'ฟังก์ชันวิกฤตไม่ผ่านหรือมีข้อขัดข้อง',
    Icon: AlertTriangleIcon,
    chip: 'bg-down-tint text-down-ink',
    dot: 'bg-down',
    solidText: 'text-down-ink',
  },
  UNKNOWN: {
    label: 'ยังไม่ทราบ',
    hint: 'ยังไม่มีผลสำรวจตั้งต้นที่อนุมัติ',
    Icon: HelpCircleIcon,
    chip: 'bg-unknown-tint text-unknown-ink',
    dot: 'bg-unknown',
    solidText: 'text-unknown-ink',
  },
};

export const STATUS_ORDER: ReadinessStatus[] = ['DOWN', 'WATCH', 'UNKNOWN', 'READY'];
