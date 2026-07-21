'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only (keeps the dev loop free of
 * stale-cache surprises across the home ↔ work machines).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // registration failure is non-fatal; app still works online
      });
    }
  }, []);
  return null;
}
