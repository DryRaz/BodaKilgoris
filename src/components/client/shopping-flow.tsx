'use client';

import { useTranslations } from 'next-intl';
import { BodasBrowser } from '@/components/client/bodas-browser';
import { Button, Card } from '@/components/ui';
import type { ShoppingDraft } from '@/lib/shopping';
import { ListBuilder } from './shopping/list-builder';
import { Review } from './shopping/review';

/**
 * The client's shopping flow: 1 list -> 2 review -> 3 choose a Boda (the same Boda browser as rides, in shopping mode).
 * Every change goes through `update`, which persists the draft: nothing here can be lost by a reload, a refusal or an expiry.
 */
export function ShoppingFlow({
  draft, update, onHome, onStartOver, requestConsent, onRequested,
}: {
  draft: ShoppingDraft;
  update: (patch: Partial<ShoppingDraft>) => void;
  onHome: () => void;
  onStartOver: () => void;
  requestConsent: () => Promise<boolean>;
  onRequested: (rideId?: string) => void;
}) {
  const t = useTranslations('shopping');
  const tc = useTranslations('common');
  const step = draft.lines.length === 0 ? 'list' : draft.step;
  const setLines = (lines: ShoppingDraft['lines']) => update({ lines });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={step === 'list' ? onHome : () => update({ step: step === 'boda' ? 'review' : 'list' })} className="-ml-3">
          ← {step === 'list' ? t('home') : tc('back')}
        </Button>
        <span className="text-sm font-bold text-muted">{t('stepOf', { step: step === 'list' ? 1 : step === 'review' ? 2 : 3 })}</span>
      </div>

      {step === 'list' && (
        <ListBuilder lines={draft.lines} setLines={setLines} onNext={() => update({ step: 'review' })} onClear={onStartOver} />
      )}

      {step === 'review' && (
        <Review
          lines={draft.lines}
          setLines={setLines}
          budget={draft.budget}
          note={draft.note}
          onBudget={(budget) => update({ budget })}
          onNote={(note) => update({ note })}
          onBack={() => update({ step: 'list' })}
          onNext={() => update({ step: 'boda' })}
        />
      )}

      {step === 'boda' && (
        <>
          <Card className="flex items-center justify-between gap-3">
            <p className="text-base font-bold">🛒 {t('yourList', { count: draft.lines.length })}</p>
            <Button variant="secondary" onClick={() => update({ step: 'review' })}>{t('editList')}</Button>
          </Card>
          <BodasBrowser
            requestConsent={requestConsent}
            onRequested={onRequested}
            shopping={{
              lines: draft.lines, budget: draft.budget, note: draft.note, landmark: draft.landmark,
              onLandmark: (landmark) => update({ landmark }),
            }}
          />
        </>
      )}
    </div>
  );
}
