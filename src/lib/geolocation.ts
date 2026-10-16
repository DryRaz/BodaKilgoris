import type { LatLng } from './geo';

export type GeoErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported';
export class GeoError extends Error {
  constructor(public code: GeoErrorCode) {
    super(code);
  }
}
export interface Fix extends LatLng { accuracy: number }

export const geoSupported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

export function toGeoError(e: GeolocationPositionError): GeoError {
  return new GeoError(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable');
}

const toFix = (p: GeolocationPosition): Fix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
});
export { toFix };

/** One-shot position. Rejects with GeoError. */
export function getPosition(opts: PositionOptions = {}): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!geoSupported()) return reject(new GeoError('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toFix(p)),
      (e) => reject(toGeoError(e)),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 15_000, ...opts },
    );
  });
}
