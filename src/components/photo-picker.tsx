'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { errMessage, logClient } from '@/lib/clientlog';
import { compressPhoto } from '@/lib/image-compress';
import { uploadBodaPhoto } from '@/lib/photo-upload';
import { Banner, Button } from './ui';

type Phase = 'idle' | 'compressing' | 'uploading' | 'failed' | 'done';

/**
 * Photo capture + compression + upload, built to survive low-RAM Android phones:
 *  - the NATIVE camera app is opened through <input type="file" capture>; no getUserMedia, no video
 *    stream inside the page (that is what gets the page killed)
 *  - the picture is shrunk to <= 800 px / ~150 KB right after capture, BEFORE anything is displayed
 *  - the preview is an object URL of the small JPEG only, revoked when replaced or unmounted
 *  - a failed upload keeps the small file in memory: "Try again" needs no new picture
 *
 * `onBeforeCamera` runs synchronously just before the camera opens (save your draft there).
 */
export function PhotoUploader({
  currentUrl,
  onUploaded,
  onBeforeCamera,
  onCaptureDone,
}: {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  onBeforeCamera?: () => void;
  onCaptureDone?: () => void;
}) {
  const t = useTranslations('auth');
  const errMsg = useErrorMessage();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [small, setSmall] = useState<File | null>(null); // the compressed photo, kept for retries
  const [preview, setPreview] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // one object URL at a time, always for the compressed file, always released
  useEffect(() => {
    if (!small) return setPreview(null);
    const url = URL.createObjectURL(small);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [small]);

  async function upload(file: File) {
    setPhase('uploading');
    setError(null);
    try {
      const { photoUrl } = await uploadBodaPhoto(file);
      setSavedUrl(photoUrl);
      setSmall(null);
      setPhase('done');
      onUploaded(photoUrl);
    } catch (err) {
      logClient('photo.upload_gave_up', { bytes: file.size, error: errMessage(err) });
      setError(errMsg(err));
      setPhase('failed');
    }
  }

  async function onPicked(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ''; // lets the same picture be picked again and releases the reference to the original
    onCaptureDone?.();
    if (!file) {
      logClient('photo.capture_empty', {}, 'warn'); // camera closed without a picture
      return;
    }
    setPhase('compressing');
    setError(null);
    let compact: File;
    try {
      const started = performance.now();
      compact = await compressPhoto(file);
      logClient('photo.compressed', { from: file.size, to: compact.size, ms: Math.round(performance.now() - started) }, 'info');
    } catch (err) {
      logClient('photo.compress_failed', { bytes: file.size, type: file.type, error: errMessage(err) });
      setError(errMsg(err));
      setPhase('failed');
      return;
    }
    setSmall(compact);
    await upload(compact);
  }

  const busy = phase === 'compressing' || phase === 'uploading';
  const shown = preview ?? savedUrl ?? currentUrl ?? null;
  const hasPhoto = phase === 'done' || !!currentUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-white text-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown ? <img src={shown} alt="" className="size-full object-cover" /> : <span aria-hidden>🧑🏾</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              onBeforeCamera?.();
              camera.current?.click();
            }}
            className="w-full"
          >
            📷 {hasPhoto ? t('photoRetake') : t('photoCamera')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => gallery.current?.click()} className="w-full">
            🖼️ {t('photoGallery')}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted">{t('photoHint')}</p>

      {phase === 'compressing' && <Banner kind="info">{t('photoProcessing')}</Banner>}
      {phase === 'uploading' && <Banner kind="info">{t('photoUploading')}</Banner>}
      {phase === 'done' && <Banner kind="success">{t('photoSaved')}</Banner>}
      {phase === 'failed' && (
        <div className="space-y-2">
          {error && <Banner kind="error">{error}</Banner>}
          {small && <Button className="w-full" onClick={() => void upload(small)}>{t('photoRetry')}</Button>}
        </div>
      )}

      {/* native camera app (front camera) */}
      <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void onPicked(e.currentTarget)} />
      {/* gallery / file picker */}
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => void onPicked(e.currentTarget)} />
    </div>
  );
}
