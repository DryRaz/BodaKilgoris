// Phones often have a wrong clock. Countdowns use the server's `expires_at`, so we measure
// the offset between server time and the device clock (sweep_rides() returns now()).
let offsetMs = 0;

export const serverNow = () => Date.now() + offsetMs;

export function syncServerTime(serverIso: string, requestStartedAt: number, responseAt: number) {
  const t = Date.parse(serverIso);
  if (Number.isFinite(t)) offsetMs = t - (requestStartedAt + responseAt) / 2;
}

/** Nairobi calendar day (YYYY-MM-DD) of a timestamp, for "today" counters. */
export function nairobiDay(ts: string | number | Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Nairobi' }).format(new Date(ts));
}
