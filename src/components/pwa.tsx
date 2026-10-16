'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from './ui';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}

export function OfflineBanner() {
  const t = useTranslations('common');
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="alert" className="safe-top sticky top-0 z-[2500] bg-accent-400 px-4 py-2 text-center text-sm font-bold text-[#1a1200]">
      {t('offline')}
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Android Chrome "install" card. Hidden once installed or dismissed. */
export function InstallPrompt() {
  const t = useTranslations('install');
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('boda.installDismissed') === '1') setDismissed(true);
    } catch {
      /* ignore */
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!event || dismissed) return null;
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <p className="font-bold">{t('title')}</p>
      <p className="mt-1 text-sm text-muted">{t('body')}</p>
      <div className="mt-3 flex gap-2">
        <Button
          onClick={async () => {
            await event.prompt();
            setEvent(null);
          }}
        >
          {t('button')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setDismissed(true);
            try { localStorage.setItem('boda.installDismissed', '1'); } catch { /* ignore */ }
          }}
        >
          {t('later')}
        </Button>
      </div>
    </div>
  );
}
