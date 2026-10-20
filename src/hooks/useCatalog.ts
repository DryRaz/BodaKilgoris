'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import type { CatalogItem } from '@/lib/types';

/** The active catalogue (≈30 short rows). Loaded once per visit to the list screen; empty on failure. */
export function useCatalog(): { items: CatalogItem[]; loaded: boolean } {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void getSupabase()
      .from('catalog_items')
      .select('id, name_en, name_sw, category, unit, active, sort_order')
      .eq('active', true)
      .order('sort_order')
      .limit(500)
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data) setItems(data as CatalogItem[]);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { items, loaded };
}
