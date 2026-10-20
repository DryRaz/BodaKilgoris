import type { LatLng } from './geo';
import type { Ride } from './types';

/**
 * The destination as a map point, or null. Rides made before destinations had coordinates, and every
 * request where the client only typed a landmark (or nothing), have NULL here: callers must cope.
 */
export function destinationPoint(ride: Pick<Ride, 'destination_lat' | 'destination_lng'>): LatLng | null {
  const { destination_lat: lat, destination_lng: lng } = ride;
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
