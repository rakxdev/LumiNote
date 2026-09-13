# ADR-006: Installable App Shell with a Freshness-First Service Worker

## Status
Accepted

## Date
2026-09-13

## Context
LumiNote runs entirely in the browser tab, and its mobile usage model
(phone-as-microphone for a desktop) made an installable app the natural
next step: a home-screen icon, a standalone window without browser chrome,
and instant loads. But the project carries scar tissue: the entire 4.2
cache work exists because users were burned by stale files (a blank QR,
phantom line-number errors from an old cached `index.js`). A naive
service worker is a *stale-file machine* — the exact bug class that was
eliminated.

Constraints:
- `/api/*` responses (STT tokens, grammar, notes) and the WebSocket links
  must never be cached, intercepted, or served from a cache.
- Cross-origin traffic (STT endpoints) must pass through untouched.
- Freshness outranks speed: a user must never see yesterday's app.
- Zero build tooling — the worker is a hand-written vanilla file.

## Decision
1. **Web app manifest** (`public/manifest.webmanifest`) with `display:
   standalone`, dark theme colors, and PNG icons (180/192/512, any +
   maskable) rasterized from the Acoustic Yantra logo on the chassis
   background. iOS gets `apple-touch-icon` plus the
   `apple-mobile-web-app-*` meta set (an SVG icon is not enough there).
2. **Service worker with hard exclusions first**: the fetch handler returns
   early for anything that is not GET, not same-origin, or under `/api/`.
   Those requests are never observable by the cache layer.
3. **Network-first with cache fallback** for HTML/CSS/JS/JSON: the network
   answer always wins; the cache only speaks when the network fails
   (offline or captive portal). This keeps the no-stale guarantee while
   making the app usable without connectivity.
4. **Cache-first only for pinned assets**: fonts (`.woff2`), vendored
   libraries (`/vendor/`), and icons (`.png`/`.svg`) — content that changes
   only with a deploy. A background refresh updates the stored copy so the
   *next* load is current even for these.
5. **Versioned cache retirement**: `CACHE_VERSION` in `sw.js` is bumped
   with each release; `activate` deletes every other cache, and
   `skipWaiting` + `clients.claim()` put the new worker in charge
   immediately. Registration happens after the window `load` event so the
   worker never competes with first paint.
6. **Contract-tested safety**: `tests/features.test.js` asserts the three
   guards (GET, same-origin, `/api/`) exist in the worker source, that no
   `/api/` path appears in the precache list, and that the manifest stays
   installable (standalone, themed, maskable icon).

## Alternatives Considered

### Cache-first app shell (Workbox-style "precache everything")
- Pros: fastest repeat loads, true offline-first.
- Cons: serves yesterday's HTML/JS unless the SW updates perfectly — the
  exact failure mode this project paid to remove. Rejected as the default;
  fonts/vendor keep a scoped version of it.

### No service worker (manifest-only install)
- Pros: zero staleness risk.
- Cons: no offline shell, no instant loads; install still works but the
  experience is a bookmark. Rejected — the exclusions make the full
  worker safe.

### Workbox / build tooling
- Pros: battle-tested strategies, precache manifests.
- Cons: a build step and dependency for a ~90-line vanilla worker; the
  project has zero build tooling by design. Rejected; revisit only if the
  shell grows complex routing.

## Consequences
- **Positive:** installable on iOS and Android/desktop; loads are instant
  on repeat visits and the shell works offline; the no-stale guarantee
  survives because freshness-first is structural, not a cache header.
- **Positive:** the safety rules are enforced by contract tests, not
  conventions — a future edit that caches `/api` fails CI.
- **Negative:** a bad deploy is one reload away for users (network-first),
  and the service worker adds a mental step to debugging (bypass with
  DevTools' "Bypass for network" or an unregister when investigating).
- **Neutral:** the static-asset `Cache-Control: no-cache` headers from
  4.2 stay — the service worker layers on top of them rather than
  replacing them.
