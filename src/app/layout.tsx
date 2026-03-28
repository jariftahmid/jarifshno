
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'Web Uno Arena - Multiplayer Card Game',
  description: 'A modern, multiplayer Uno experience with AI hints and glassmorphism design.',
  manifest: '/manifest.json',
  themeColor: '#D34CDB',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased bg-background text-foreground overflow-hidden h-screen w-screen`}>
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
        
        {/* Monetag Vignette Ad Script */}
        <Script id="monetag-vignette" strategy="afterInteractive">
          {`(function(s){s.dataset.zone='10782652',s.src='https://izcle.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`}
        </Script>
      </body>
    </html>
  );
}
