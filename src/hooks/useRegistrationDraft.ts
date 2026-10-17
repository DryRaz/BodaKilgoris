'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const FIELDS_KEY = 'boda.reg.fields'; // name / phone / plate (not secret): survives closing the tab
const SECRET_KEY = 'boda.reg.pin'; // PIN: tab-scoped only (sessionStorage), wiped when the tab closes
const PHOTO_KEY = 'boda.reg.photo'; // compressed photo (~100 KB) as a data URL, tab-scoped

export interface Draft { name: string; phone: string; plate: string; pin: string; pin2: string }
const EMPTY: Draft = { name: '', phone: '', plate: '', pin: '', pin2: '' };

const read = (store: Storage, key: string) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};
const write = (store: Storage, key: string, value: string | null) => {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* private mode / quota: the draft is a convenience, never a requirement */
  }
};

async function dataUrlToFile(dataUrl: string): Promise<File | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

const fileToDataUrl = (file: File) =>
  new Promise<string | null>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });

/**
 * On a low-end Android phone the browser often reloads the page when the camera app closes, which
 * used to wipe the whole registration form. Everything the Boda typed (and the compressed photo) is
 * therefore saved as they go and restored on load.
 */
export function useRegistrationDraft() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [photo, setPhotoState] = useState<File | null>(null);
  const [restored, setRestored] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    const fields = read(localStorage, FIELDS_KEY);
    const secret = read(sessionStorage, SECRET_KEY);
    const photoUrl = read(sessionStorage, PHOTO_KEY);
    let restoredSomething = false;
    const apply = async () => {
      try {
        const saved = fields ? (JSON.parse(fields) as Partial<Draft>) : {};
        const pins = secret ? (JSON.parse(secret) as Partial<Draft>) : {};
        const merged = { ...EMPTY, ...saved, ...pins };
        if (merged.name || merged.phone || merged.plate) restoredSomething = true;
        setDraft(merged);
      } catch {
        /* corrupted draft: start clean */
      }
      if (photoUrl) {
        const f = await dataUrlToFile(photoUrl);
        if (f) {
          setPhotoState(f);
          restoredSomething = true;
        }
      }
      ready.current = true;
      setRestored(restoredSomething);
    };
    void apply();
  }, []);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      if (ready.current) {
        write(localStorage, FIELDS_KEY, JSON.stringify({ name: next.name, phone: next.phone, plate: next.plate }));
        write(sessionStorage, SECRET_KEY, JSON.stringify({ pin: next.pin, pin2: next.pin2 }));
      }
      return next;
    });
  }, []);

  const setPhoto = useCallback((file: File | null) => {
    setPhotoState(file);
    if (!file) return write(sessionStorage, PHOTO_KEY, null);
    void fileToDataUrl(file).then((url) => write(sessionStorage, PHOTO_KEY, url));
  }, []);

  const clear = useCallback(() => {
    write(localStorage, FIELDS_KEY, null);
    write(sessionStorage, SECRET_KEY, null);
    write(sessionStorage, PHOTO_KEY, null);
  }, []);

  return { draft, update, photo, setPhoto, restored, clear };
}
