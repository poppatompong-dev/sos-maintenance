import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${ibmPlexThai.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
