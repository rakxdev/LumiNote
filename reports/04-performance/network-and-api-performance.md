# NETWORK & API PERFORMANCE — LumiNote v02

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Scope:** Everything that crosses the network: token/key fetches, WebSocket lifecycle, font/CDN asset loading, the grammar round-trip, and DNS/TLS setup costs. Severity here is ranked by user-perceived latency and wasted quota.

---

## INDEX

| ID | Finding | Severity | Location |
|---|---|---|---|
| N-01 | 50-second background token refresh: ~72 unnecessary token mints + function invocations per open tab per hour (tokens are one-time-use) | **High** (cost/reliability) | `public/index.js:139-143` |
| N-02 | Deepgram key fetched at page load for every visitor (wasted invocation + exposure window) | Medium | `public/index.js:681-684` |
| N-03 | Render-blocking Google Fonts stylesheet; 11 font weights requested; two font families | Medium | `public/index.html:9-11` |
| N-04 | anime.js from cdnjs: extra DNS+TLS+RTT chain before interactive; single point of failure (M-03) | Medium | `public/index.html:130` |
| N-05 | No preconnect to WSS origins (`api.deepgram.com`, `streaming.assemblyai.com`) — WS connect eats 2-3 extra RTTs at session start | Medium (latency) | missing from `public/index.html` |
| N-06 | Grammar endpoint round-trips the whole transcript with no compression hints, no chunking (breaks >20 KB upstream), no timeout | Medium | `functions/api/grammar.js` |
| N-07 | Token fetched *before* mic permission is even requested — serializes user-interaction + network waits on the record path | Low-Med | `public/index.js:455-543` ordering |
| N-08 | 300 ms fixed model-switch delay is a timeout, not an event — adds constant latency to every live switch | Low | `public/index.js:80-83` |
| N-09 | No `bufferedAmount` awareness on sends (see M-05) — network degradation compounds latency silently | Medium | `public/index.js:495-499` |
| N-10 | Positive: `preconnect` for fonts present; assets served with far-future-ish Pages caching; total static payload small | Info | `public/index.html:9-10` |

---

# N-01 — Token churn (network view of C-07)

Quantified waste per open tab, at the documented 50 s interval:

- **Pages Function invocations:** 72/hour, 1,728/day — each counts against the Pages Functions daily allowance (free tier: 100k/day, so 1% per idle tab — trivial alone, real at scale).
- **AssemblyAI token API calls:** same count; each is a signed upstream request from Cloudflare's egress. Under provider rate policies this is noise today but a self-inflicted ceiling under growth.
- **User-visible benefit of the background refresh: zero.** Tokens are one-time-use (verified against [AssemblyAI's temporary-token docs](https://www.assemblyai.com/docs/streaming/authenticate-with-a-temporary-token)) — a refreshed token cannot serve a future session any better than one minted at click time. The only legitimate optimization (first-click latency) needs at most one warm token fetched at page load with a 9-minute refresh, and only if first-click latency actually matters (the mic-permission prompt already dominates it).

**Fix:** mint at `startRecording()` (with the WS URL construction), stop the interval entirely; delete `startBackgroundRefresh`/`stopBackgroundRefresh` (~20 lines).

---

# N-02 — Eager Deepgram key fetch

`Promise.all([fetchToken(), getDeepgramKey()])` on DOMContentLoaded fires `/api/deepgram-key` for every visitor. Cost: one function invocation + one full provider key delivered to a browser that may never use Deepgram. Fix is M-06's on-demand fetch (or C-02's mint-per-session token). Network win: one fewer blocking call in the load path; security win: key/token only exists client-side when actually recording Deepgram.

---

# N-03 — Font loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- The stylesheet is **render-blocking** (plain `rel="stylesheet"` in head): first paint waits for fonts.googleapis.com CSS (DNS + TLS + RTT + CSS parse) — typically 100-400 ms on a cold cache, worse on high-RTT mobile.
- The CSS advertises 11 font files; the app uses Inter 400/500/600 + Outfit 700 (see L-18). Unused: Inter 300/700, Outfit 400/500/600 — browsers lazily fetch per-used-weight so unused weights usually aren't downloaded, but the CSS payload and the design's declared surface stay bloated, and any future use of a stray weight silently adds a file.
- `display=swap` — present ✅ (text renders in fallback immediately, fonts swap in).

**Fix options (NOT APPLIED), in increasing ambition:**
1. Non-blocking pattern: `<link rel="preload" as="style" onload="this.rel='stylesheet'" href="…">` + `<noscript><link rel="stylesheet" …></noscript>`.
2. Trim families/weights to what's used.
3. Self-host (`@fontsource/inter@400;500;600` + `outfit@700`, woff2, same-origin): removes two third-party origins from the critical path **and** from the future CSP (S-05/S-08) — one change serving performance and security.

---

# N-04 — CDN dependency for a 17 KB library

`anime.min.js` (3.2.1) loads synchronously before `index.js` at end of body. Cost breakdown on cold load: cdnjs DNS (~20-50 ms) + TLS (~1 RTT) + fetch (~1 RTT). Because both scripts sit at body end, HTML parsing isn't blocked — but `index.js`'s execution waits for the CDN round-trips (script order), delaying `DOMContentLoaded` listeners (token prefetch, audio warm-up) by the full CDN chain. Self-hosting collapses this to a same-origin fetch from the already-hot connection and removes the M-03 failure mode. If kept on CDN: add `defer` to both scripts (order preserved, parsing unblocked) + SRI.

---

# N-05 — Missing preconnects for the streaming origins

The very first user click triggers, in sequence: mic permission → token fetch → **`new WebSocket('wss://api.deepgram.com…')` or `wss://streaming.assemblyai.com…`** — each WSS connect pays fresh DNS + TCP + TLS (2-3+ RTT) because nothing warmed those origins. Two `<link rel="preconnect">` lines shave 100-300 ms off session start on mobile:

```html
<link rel="preconnect" href="https://api.deepgram.com">
<link rel="preconnect" href="https://streaming.assemblyai.com">
```

(Optionally make it dynamic — preconnect the *selected* model's origin when the user changes the dropdown — zero waste, still timely.) Given the product's core promise is sub-second latency, this is the cheapest real win in the whole report.

---

# N-06 — Grammar round-trip

Current shape: client POSTs full transcript JSON → function POSTs urlencoded text to `api.languagetool.org` → response. Issues:

1. **No timeout** — a slow LanguageTool response holds the function and the client's spinner (H-10-related; `AbortSignal.timeout(8000)` fixes).
2. **No length cap client or server side** — transcripts >20 KB fail upstream anyway (H-09); client should chunk or warn ("grammar check supports ~20k characters — exporting instead?").
3. **No caching** — re-running grammar on identical text re-pays the full round trip; a content-hash KV cache (TTL 1h) would absorb repeat clicks and accidental double-clicks for free.
4. **Sequencing** — grammar runs over text that includes the live interim span when clicked mid-recording (M-07) — network waste on top of the correctness bug (the corrected result is immediately invalidated by the ongoing turn).

---

# N-07 — Record-path serialization

`startRecording()` awaits, in order: (1) `getUserMedia` permission → (2) token fetch (AssemblyAI branch) → (3) WS connect. The token fetch does not depend on mic permission; kick it off in parallel with the permission prompt to cut the click→connected path by the token RTT (~100-300 ms):

```js
const tokenPromise = TokenManager.getToken();          // fire immediately on click
const permissionResult = await microphone.requestPermission();
const token = await tokenPromise;                     // likely already resolved
```

---

# N-08 — Fixed 300 ms switch delay

```js
setTimeout(async () => { await startRecording(); }, 300);
```

The delay presumably covers the old WS's `close()` handshake. As a timeout it both overshoots (close events usually arrive faster) and undershoots (slow networks still race — H-01). Event-driven alternative: trigger restart from the old socket's `onclose` (with a 500 ms safety timeout fallback). Saves ~200 ms median on every live switch and removes the race class entirely.

---

# N-09 — Backpressure blindness (cross-ref M-05)

No `bufferedAmount` monitoring means the app cannot distinguish "provider slow" from "network degraded" and cannot adapt (skip batching up to 250 ms, notify the user). On metered mobile uplinks this is the difference between a transcript that lags 2 s and one that lags 20 s before the tab dies. Details and code in M-05.

---

# N-10 — Positive network observations

- Static asset footprint is small: one HTML (6.6 KB), one CSS (2.3 KB gz est.), one JS (716 lines, ~11 KB gz est.), one SVG — Pages' edge caching handles these well; no bundler tax.
- `preconnect` for Google Fonts is correctly set including the `crossorigin` variant for `fonts.gstatic.com` (commonly forgotten — done right here ✅).
- WebSocket subprotocol auth for Deepgram avoids an extra REST round trip versus header-token schemes — though this is inseparable from the S-02 design problem it enables.
- `display=swap` on fonts avoids FOIT.
- Grammar/token endpoints set `no-store` — correct for credential/token responses (though over-broad on grammar, which could cache).

---

## LATENCY BUDGET (analysis-derived, cold cache, ~100 ms RTT)

| Phase | Current | With N-01/03/04/05/07 fixes |
|---|---|---|
| First paint | fonts CSS chain +100-400 ms | same-origin fonts, ~0 extra |
| Click → mic permission shown | immediate | immediate |
| Permission granted → WS connecting | + token RTT (~200 ms, serialized) | token already in flight; WS preconnect saves 1-2 RTT (~150-250 ms) |
| WS connect → first interim | provider-bound (150-450 ms per model) | unchanged (floor set by provider) |
| Model switch (live) | 300 ms fixed + full reconnect | event-driven close (~50-150 ms) + reconnect |

---

*Analysis only — no source files were modified. Related: `serverless-performance.md` for the function side of N-01/N-06. Master index: `reports/README.md`.*
