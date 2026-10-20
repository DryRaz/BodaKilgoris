/**
 * Shrinks a camera photo (3-12 MB, 8-50 MP) to a small JPEG BEFORE it is shown or uploaded.
 * Low-RAM Android phones are the target: we never keep the original, never create an object URL
 * for it, and release the bitmap/canvas memory as soon as the JPEG exists.
 *
 *   max 800 px on the long side · JPEG ~0.7 · target < 200 KB
 */
export const PHOTO_MAX_SIDE = 800;
export const PHOTO_TARGET_BYTES = 200 * 1024;
const QUALITIES = [0.7, 0.6, 0.5, 0.4];

export class PhotoError extends Error {
  constructor(public code: 'photo_unreadable' | 'photo_too_large') {
    super(code);
  }
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      /* some WebViews reject the options or the format: fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => { img.src = ''; } };
  } finally {
    URL.revokeObjectURL(url); // the pixels are decoded: the URL is no longer needed
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export async function compressPhoto(file: Blob): Promise<File> {
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new PhotoError('photo_unreadable');
  }
  const canvas = document.createElement('canvas');
  try {
    const { source, width, height } = decoded;
    if (!width || !height) throw new PhotoError('photo_unreadable');
    let scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(width, height));
    let best: Blob | null = null;

    // lower the quality first, then the size, until the file is small enough
    for (let pass = 0; pass < 2 && (!best || best.size > PHOTO_TARGET_BYTES); pass++) {
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new PhotoError('photo_unreadable');
      ctx.fillStyle = '#fff'; // JPEG has no alpha: transparent PNGs would turn black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      for (const q of QUALITIES) {
        const blob = await toBlob(canvas, q);
        if (!blob) throw new PhotoError('photo_unreadable');
        best = blob;
        if (blob.size <= PHOTO_TARGET_BYTES) break;
      }
      scale *= 0.75;
    }
    if (!best) throw new PhotoError('photo_unreadable');
    if (best.size > 900_000) throw new PhotoError('photo_too_large'); // server/bucket limit is 1 MB
    return new File([best], 'photo.jpg', { type: 'image/jpeg' });
  } finally {
    decoded.release();
    canvas.width = canvas.height = 0; // hand the pixel buffer back right away
  }
}
