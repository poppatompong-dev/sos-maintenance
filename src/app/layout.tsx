import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import './globals.css';

// One well-tuned Thai/Latin family carries headings, labels, data and body.
const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: '--font-ibm-plex-thai',
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ศูนย์ควบคุมเสา SOS · เทศบาลนครนครสวรรค์',
  description:
    'ระบบบริหารซ่อมบำรุงและติดตามความพร้อมของเสาขอความช่วยเหลือฉุกเฉิน SOS',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'SOS Care', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0b1930',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${ibmPlexThai.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
