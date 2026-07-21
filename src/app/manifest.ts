import type { MetadataRoute } from 'next';

// PWA manifest (doc 08: Technician view installable via HTTPS). The Technician
// field shell is the install target (start at /today).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ระบบซ่อมบำรุงเสา SOS เทศบาลนครนครสวรรค์',
    short_name: 'SOS Care',
    description:
      'สำรวจ ตรวจบำรุง ซ่อม และติดตามความพร้อมของเสาขอความช่วยเหลือฉุกเฉิน SOS',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eef1f4',
    theme_color: '#0b1930',
    lang: 'th',
    dir: 'ltr',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
