'use client';

import dynamic from 'next/dynamic';
import type { LeafletMapProps } from './LeafletMap';

export type { MapMarker } from './LeafletMap';

/** Leaflet touches `window`, so it is only ever loaded in the browser. */
export const Map = dynamic<LeafletMapProps>(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-2xl bg-line" />,
});
