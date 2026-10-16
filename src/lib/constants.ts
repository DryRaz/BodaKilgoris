// Kilgoris town centre (OpenStreetMap)
export const KILGORIS_CENTER = { lat: -1.0035, lng: 34.8767 };
export const DEFAULT_ZOOM = 15;

/** Boda position is pushed to the server at most this often while available. */
export const TRACK_INTERVAL_MS = 12_000;
/** Safety net next to realtime: refetch lists at this interval (slow / flaky networks). */
export const POLL_MS = 10_000;
export const SWEEP_MS = 30_000;
/** Used for the ETA estimate only (town speed of a motorbike, km/h). */
export const BODA_SPEED_KMH = 20;
/** Display only; the real value lives in app_settings.auto_confirm_minutes. */
export const AUTO_CONFIRM_MINUTES = 30;

export const APP_VERSION = '0.1.0';
