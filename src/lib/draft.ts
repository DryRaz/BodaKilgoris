/**
 * Sign-up draft kept in localStorage so a page that Android kills while the camera is open
 * comes back exactly where the Boda was. The PIN is NEVER stored: it is re-typed when needed.
 */
const KEY = 'boda.registerDraft.v1';
const MAX_AGE_MS = 24 * 3600_000;

export type RegisterStep = 'details' | 'photo';

export interface RegisterDraft {
  name: string;
  phone: string;
  plate: string;
  language: string;
  step: RegisterStep;
  /** set right before the camera opens; still present on the next load = the page was killed meanwhile */
  cameraOpenedAt?: number;
  savedAt: number;
}

export function loadDraft(): RegisterDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<RegisterDraft>;
    if (typeof d.savedAt !== 'number' || Date.now() - d.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return {
      name: typeof d.name === 'string' ? d.name : '',
      phone: typeof d.phone === 'string' ? d.phone : '',
      plate: typeof d.plate === 'string' ? d.plate : '',
      language: typeof d.language === 'string' ? d.language : '',
      step: d.step === 'photo' ? 'photo' : 'details',
      cameraOpenedAt: typeof d.cameraOpenedAt === 'number' ? d.cameraOpenedAt : undefined,
      savedAt: d.savedAt,
    };
  } catch {
    return null;
  }
}

/** Merges `patch` into the stored draft. Returns false when storage is unavailable (private mode, full). */
export function saveDraft(patch: Partial<Omit<RegisterDraft, 'savedAt'>>): boolean {
  try {
    const current = loadDraft() ?? { name: '', phone: '', plate: '', language: '', step: 'details' as RegisterStep, savedAt: 0 };
    const next: RegisterDraft = { ...current, ...patch, savedAt: Date.now() };
    if (patch.cameraOpenedAt === undefined && 'cameraOpenedAt' in patch) delete next.cameraOpenedAt;
    localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
