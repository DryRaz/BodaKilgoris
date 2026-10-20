'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white active:bg-brand-700 disabled:bg-brand-600/50',
  accent: 'bg-accent-400 text-[#1a1200] active:bg-accent-500 disabled:bg-accent-400/50',
  secondary: 'bg-white text-ink border-2 border-line active:bg-brand-50 disabled:opacity-50',
  danger: 'bg-danger text-white active:opacity-90 disabled:opacity-50',
  ghost: 'bg-transparent text-brand-700 active:bg-brand-50 disabled:opacity-50',
};
const SIZES: Record<Size, string> = {
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-16 px-6 text-xl',
};

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent ${className}`}
    />
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn('inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-colors', VARIANTS[variant], SIZES[size], className)}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  return <section {...rest} className={cn('rounded-2xl border border-line bg-white p-4 shadow-sm', className)}>{children}</section>;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

export const inputClass =
  'block w-full min-h-12 rounded-xl border-2 border-line bg-white px-4 text-lg placeholder:text-muted/60 focus:border-brand-500 focus:outline-none';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

/** 4 digits, numeric keyboard on phones, masked with a show/hide toggle. */
export function PinInput({
  id, value, onChange, autoComplete = 'off',
}: { id?: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  const t = useTranslations('common');
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
        pattern="[0-9]*"
        type={shown ? 'text' : 'password'}
        maxLength={4}
        autoComplete={autoComplete}
        className={`${inputClass} pr-20 text-center font-mono text-2xl tracking-[0.6em]`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-0 right-2 px-3 text-sm font-semibold text-brand-700"
      >
        {shown ? t('hidePassword') : t('showPassword')}
      </button>
    </div>
  );
}

export function Banner({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) {
  const cls = {
    info: 'bg-brand-50 text-brand-900 border-brand-100',
    success: 'bg-brand-100 text-brand-900 border-brand-500/30',
    warn: 'bg-warn-50 text-[#5c4300] border-accent-400/60',
    error: 'bg-danger-50 text-danger border-danger/30',
  }[kind];
  return <div className={`rounded-xl border px-4 py-3 text-base font-medium ${cls}`}>{children}</div>;
}

export function Stars({ value, count, size = 'text-base' }: { value: number; count?: number; size?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${size}`} aria-label={`${value.toFixed(1)} / 5`}>
      <span className="text-accent-500" aria-hidden>
        {'★'.repeat(rounded)}
        <span className="text-line">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className="font-semibold text-ink">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted">({count})</span>}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const t = useTranslations('client');
  return (
    <div className="flex justify-center gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('stars', { count: n })}
          onClick={() => onChange(value === n ? null : n)} // tap again = no rating (optional)
          className={`size-14 text-4xl leading-none transition-transform active:scale-90 ${
            value !== null && n <= value ? 'text-accent-500' : 'text-line'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
