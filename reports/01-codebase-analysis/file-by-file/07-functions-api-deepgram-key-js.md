# FILE ANALYSIS — `functions/api/deepgram-key.js` (23 lines)

- **Role:** Pages Function at `/api/deepgram-key` — returns the Deepgram API key to the browser.
- **Verdict in one line:** This endpoint should not exist in its current form; it is the vending machine for the app's most serious security problem (C-01/C-02/S-02).

---

## FULL LISTING (annotated)

```js
// Cloudflare Pages Function to provide Deepgram API key securely     // L1: comment claims "securely" — it is not
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {                          // L3: CORS preflight (unnecessary, S-03)
    return new Response(null, { headers: { ...ACAO: '*'... } });
  }

  const DEEPGRAM_API_KEY = context.env.DEEPGRAM_API_KEY || "2b2fe3bc8ae482b82b218201b9c15c40a9fcba4e";
                                                                       // L13: hardcoded fallback = C-01

  return new Response(JSON.stringify({ key: DEEPGRAM_API_KEY }), {     // L15: master key to anyone
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',                              // L19: any origin
      'Cache-Control': 'no-cache, no-store, must-revalidate',          // L20: correct for secrets — the only ✅
    }
  });
}
```

---

## FINDINGS (all cross-referenced to primary analyses)

| Line | Issue | ID | Severity |
|---|---|---|---|
| 13 | `\|\|` fallback literal — live-format key committed to repo/bundle/history | C-01, S-01 | **CRITICAL** |
| 13-15 | Returns the **master** key (whatever its source) to any requester | C-02, S-02 | **CRITICAL** |
| 19 | Wildcard CORS — foreign sites can fetch it from visitors' browsers | S-03 | High |
| 6-12 | OPTIONS preflight support widens the same | S-03 | High |
| — | No method restriction (POST/HEAD also served) | minor S-02 | Low |
| — | No error path for missing env var *without* the fallback (the fallback masks misconfiguration) | S-01 §4 | Critical-adjacent |
| — | No timeout/n-a (no upstream call — the whole endpoint is a constant read) | — | n/a |
| — | Header comment asserts "securely" | docs | — |

**What it gets right:** correct function-routing file placement; JSON envelope; `no-store` (irrelevant given the payload, but present); symmetric structure with the other functions.

---

## WHY IT EXISTS (design archaeology)

The client needs *something* Deepgram-shaped to open `wss://api.deepgram.com/v1/listen` with the `['token', …]` subprotocol. Deepgram's official browser samples put the raw key there. Lacking a browser-legal way to send an `Authorization` header over WebSocket, the author shipped the key itself through the only channel available — an authenticated-by-nothing HTTPS GET. The correct mechanism Deepgram provides for exactly this case — short-lived grant tokens minted server-side via `POST /v1/auth/token` (30s TTL, `usage::write` scope; verified in [Deepgram's token-based auth guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) and [grant-token reference](https://developers.deepgram.com/reference/auth/tokens/grant)) — was not used, even though the AssemblyAI function in the same folder implements the analogous pattern correctly.

---

## PROPOSED REPLACEMENT (NOT APPLIED — mirrored from C-02/hardening plan §3)

```js
// functions/api/deepgram-key.js — mint ephemeral grant tokens; never ship the master key
export async function onRequest(context) {
  const key = context.env.DEEPGRAM_API_KEY;
  if (!key) {
    console.error('DEEPGRAM_API_KEY not configured');
    return json({ error: 'Deepgram not configured' }, 500);   // no silent fallback — ever
  }
  try {
    const res = await fetch('https://api.deepgram.com/v1/auth/token', {
      method: 'POST',
      headers: { Authorization: `Token ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return json({ error: 'token mint failed' }, 502);
    const { token } = await res.json();
    return json({ token });                                     // ~30s TTL JWT
  } catch (err) {
    console.error('Deepgram grant error', err.message);
    return json({ error: 'token mint error' }, 500);
  }
}
```

Client-side pairing: fetch on demand at Deepgram session start; `new WebSocket(dgUrl, ['token', tempJwt])`; no client caching (30s TTL); delete the hardcoded fallback in `public/index.js:136` in the same commit. Rename the endpoint to `/api/deepgram-token` to break any stale consumers deliberately.

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
