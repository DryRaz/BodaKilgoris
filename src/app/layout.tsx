import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { AuthProvider } from '@/components/auth-provider';
import { ReloadDiagnostics } from '@/components/diagnostics';
import { LanguageGate } from '@/components/language';
import { OfflineBanner, ServiceWorkerRegister } from '@/components/pwa';
import { ToastProvider } from '@/components/toast';
import { LOCALE_COOKIE, defaultLocale, isLocale } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Boda Kilgoris', template: '%s · Boda Kilgoris' },
  description: 'Motorbike taxis (Bodas) in Kilgoris, Kenya · Boda boda hapa Kilgoris',
  applicationName: 'Boda Kilgoris',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Boda Kilgoris', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#168045',
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const chosen = isLocale(stored);
  const locale = chosen ? stored : defaultLocale;

  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale} initialChosen={chosen}>
          <ToastProvider>
            <AuthProvider>
              <LanguageGate>
                <OfflineBanner />
                {children}
              </LanguageGate>
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
        <ServiceWorkerRegister />
        <ReloadDiagnostics />
      </body>
    </html>
  );
}
