# SECURITY HARDENING PLAN — LumiNote v02

- **Audit date:** 2026-08-16
- **Purpose:** Concrete, copy-ready artifacts for the fixes identified in `vulnerability-audit.md` and `secrets-exposure-analysis.md`. Nothing here has been applied to the working tree — these are proposals for the maintainer to review, adapt, and merge.

---

## 1. `public/_headers` (new file — proposed contents)

Cloudflare Pages reads this from the build output directory (`public/`). Per [Cloudflare's docs](https://developers.cloudflare.com/pages/configuration/headers/), these apply to static assets; **function responses must set their own headers** (section 2). Proposed CSP assumes anime.js stays on cdnjs and Google Fonts stay external; tighten further after self-hosting (section 6).

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: microphone=(self), camera=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' wss://api.deepgram.com wss://streaming.assemblyai.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'

/api/*
  X-Content-Type-Options: nosniff
  Cache-Control: no-store
```

Notes on the CSP:
- `'unsafe-inline'` in `style-src` is currently required because `styles.css` inline-SVGs/`<style>`-less app actually does not use inline styles — re-verify before shipping; if truly none, drop `'unsafe-inline'`. (The only inline style attribute in the tree is `style="display: none;"` on the tick icon — `index.html:103` — which is an attribute, not a stylesheet, and is allowed only with `style-src-attr`; safest first iteration: keep `'unsafe-inline'`, then remove after converting that one attribute to a class.)
- `connect-src` must list both WSS providers or recording breaks; keep the list minimal.
- No `upgrade-insecure-requests` needed (pages.dev is HTTPS-only already).

---

## 2. Function-level headers (drop-in helper — proposed)

`_headers` does not cover function responses. Proposed shared helper for all three functions:

```js
// functions/_utils/security.js (proposed)
const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: BASE_HEADERS });
}
```

Every endpoint then returns `json({...})` — which also removes the wildcard CORS headers wholesale (S-03): the frontend is same-origin and needs none. The `OPTIONS` preflight blocks in all three functions can be deleted.

---

## 3. Deepgram grant-token endpoint (replacement design — proposed)

Full rationale in C-02/S-02. Reference implementation for review:

```js
// functions/api/deepgram-key.js (proposed rewrite)
export async function onRequest(context) {
  const KEY = context.env.DEEPGRAM_API_KEY;
  if (!KEY) {
    console.error('DEEPGRAM_API_KEY not configured');
    return json({ error: 'Deepgram not configured' }, 500);
  }

  try {
    const res = await fetch('https://api.deepgram.com/v1/auth/token', {
      method: 'POST',
      headers: { Authorization: `Token ${KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error('Deepgram grant failed', res.status);
      return json({ error: 'token mint failed' }, 502);
    }
    const data = await res.json();
    return json({ token: data.token });          // ~30s TTL, usage::write scope
  } catch (err) {
    console.error('Deepgram grant error', err.message);
    return json({ error: 'token mint error' }, 500);
  }
}
```

Client changes (proposed, `public/index.js`):
- `getDeepgramKey()` → `getDeepgramToken()`: no caching beyond the session start (30s TTL), fetched immediately before `new WebSocket(...)`.
- Connect with `['token', tempToken]` subprotocol exactly as today — only the credential's provenance changes.
- Delete the hardcoded fallback literal (S-01 step 2).

Edge behavior documented by Deepgram: the token is checked at connection time; an open stream survives token expiry — so mint-per-session is sufficient and no refresh loop is needed.

---

## 4. `/api/grammar` guardrails (proposed patch shape)

```js
// proposed additions inside functions/api/grammar.js onRequest
const MAX_TEXT = 20000;                    // mirrors LanguageTool's per-request cap

if (typeof body.text !== 'string') return json({ error: 'text must be a string' }, 400);
if (body.text.length > MAX_TEXT) return json({ error: `text exceeds ${MAX_TEXT} chars` }, 413);

// upstream call with timeout:
const res = await fetch('https://api.languagetool.org/v2/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: params.toString(),
  signal: AbortSignal.timeout(8000),
});
```

Plus: same-origin only (no CORS headers), and a WAF rate rule on `/api/grammar` (Cloudflare dashboard → Security → WAF → Rate limiting: e.g., 20 requests / 1 minute / per IP). Distinguish degraded outcomes for the client: `{ correctedText, degraded: true }` when the upstream fails, so the UI can say "grammar service unavailable — text unchanged" instead of faking success (H-09).

---

## 5. `/api/token` hygiene (proposed)

- Remove `details: errorText` / `message: error.message` from client-visible error bodies (S-11); keep them in `console.error` for Pages Function logs.
- Add per-IP rate limiting via WAF (S-10): suggest 30 req/min/IP — comfortably above legitimate use (which after C-07's fix is ~1 mint per session start).
- Keep `expires_in_seconds` at 600 only if the client keeps pre-fetching; if minting moves to session start (recommended), a shorter lifetime (60-120s) shrinks the stolen-token window.

---

## 6. Supply-chain hardening (proposed)

| Item | Action | Why |
|---|---|---|
| anime.js | Self-host `anime.min.js@3.2.1` at `public/vendor/anime.min.js` (17 KB) **or** pin with SRI: `integrity="sha512-..." crossorigin="anonymous"` | Removes third-party script trust (S-08); enables tightening `script-src` to `'self'` |
| Google Fonts | Self-host via `@fontsource/inter` + `@fontsource/outfit` (or font subsets), `font-display: swap` | Removes two third-party origins from CSP; faster first paint (P-12) |
| Secret scanning | `.pre-commit-config.yaml` with gitleaks; enable GitHub push protection | Prevents recurrence of S-01 |
| Dependency hygiene | Resolve dual lockfiles (L-09); move eslint/prettier to devDeps (L-08); add `npm audit`/`yarn npm audit` to CI | Reduces attack surface & drift |

---

## 7. Defense-in-depth for the planned relay feature

`future_enhancement.txt` proposes cross-device pairing (PIN + QR, WebSocket relay via Durable Objects). Security requirements to bake in **from the first prototype**, so they are not retrofits:

1. **Pairing codes**: 6-digit PINs must be single-use, expire ≤ 60s, rate-limit join attempts per room (≥5 wrong PINs → room lockout), and transport over authenticated WSS only.
2. **Durable Object auth**: room ID must be an unguessable 128-bit value; PIN is a second factor, not the identifier.
3. **Payload validation**: relay must forward only typed frames (audio chunks / text deltas) with size caps — never arbitrary JSON pass-through.
4. **Clipboard sync** (bi-directional text) is sensitive data in transit: log nothing, cap message size, and document retention (zero persistence by default).
5. Revisit CSP `connect-src` when the relay origin exists; add it explicitly rather than loosening to `wss:`.

---

## 8. HARDENING CHECKLIST (printable)

- [ ] Deepgram key rotated (old key dead)
- [ ] Hardcoded literals removed (server + client) — `git grep 2b2fe3bc` empty
- [ ] `/api/deepgram-key` returns 30s grant token, never the master key
- [ ] Wildcard CORS removed from all functions; OPTIONS blocks deleted
- [ ] `public/_headers` deployed with CSP + HSTS + Permissions-Policy
- [ ] Function responses carry security headers (shared `json()` helper)
- [ ] anime.js SRI'd or self-hosted; CSP `script-src` tightened accordingly
- [ ] `/api/grammar`: same-origin, 20 KB cap, 8s timeout, degraded-response contract
- [ ] `/api/token`: WAF rate rule, error bodies scrubbed
- [ ] gitleaks pre-commit + GitHub secret scanning enabled
- [ ] Lockfile strategy decided (single package manager)
- [ ] Privacy notice for LanguageTool on the Fix-Grammar affordance
- [ ] Cloudflare Account ID scrubbed from docs
- [ ] (When relay feature starts) pairing auth requirements above included in the design doc

---

*Analysis only — no source files, headers, or settings were modified. Master index: `reports/README.md`.*
