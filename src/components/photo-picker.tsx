'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

const MAX_SIDE = 640;

/**
 * Shrinks a phone photo (often 3-12 MB) to ~100 KB before upload: slow networks, cheap data.
 * The browser decodes it ALREADY scaled down (resizeWidth) instead of at full resolution: on a
 * low-end Android phone, decoding a 12 MP photo next to the camera app is what gets the tab killed.
 */
export async function compressPhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: 1024, resizeQuality: 'medium' });
  } catch {
    bitmap = await createImageBitmap(file); // older browsers without the resize options
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
  if (!blob) throw new Error('compress_failed');
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

export function PhotoPicker({
  value, onChange, showHint = true,
}: { value: File | null; onChange: (f: File | null) => void; showHint?: boolean }) {
  const t = useTranslations('auth');
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value) return setPreview(null);
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await compressPhoto(file));
    } catch (err) {
      console.error('[boda] photo compression failed, using the original if small enough', err);
      onChange(file.size < 900_000 ? file : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-white text-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span aria-hidden>🧑🏾</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Button variant="secondary" loading={busy} onClick={() => camera.current?.click()} className="w-full">
            📷 {value ? t('photoChange') : t('photoTake')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => gallery.current?.click()} className="w-full !min-h-10 text-sm">
            {t('photoGallery')}
          </Button>
        </div>
      </div>
      {showHint && <p className="text-sm text-muted">{t('photoHint')}</p>}
      <input ref={camera} data-photo-camera type="file" accept="image/*" capture="user" className="hidden" onChange={handle} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  );
}
