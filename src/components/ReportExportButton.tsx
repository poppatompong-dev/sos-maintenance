'use client';

import { ClipboardIcon } from './icons';

export function ReportExportButton() {
  function handleDownloadCsv() {
    window.open('/api/reports/export?format=csv', '_blank');
  }

  function handlePrintPdf() {
    window.print();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDownloadCsv}
        className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-panel active:scale-[0.98]"
        title="ดาวน์โหลดรายงานสรุปเป็นไฟล์ Excel/CSV (ภาษาไทย UTF-8)"
      >
        <ClipboardIcon size={16} className="text-brand" />
        ส่งออก Excel (CSV)
      </button>

      <button
        type="button"
        onClick={handlePrintPdf}
        className="hidden min-h-[38px] items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-xs transition-colors hover:bg-panel hover:text-ink sm:flex active:scale-[0.98]"
        title="พิมพ์รายงานหรือบันทึกเป็น PDF"
      >
        พิมพ์รายงาน / PDF
      </button>
    </div>
  );
}
