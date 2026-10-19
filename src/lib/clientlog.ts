/**
 * Explicit error trail for flows that run through fragile moments (camera, upload).
 * Always logs to the console (visible in chrome://inspect) and ALSO reports to the server
 * with sendBeacon, which survives a page that is being killed. Never pass personal data
 * (no name, phone, PIN): only codes, sizes and timings.
 */
type Level = 'info' | 'warn' | 'error';

export function logClient(event: string, detail: Record<string, unknown> = {}, level: Level = 'error'): void {
  const payload = { event, level, detail: { ...detail, ...environment() }, at: new Date().toISOString() };
  try {
    console[level === 'info' ? 'log' : level](`[boda] ${event}`, payload.detail);
  } catch {
    /* console unavailable: ignore */
  }
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' }))) return;
    }
    void fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    /* logging must never break the app */
  }
}

/** Device facts that matter for "the page got killed" reports. */
function environment(): Record<string, unknown> {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; saveData?: boolean } };
  return {
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    net: nav.connection?.effectiveType,
    saveData: nav.connection?.saveData,
    online: nav.onLine,
    visible: document.visibilityState,
    path: location.pathname,
  };
}

/** Message of anything thrown, without leaking objects into the log. */
export function errMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
