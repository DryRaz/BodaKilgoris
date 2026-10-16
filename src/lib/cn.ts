import { twMerge } from 'tailwind-merge';

/** Joins class names and lets the LAST conflicting Tailwind utility win (e.g. a Card's bg-white vs a passed bg-brand-600). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean) as string[]);
}
