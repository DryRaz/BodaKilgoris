export type Role = 'boda' | 'client' | 'admin';
export type BodaStatus = 'pending' | 'approved' | 'suspended';
export type RideStatus =
  | 'requested' | 'accepted' | 'arrived' | 'completed' | 'declined' | 'expired' | 'cancelled';

export interface Profile {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  language: string;
  geo_consent_at: string | null;
  created_at: string;
}

export interface BodaProfile {
  user_id: string;
  plate: string;
  photo_url: string | null;
  status: BodaStatus;
  is_available: boolean;
  available_since: string | null;
  rating_avg: number;
  rating_count: number;
  approved_at: string | null;
}

export interface Ride {
  id: string;
  client_id: string;
  boda_id: string;
  status: RideStatus;
  pickup_lat: number;
  pickup_lng: number;
  /** Optional pick-up landmark typed by the client ("in front of the blue shop"). */
  pickup_note: string | null;
  /** All three destination fields are optional: Kilgoris clients describe places, they rarely drop pins. */
  destination_text: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  requested_at: string;
  expires_at: string;
  accepted_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  cancelled_at: string | null;
  cancelled_by: 'client' | 'boda' | 'system' | null;
  boda_confirmed: boolean;
  client_confirmed: boolean;
  auto_confirmed: boolean;
  counted: boolean;
  counted_at: string | null;
  suspect: boolean;
  suspect_reason: string[];
  rating: number | null;
  agreed_price_kes: number | null;
  client_name: string;
  boda_name: string;
  boda_plate: string;
  boda_photo_url: string | null;
  client_phone: string | null;
  boda_phone: string | null;
  created_at: string;
}

/** A frequent destination the admin maintains (public.places). */
export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  active: boolean;
}

/** Row of the available_bodas() RPC. */
export interface AvailableBoda {
  id: string;
  name: string;
  plate: string;
  photo_url: string | null;
  rating_avg: number;
  rating_count: number;
  lat: number;
  lng: number;
  updated_at: string;
}

export interface BodaLocation {
  boda_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}

/** A ride that still needs the user's attention on screen. */
export const ACTIVE_RIDE_STATUSES: RideStatus[] = ['requested', 'accepted', 'arrived'];
