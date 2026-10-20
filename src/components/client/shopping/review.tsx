'use client';

import { useTranslations } from 'next-intl';
import { Banner, Button, Card, Field, TextInput } from '@/components/ui';
import { useLocaleContext } from '@/i18n/provider';
import { itemLabel, type DraftLine } from '@/lib/shopping';
import { QtyStepper } from './qty-stepper';

/** Step 2: the editable recap (quantities, removal), optional budget and note, and the "no money in the app" notice. */
export function Review({
  lines, setLines, budget, note, onBudget, onNote, onBack, onNext,
}: {
  lines: DraftLine[];
  setLines: (lines: DraftLine[]) => void;
  budget: string;
  note: string;
  onBudget: (v: string) => void;
  onNote: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('shopping');
  const { locale } = useLocaleContext();

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold">{t('reviewTitle')}</h2>
      <p className="text-base font-bold" aria-live="polite">{t('itemsCount', { count: lines.length })}</p>

      <ul className="space-y-2" aria-label={t('reviewTitle')}>
        {lines.map((l) => {
          const name = itemLabel({ name_en: l.nameEn, name_sw: l.nameSw, custom_name: l.custom }, locale);
          return (
            <li key={l.key} className="flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-3 py-1" data-testid="review-line">
              <span className="min-w-0 flex-1 break-words text-base font-bold">{name}</span>
              <QtyStepper value={l.quantity} unit={l.unit} name={name} onChange={(v) => setLines(lines.map((x) => (x.key === l.key ? { ...x, quantity: v } : x)))} />
              <button type="button" aria-label={`${t('remove')}: ${name}`} onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="grid size-12 shrink-0 place-items-center text-2xl active:opacity-60">🗑️</button>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" className="w-full" onClick={onBack}>＋ {t('addMore')}</Button>

      <Card className="space-y-4">
        <Field label={t('budgetLabel')} hint={t('budgetHint')}>
          {(id) => (
            <TextInput id={id} value={budget} onChange={(e) => onBudget(e.target.value.replace(/\D/g, '').slice(0, 7))} inputMode="numeric" placeholder="1500" autoComplete="off" />
          )}
        </Field>
        <Field label={t('noteLabel')}>
          {(id) => <TextInput id={id} value={note} onChange={(e) => onNote(e.target.value)} placeholder={t('notePlaceholder')} maxLength={500} autoComplete="off" />}
        </Field>
      </Card>

      <Banner kind="warn">{t('payNotice')}</Banner>
      <Button size="lg" className="w-full" disabled={lines.length === 0} onClick={onNext}>{t('chooseBoda')}</Button>
    </div>
  );
}
