'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearShoppingDraft, emptyDraft, loadShoppingDraft, saveShoppingDraft, type ShoppingDraft } from '@/lib/shopping';

/**
 * The client's shopping list, persisted on every change. `ready` turns true once localStorage was read
 * (it does not exist during server rendering), so screens never flash an empty list before it is restored.
 */
export function useShoppingDraft() {
  const [draft, setDraft] = useState<ShoppingDraft>(emptyDraft);
  const [ready, setReady] = useState(false);
  const latest = useRef(draft);

  useEffect(() => {
    const stored = loadShoppingDraft();
    if (stored) {
      latest.current = stored;
      setDraft(stored);
    }
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<ShoppingDraft> | ((d: ShoppingDraft) => Partial<ShoppingDraft>)) => {
    const next = { ...latest.current, ...(typeof patch === 'function' ? patch(latest.current) : patch) };
    latest.current = next;
    setDraft(next);
    saveShoppingDraft(next);
  }, []);

  const clear = useCallback(() => {
    const fresh = emptyDraft();
    latest.current = fresh;
    setDraft(fresh);
    clearShoppingDraft();
  }, []);

  return { draft, ready, update, clear };
}
