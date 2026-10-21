'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader, Loading } from '@/components/app-header';
import { useRequireRole } from '@/components/auth-provider';
import { AlertCountProvider, useAlertCount } from '@/components/admin/alert-count';
import { Button } from '@/components/ui';
import { useSweep } from '@/hooks/useSweep';

const TABS = [
  { href: '/admin', key: 'overview' },
  { href: '/admin/bodas', key: 'bodas' },
  { href: '/admin/alerts', key: 'alerts' },
  { href: '/admin/rides', key: 'rides' },
  { href: '/admin/shopping', key: 'shopping' },
  { href: '/admin/catalog', key: 'catalog' },
  { href: '/admin/places', key: 'places' },
  { href: '/admin/map', key: 'map' },
  { href: '/admin/settings', key: 'settings' },
] as const;

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span data-testid="alert-badge" className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-extrabold text-white">{n > 99 ? '99+' : n}</span>;
}

function Tabs() {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const { count } = useAlertCount();
  return (
    <nav className="sticky top-[57px] z-[1000] border-b border-line bg-white" aria-label={t('title')}>
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
        {TABS.map((tab) => {
          const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center whitespace-nowrap border-b-4 px-4 py-3 text-base font-bold ${active ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted'}`}
              >
                {t(`nav.${tab.key}`)}
                {tab.key === 'alerts' && <Badge n={count} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const { ready, signOut } = useRequireRole('admin');
  useSweep(ready); // keeps expiry / auto-confirmation / stale Bodas up to date while the admin watches

  if (!ready) return (<><AppHeader title={t('title')} /><Loading /></>);

  return (
    <AlertCountProvider enabled={ready}>
      <AppHeader
        wide
        title={t('title')}
        right={<Button variant="ghost" onClick={signOut} className="!min-h-10 !px-3 text-sm">{tc('logout')}</Button>}
      />
      <Tabs />
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">{children}</div>
    </AlertCountProvider>
  );
}
