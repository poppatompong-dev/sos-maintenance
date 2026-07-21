import { RefreshIcon } from '@/components/icons';

export const metadata = { title: 'ออฟไลน์ · SOS Care' };

/** Static offline fallback served by the service worker when navigation fails. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-unknown-tint text-unknown-ink">
        <RefreshIcon size={26} />
      </span>
      <h1 className="text-lg font-bold text-ink">ขณะนี้ออฟไลน์</h1>
      <p className="max-w-[36ch] text-sm leading-relaxed text-muted">
        ไม่สามารถเชื่อมต่อเครือข่ายได้ งานและหลักฐานที่บันทึกไว้จะถูกซิงก์
        โดยอัตโนมัติเมื่อกลับมาออนไลน์
      </p>
    </main>
  );
}
