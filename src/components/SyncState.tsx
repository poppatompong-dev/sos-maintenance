'use client';

import { useEffect, useState } from 'react';

/**
 * Connectivity indicator for the field shell. Reflects the real online/offline
 * state (doc 08 sync states). The richer queue states — ยังไม่ซิงก์ / กำลังซิงก์ /
 * ซิงก์ไม่สำเร็จ — arrive with the IndexedDB sync queue in a later sprint.
 */
export function SyncState() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        online ? 'bg-ready-tint text-ready-ink' : 'bg-watch-tint text-watch-ink'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${online ? 'bg-ready' : 'bg-watch'}`}
      />
      {online ? 'ซิงก์แล้ว' : 'ออฟไลน์ — จะซิงก์เมื่อกลับมาออนไลน์'}
    </span>
  );
}
