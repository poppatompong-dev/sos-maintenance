import Link from 'next/link';
import { QrScanner } from '@/components/QrScanner';
import { TechnicianBottomNav } from '@/components/TechnicianBottomNav';

/** Technician QR scan destination — jumps straight to the scanned pole's detail page. */
export default function ScanPage() {
  return (
    <div className="mx-auto min-h-full max-w-md bg-bg pb-24">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href="/today" className="text-xs font-medium text-brand hover:underline">
          ← กลับ
        </Link>
        <h1 className="text-sm font-bold text-ink">สแกน QR</h1>
      </header>

      <main className="px-4">
        <p className="mb-4 text-xs leading-relaxed text-muted">
          เล็งกล้องไปที่ QR บนเสา SOS เพื่อเปิดข้อมูลเสานั้นโดยตรง
        </p>
        <QrScanner />
      </main>

      <TechnicianBottomNav current="scan" />
    </div>
  );
}
