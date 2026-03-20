import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Web Uno Arena - Multiplayer Card Game',
  description: 'A modern, multiplayer Uno experience with AI hints and glassmorphism design.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground overflow-hidden h-screen w-screen">
        {children}
      </body>
    </html>
  );
}
