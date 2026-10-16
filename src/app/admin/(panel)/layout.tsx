'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader, Loading } from '@/components/app-header';
import { useRequireRole } from '@/components/auth-provider';
import { Button } from '@/components/ui';
import { useSweep } from '@/hooks/useSweep';

const TABS = [
  { href: '/admin', key: 'overview' },
  { href: '/admin/bodas', key: 'bodas' },
  { href: '/admin/rides', key: 'rides' },
  { href: '/admin/map', key: 'map' },
] as const;

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const { ready, signOut } = useRequireRole('admin');
  useSweep(ready); // keeps expiry / auto-confirmation / stale Bodas up to date while the admin watches

  if (!ready) return (<><AppHeader title={t('title')} /><Loading /></>);

  return (
    <>
      <AppHeader
        wide
        title={t('title')}
        right={<Button variant="ghost" onClick={signOut} className="!min-h-10 !px-3 text-sm">{tc('logout')}</Button>}
      />
      <nav className="sticky top-[57px] z-[1000] border-b border-line bg-white" aria-label={t('title')}>
        <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
          {TABS.map((tab) => {
            const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap border-b-4 px-4 py-3 text-base font-bold ${active ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted'}`}
                >
                  {t(`nav.${tab.key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">{children}</div>
    </>
  );
}
