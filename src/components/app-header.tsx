'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from './language';

export function AppHeader({
  title,
  backHref,
  right,
  wide = false,
}: {
  title?: string;
  backHref?: string;
  right?: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <header className="safe-top sticky top-0 z-[1100] border-b border-line bg-white/95 backdrop-blur">
      <div className={`mx-auto flex min-h-14 items-center gap-2 px-4 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {backHref && (
          <Link href={backHref} aria-label={t('back')} className="-ml-2 grid size-11 place-items-center rounded-full text-2xl active:bg-brand-50">
            ←
          </Link>
        )}
        <h1 className="line-clamp-2 min-w-0 flex-1 text-base font-extrabold leading-tight">{title ?? t('appName')}</h1>
        {right}
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={`safe-bottom mx-auto w-full ${wide ? 'max-w-5xl' : 'max-w-3xl'} space-y-4 px-4 py-4`}>{children}</main>;
}

export function Loading() {
  const t = useTranslations('common');
  return (
    <div className="grid min-h-[50dvh] place-items-center text-muted">
      <div className="flex items-center gap-3 text-lg">
        <span className="inline-block size-6 animate-spin rounded-full border-[3px] border-brand-600 border-t-transparent" />
        {t('loading')}
      </div>
    </div>
  );
}
