'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Loading } from '@/components/app-header';
import { Button, Card, TextInput } from '@/components/ui';
import { useCatalog } from '@/hooks/useCatalog';
import { useLocaleContext } from '@/i18n/provider';
import { CATEGORY_ORDER, itemLabel, unitStep, type DraftLine } from '@/lib/shopping';
import type { CatalogItem } from '@/lib/types';
import { QtyStepper } from './qty-stepper';

const newKey = () => `x:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Step 1: tick articles from the catalogue (grouped by category) and/or add free-text articles. */
export function ListBuilder({
  lines, setLines, onNext, onClear,
}: { lines: DraftLine[]; setLines: (lines: DraftLine[]) => void; onNext: () => void; onClear: () => void }) {
  const t = useTranslations('shopping');
  const { locale } = useLocaleContext();
  const { items, loaded, error, retry } = useCatalog();
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');

  const chosen = useMemo(() => new Map(lines.filter((l) => l.catalogId).map((l) => [l.catalogId!, l])), [lines]);
  const customLines = lines.filter((l) => !l.catalogId);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? items.filter((i) => i.name_en.toLowerCase().includes(q) || i.name_sw.toLowerCase().includes(q)) : items;
    const by = new Map<string, CatalogItem[]>();
    for (const i of shown) by.set(i.category, [...(by.get(i.category) ?? []), i]);
    const known = CATEGORY_ORDER.filter((c) => by.has(c));
    const others = [...by.keys()].filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c));
    return [...known, ...others].map((c) => ({ category: c, items: by.get(c)! }));
  }, [items, query]);

  function toggle(item: CatalogItem) {
    if (chosen.has(item.id)) return setLines(lines.filter((l) => l.catalogId !== item.id));
    setLines([...lines, { key: `c:${item.id}`, catalogId: item.id, nameEn: item.name_en, nameSw: item.name_sw, unit: item.unit, quantity: unitStep(item.unit) }]);
  }
  const setQty = (key: string, quantity: number) => setLines(lines.map((l) => (l.key === key ? { ...l, quantity } : l)));

  function addCustom() {
    const text = custom.trim();
    if (!text) return;
    setLines([...lines, { key: newKey(), custom: text.slice(0, 120), quantity: 1 }]);
    setCustom('');
  }

  const categoryName = (c: string) => ((CATEGORY_ORDER as readonly string[]).includes(c) ? t(`categories.${c}` as never) : c);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold">{t('listTitle')}</h2>
      <TextInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        autoComplete="off"
      />

      {!loaded && <Loading />}
      {/* never an empty screen: say so, offer a retry, and the "Other item" box below keeps working */}
      {loaded && items.length === 0 && (
        <Card className="space-y-3 border-2 border-accent-400 bg-warn-50 text-center" role="alert" data-testid="catalog-unavailable">
          <p className="text-lg font-extrabold">{t('loadFailed')}</p>
          <p className="text-sm">{t('loadFailedHint')}</p>
          {error?.code && <p className="text-xs text-muted">({error.code})</p>}
          <Button onClick={retry}>{t('retry')}</Button>
        </Card>
      )}
      {loaded && items.length > 0 && groups.length === 0 && <Card className="text-center text-muted">{t('noMatch')}</Card>}

      {groups.map((g) => (
        <section key={g.category} className="space-y-2" aria-label={categoryName(g.category)}>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">{categoryName(g.category)}</h3>
          <ul className="space-y-2">
            {g.items.map((item) => {
              const line = chosen.get(item.id);
              const name = itemLabel(item, locale);
              return (
                <li key={item.id} className={`flex items-center gap-2 rounded-2xl border-2 px-2 ${line ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!line}
                    onClick={() => toggle(item)}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg border-2 text-lg font-extrabold ${line ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-transparent'}`} aria-hidden>✓</span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-bold">{name}</span>
                      <span className="block text-xs text-muted">{t(`units.${item.unit}` as never)}</span>
                    </span>
                  </button>
                  {line && <QtyStepper value={line.quantity} unit={line.unit} name={name} onChange={(v) => setQty(line.key, v)} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Card className="space-y-3">
        <h3 className="text-lg font-extrabold">{t('otherTitle')}</h3>
        <form onSubmit={(e) => { e.preventDefault(); addCustom(); }} className="flex gap-2">
          <TextInput
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={t('otherPlaceholder')}
            aria-label={t('otherTitle')}
            maxLength={120}
            autoComplete="off"
          />
          <Button type="submit" className="shrink-0" disabled={!custom.trim()}>{t('addItem')}</Button>
        </form>
        {customLines.length > 0 && (
          <ul className="space-y-2">
            {customLines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 rounded-2xl border-2 border-brand-600 bg-brand-50 px-3 py-1">
                <span className="min-w-0 flex-1 break-words text-base font-bold">{l.custom}</span>
                <QtyStepper value={l.quantity} name={l.custom ?? ''} onChange={(v) => setQty(l.key, v)} />
                <button type="button" aria-label={`${t('remove')}: ${l.custom}`} onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="grid size-12 shrink-0 place-items-center text-2xl active:opacity-60">🗑️</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">{t('otherHint')}</p>
      </Card>

      <div className="sticky bottom-2 z-[900] space-y-2 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur">
        <p className="text-center text-base font-bold" aria-live="polite">{t('itemsCount', { count: lines.length })}</p>
        <Button size="lg" className="w-full" disabled={lines.length === 0} onClick={onNext}>{t('checkList')}</Button>
        {lines.length === 0 && <p className="text-center text-sm text-muted">{t('emptyList')}</p>}
        {lines.length > 0 && <Button variant="ghost" className="w-full text-danger" onClick={onClear}>{t('startOver')}</Button>}
      </div>
    </div>
  );
}
