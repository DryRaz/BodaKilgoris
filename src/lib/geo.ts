import { BODA_SPEED_KMH } from './constants';

export type LatLng = { lat: number; lng: number };

/** Straight-line distance in metres (haversine). Good enough to rank Bodas in a small town. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function etaMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / ((BODA_SPEED_KMH * 1000) / 60)));
}

/** Splits a distance into the unit/value pair the translations expect. */
export function distanceParts(meters: number): { unit: 'meters' | 'km'; value: string } {
  if (meters < 1000) return { unit: 'meters', value: String(Math.max(10, Math.round(meters / 10) * 10)) };
  return { unit: 'km', value: (meters / 1000).toFixed(meters < 10_000 ? 1 : 0) };
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
