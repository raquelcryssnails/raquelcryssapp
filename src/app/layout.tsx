
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getAppSettingsFS } from '@/lib/firebase/firestoreService';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettingsFS();

  return {
    title: settings?.salonName ? `${settings.salonName} – Gestão Inteligente` : 'NailStudio AI – Gestão Inteligente',
    description: 'Painel administrativo para salão de beleza com React, TypeScript e Firebase.',
    manifest: '/manifest.json',
    themeColor: settings?.themeColor || '#E62E7B',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: settings?.salonName || 'NailStudio AI',
    },
    icons: {
      apple: settings?.appleTouchIconUrl || '/apple-touch-icon.png',
    },
  };
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Belleza&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Alegreya:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <SettingsProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </SettingsProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
