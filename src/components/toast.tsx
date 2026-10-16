'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'info' | 'success' | 'error';
interface ToastItem { id: number; message: string; kind: ToastKind }
interface ToastApi { show: (message: string, kind?: ToastKind) => void }

const ToastContext = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

const KIND_CLASS: Record<ToastKind, string> = {
  info: 'bg-ink text-white',
  success: 'bg-brand-700 text-white',
  error: 'bg-danger text-white',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[2000] flex flex-col items-center gap-2 px-4 pb-4"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-base font-medium shadow-lg ${KIND_CLASS[t.kind]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
