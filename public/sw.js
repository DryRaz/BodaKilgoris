/* Boda Kilgoris service worker
 * - makes the app installable and gives an offline fallback page
 * - caches the hashed build assets (cache-first) and map tiles you already viewed
 * - NEVER caches API calls, Supabase traffic or HTML pages (always fresh, auth-safe)
 */
/* No skipWaiting() / clients.claim() on purpose: a new worker used to take over open pages in the middle
 * of a session (and could drop the caches a running page still needs). It now waits until the app is
 * closed, so an update can never disturb a Boda who is, for instance, taking a photo. */
const VERSION = 'v1';
const STATIC_CACHE = `boda-static-${VERSION}`;
const TILE_CACHE = `boda-tiles-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const MAX_TILES = 300;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, '/icons/icon-192.png'])),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, TILE_CACHE].includes(k)).map((k) => caches.delete(k)))),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // OpenStreetMap tiles: cache-first (saves data on repeat visits)
  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) {
            cache.put(req, res.clone());
            trimCache(TILE_CACHE, MAX_TILES);
          }
          return res;
        } catch {
          return hit || Response.error();
        }
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // immutable, content-hashed Next.js assets
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // page navigations: network only, offline page as fallback
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('/');
    }),
  );
});
