'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { DEFAULT_ZOOM, KILGORIS_CENTER } from '@/lib/constants';
import type { LatLng } from '@/lib/geo';

export type MarkerKind = 'boda' | 'bodaSelected' | 'pickup' | 'me';
export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: MarkerKind;
  /** Shown under the pin (e.g. the Boda's name). Set with textContent: user text is never parsed as HTML. */
  label?: string;
}

export interface LeafletMapProps {
  markers: MapMarker[];
  /** Move/zoom the map whenever `key` changes. */
  view?: { center: LatLng; zoom?: number; key: string };
  /** Fit all markers in view whenever this string changes. */
  fitKey?: string;
  onTap?: (point: LatLng) => void;
  onMarkerClick?: (id: string) => void;
  /** false = a still picture (mini-map in a request card). */
  interactive?: boolean;
  className?: string;
}

const GLYPH: Record<MarkerKind, string> = { boda: '🏍️', bodaSelected: '🏍️', pickup: '📍', me: '' };

function buildIcon(m: MapMarker): L.DivIcon {
  const root = document.createElement('div');
  root.className = `bm bm-${m.kind}`;
  const pin = document.createElement('div');
  pin.className = 'bm-pin';
  pin.textContent = GLYPH[m.kind];
  root.append(pin);
  if (m.label) {
    const label = document.createElement('div');
    label.className = 'bm-label';
    label.textContent = m.label;
    root.append(label);
  }
  return L.divIcon({ html: root, className: 'bm-wrap', iconSize: [0, 0], iconAnchor: [0, 0] });
}

export default function LeafletMap({
  markers, view, fitKey, onTap, onMarkerClick, interactive = true, className = 'h-72 w-full',
}: LeafletMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const live = useRef(new Map<string, { marker: L.Marker; sig: string }>());
  const handlers = useRef({ onTap, onMarkerClick });
  const markersRef = useRef(markers);
  // keep the latest props reachable from Leaflet's event callbacks (declared first: effects run in order)
  useEffect(() => {
    handlers.current = { onTap, onMarkerClick };
    markersRef.current = markers;
  });

  // create the map once
  useEffect(() => {
    if (!container.current) return;
    const start = view?.center ?? KILGORIS_CENTER;
    const map = L.map(container.current, {
      center: [start.lat, start.lng],
      zoom: view?.zoom ?? DEFAULT_ZOOM,
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: false,
      keyboard: false,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    layer.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => handlers.current.onTap?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container.current);
    const liveMarkers = live.current;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layer.current = null;
      liveMarkers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // diff markers in place (no flicker while Bodas move)
  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const sig = `${m.kind}|${m.label ?? ''}`;
      const existing = live.current.get(m.id);
      if (existing) {
        existing.marker.setLatLng([m.lat, m.lng]);
        if (existing.sig !== sig) {
          existing.marker.setIcon(buildIcon(m));
          existing.sig = sig;
        }
      } else {
        const marker = L.marker([m.lat, m.lng], { icon: buildIcon(m), keyboard: false, riseOnHover: true });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          handlers.current.onMarkerClick?.(m.id);
        });
        marker.addTo(group);
        live.current.set(m.id, { marker, sig });
      }
    }
    for (const [id, entry] of live.current) {
      if (!seen.has(id)) {
        entry.marker.remove();
        live.current.delete(id);
      }
    }
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && view) map.setView([view.center.lat, view.center.lng], view.zoom ?? map.getZoom(), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.key]);

  useEffect(() => {
    const map = mapRef.current;
    const list = markersRef.current;
    if (!map || fitKey === undefined || list.length === 0) return;
    if (list.length === 1) {
      map.setView([list[0].lat, list[0].lng], Math.max(map.getZoom(), 16));
      return;
    }
    map.fitBounds(L.latLngBounds(list.map((m) => [m.lat, m.lng] as [number, number])), { padding: [48, 48], maxZoom: 17 });
  }, [fitKey]);

  return <div ref={container} className={`relative z-0 overflow-hidden rounded-2xl ${className}`} />;
}
