// LumiNote service worker: app-shell caching for instant loads and
// offline resilience. Hard rules, chosen so the stale-cache class of bugs
// can never come back:
// - GET, same-origin only; /api/* and every cross-origin request is passed
//   straight through untouched (STT sockets and tokens are never cached).
// - HTML/CSS/JS/JSON: network-first with cache fallback — freshness first,
//   the cache only answers when the network fails.
// - Fonts, vendored libraries, icons: cache-first (content is pinned or
//   changes only with a deploy that bumps CACHE_VERSION).
// - Old caches are deleted on activate, so shipping a release retires the
//   previous shell in one reload.
const CACHE_VERSION = 'luminote-shell-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/reset.css',
  '/fonts.css',
  '/index.js',
  '/viz.js',
  '/link-protocol.js',
  '/audio-processor.js',
  '/vendor/anime.min.js',
  '/vendor/qrcode.js',
  '/logo.svg',
  '/manifest.webmanifest',
  '/changelog.html',
  '/changelog.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never intercept non-GET, cross-origin, or API traffic.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Immutable-ish assets: cache-first, refresh the stored copy in the
  // background so the next load is current.
  if (/\.(woff2|png|svg)$/.test(url.pathname) || url.pathname.startsWith('/vendor/')) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const fetchAndStore = fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        });
        return hit || fetchAndStore;
      })
    );
    return;
  }

  // Everything else (HTML/CSS/JS/JSON): network-first, cache fallback.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? caches.match('/') : undefined)))
  );
});
