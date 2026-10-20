'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loading } from '@/components/app-header';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Field, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { CATEGORY_ORDER, UNITS } from '@/lib/shopping';
import { getSupabase } from '@/lib/supabase/client';
import type { CatalogItem } from '@/lib/types';

const selectClass = 'min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 text-base';

/**
 * The article catalogue clients tick from. Add / edit / hide / reorder. Names exist in English and Swahili;
 * hiding an article removes it from new lists only: past orders keep the names they were made with.
 */
export default function AdminCatalogPage() {
  const t = useTranslations('admin.catalog');
  const ts = useTranslations('shopping');
  const te = useErrorMessage();
  const toast = useToast();
  const [rows, setRows] = useState<CatalogItem[] | null>(null);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [nameEn, setNameEn] = useState('');
  const [nameSw, setNameSw] = useState('');
  const [category, setCategory] = useState<string>(CATEGORY_ORDER[0]);
  const [unit, setUnit] = useState<string>('piece');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('catalog_items')
      .select('id, name_en, name_sw, category, unit, active, sort_order')
      .order('sort_order');
    if (error) toast.show(te(error), 'error');
    else setRows((data ?? []) as CatalogItem[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const extra = (rows ?? []).map((r) => r.category).filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c));
    return [...CATEGORY_ORDER, ...new Set(extra)] as string[];
  }, [rows]);
  const catName = (c: string) => ((CATEGORY_ORDER as readonly string[]).includes(c) ? ts(`categories.${c}` as never) : c);

  function reset() {
    setEditing(null);
    setNameEn('');
    setNameSw('');
    setUnit('piece');
  }
  function edit(i: CatalogItem) {
    setEditing(i);
    setNameEn(i.name_en);
    setNameSw(i.name_sw);
    setCategory(i.category);
    setUnit(i.unit);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(item: Pick<CatalogItem, 'name_en' | 'name_sw' | 'category' | 'unit' | 'active'> & { id: string | null }, key: string) {
    setBusy(key);
    const { error } = await getSupabase().rpc('admin_save_catalog_item', {
      p_id: item.id, p_name_en: item.name_en, p_name_sw: item.name_sw, p_category: item.category, p_unit: item.unit, p_active: item.active,
    });
    setBusy(null);
    if (error) {
      toast.show(te(error), 'error');
      return false;
    }
    toast.show(t('saved'), 'success');
    await load();
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameEn.trim() || !nameSw.trim()) return toast.show(te('invalid_item'), 'error');
    const ok = await save({ id: editing?.id ?? null, name_en: nameEn.trim(), name_sw: nameSw.trim(), category, unit, active: editing?.active ?? true }, 'form');
    if (ok) reset();
  }

  async function move(list: CatalogItem[], index: number, dir: -1 | 1) {
    const other = list[index + dir];
    if (!other) return;
    setBusy(list[index].id);
    const { error } = await getSupabase().rpc('admin_swap_catalog_order', { p_a: list[index].id, p_b: other.id });
    setBusy(null);
    if (error) toast.show(te(error), 'error');
    await load();
  }

  if (!rows) return <Loading />;

  return (
    <>
      <h2 className="text-2xl font-extrabold">{t('title')} ({rows.filter((r) => r.active).length})</h2>
      <Banner kind="info">{t('intro')}</Banner>

      <Card className="space-y-4">
        <h3 className="text-lg font-extrabold">{editing ? t('editTitle') : t('addTitle')}</h3>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('nameEn')}>{(id) => <TextInput id={id} value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={80} placeholder="Sugar" autoComplete="off" />}</Field>
            <Field label={t('nameSw')}>{(id) => <TextInput id={id} value={nameSw} onChange={(e) => setNameSw(e.target.value)} maxLength={80} placeholder="Sukari" autoComplete="off" />}</Field>
            <Field label={t('category')}>
              {(id) => (
                <select id={id} value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                  {categories.map((c) => <option key={c} value={c}>{catName(c)}</option>)}
                </select>
              )}
            </Field>
            <Field label={t('unit')} hint={t('unitHint')}>
              {(id) => (
                <select id={id} value={unit} onChange={(e) => setUnit(e.target.value)} className={selectClass}>
                  {[...new Set([...UNITS, unit])].map((u) => <option key={u} value={u}>{(UNITS as readonly string[]).includes(u) ? ts(`units.${u}` as never) : u}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={busy === 'form'} disabled={!nameEn.trim() || !nameSw.trim()}>{editing ? t('saveChanges') : t('add')}</Button>
            {editing && <Button variant="secondary" onClick={reset}>{t('cancelEdit')}</Button>}
          </div>
        </form>
      </Card>

      {categories.map((c) => {
        const list = rows.filter((r) => r.category === c);
        if (list.length === 0) return null;
        return (
          <section key={c} className="space-y-2" aria-label={catName(c)}>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">{catName(c)} ({list.length})</h3>
            <ul className="space-y-2">
              {list.map((i, idx) => (
                <li key={i.id}>
                  <Card className={`flex flex-wrap items-center gap-3 ${i.active ? '' : 'opacity-60'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-extrabold">{i.name_en} <span className="font-semibold text-muted">/ {i.name_sw}</span></p>
                      <p className="text-sm text-muted">{ts(`units.${i.unit}` as never)} · #{i.sort_order}{!i.active && ` · ${t('hidden')}`}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" aria-label={`${t('up')}: ${i.name_en}`} disabled={idx === 0 || busy === i.id} onClick={() => void move(list, idx, -1)} className="!px-3">↑</Button>
                      <Button variant="secondary" aria-label={`${t('down')}: ${i.name_en}`} disabled={idx === list.length - 1 || busy === i.id} onClick={() => void move(list, idx, 1)} className="!px-3">↓</Button>
                      <Button variant="secondary" onClick={() => edit(i)}>{t('edit')}</Button>
                      <Button variant={i.active ? 'danger' : 'primary'} loading={busy === `a:${i.id}`}
                        onClick={() => void save({ id: i.id, name_en: i.name_en, name_sw: i.name_sw, category: i.category, unit: i.unit, active: !i.active }, `a:${i.id}`)}>
                        {i.active ? t('hide') : t('show')}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
