// In-app alerts for an incoming ride request: sound + vibration + title flash,
// plus a system notification when the app is in the background (no push server needed
// as long as the page is still alive).
let audioCtx: AudioContext | null = null;

export function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx ??= new Ctx();
    void audioCtx.resume();
    const now = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach((offset, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.frequency.value = i === 2 ? 1175 : 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.22);
    });
  } catch {
    /* audio blocked until the first tap: harmless */
  }
}

export function vibrate(pattern: number[] = [300, 120, 300, 120, 500]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

let flashTimer: ReturnType<typeof setInterval> | null = null;
export function flashTitle(message: string, ms = 8000) {
  if (flashTimer) clearInterval(flashTimer);
  const original = document.title;
  let on = false;
  flashTimer = setInterval(() => {
    on = !on;
    document.title = on ? `🔔 ${message}` : original;
  }, 800);
  setTimeout(() => {
    if (flashTimer) clearInterval(flashTimer);
    flashTimer = null;
    document.title = original;
  }, ms);
}

export async function ensureNotificationPermission() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

export async function systemNotify(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
      body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', vibrate: [300, 120, 300], renotify: true,
    };
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    /* ignore */
  }
}

/** Everything at once, for "new ride request!". */
export function alertNewRequest(title: string, body: string, tag: string) {
  beep();
  vibrate();
  flashTitle(title);
  void systemNotify(title, body, tag);
}
