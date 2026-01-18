import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Vecinu - Comunitatea ta de cartier',
    template: '%s | Vecinu',
  },
  description:
    'Conectează-te cu vecinii tăi. Alertă, cumpără, vinde și descoperă servicii locale în cartierul tău.',
  keywords: ['vecini', 'cartier', 'comunitate', 'local', 'marketplace', 'alertă', 'România'],
  authors: [{ name: 'Vecinu' }],
  creator: 'Vecinu',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    siteName: 'Vecinu',
    title: 'Vecinu - Comunitatea ta de cartier',
    description: 'Conectează-te cu vecinii tăi. Alertă, cumpără, vinde și descoperă servicii locale.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vecinu - Comunitatea ta de cartier',
    description: 'Conectează-te cu vecinii tăi. Alertă, cumpără, vinde și descoperă servicii locale.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
