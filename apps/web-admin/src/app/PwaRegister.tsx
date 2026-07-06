'use client';

import { useEffect } from 'react';

/** Registers the service worker so the admin panel is installable / offline-capable. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
