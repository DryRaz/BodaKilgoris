'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

const MAX_SIDE = 640;

/** Shrinks a phone photo (often 3-6 MB) to ~100 KB before upload: slow networks, cheap data. */
async function compress(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
  if (!blob) throw new Error('compress_failed');
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

export function PhotoPicker({ value, onChange }: { value: File | null; onChange: (f: File | null) => void }) {
  const t = useTranslations('auth');
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value) return setPreview(null);
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="flex items-center gap-4">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-white text-4xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span aria-hidden>🧑🏾</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Button variant="secondary" loading={busy} onClick={() => input.current?.click()} className="w-full">
          {value ? t('photoChange') : t('photoTake')}
        </Button>
        <p className="text-sm text-muted">{t('photoHint')}</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            onChange(await compress(file));
          } catch {
            onChange(file.size < 900_000 ? file : null);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
