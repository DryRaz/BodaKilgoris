'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import type { CatalogItem } from '@/lib/types';

export interface CatalogError { message: string; code: string | null }

/**
 * The active catalogue. Ordered by category then sort_order; no language column is ever used to filter
 * (the screen picks name_sw or name_en when it displays an article).
 * A failed request is NEVER turned into a silent empty list: it is logged with everything Supabase says
 * (message, code, details, hint) and returned as `error`, so the screen can offer a retry.
 */
export function useCatalog(): { items: CatalogItem[]; loaded: boolean; error: CatalogError | null; retry: () => void } {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<CatalogError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setError(null);
    void getSupabase()
      .from('catalog_items')
      .select('id, name_en, name_sw, category, unit, active, sort_order')
      .eq('active', true)
      .order('category')
      .order('sort_order')
      .limit(500)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) {
          console.error('[boda] catalog_items load failed', { message: err.message, code: err.code, details: err.details, hint: err.hint });
          setError({ message: err.message, code: err.code ?? null });
        } else {
          setItems((data ?? []) as CatalogItem[]);
          if (!data || data.length === 0) console.error('[boda] catalog_items is empty: no active article was returned (table not seeded, or RLS hides every row)');
        }
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { items, loaded, error, retry };
}
