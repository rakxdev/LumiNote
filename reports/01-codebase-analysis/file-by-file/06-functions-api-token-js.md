# FILE ANALYSIS — `functions/api/token.js` (89 lines)

- **Role:** Cloudflare Pages Function at `GET/POST /api/token` — mints AssemblyAI streaming temporary tokens server-side using the `ASSEMBLYAI_API_KEY` environment secret.
- **Pattern:** `export async function onRequest(context)` — the Pages Functions file-convention routing (`functions/api/token.js` → `/api/token`) ✅ idiomatic.

---

## WALKTHROUGH

### CORS preflight (4-13)
`OPTIONS` → 204-style `Response(null)` with `Access-Control-Allow-Origin: *` + methods + `Content-Type` header allowlist. Technically correct CORS exchange — and unnecessary for the same-origin frontend (S-03). Because the browser never sends a preflight for a simple GET same-origin, this branch serves only foreign origins.

### Key retrieval (16-29)
```js
const ASSEMBLYAI_API_KEY = context.env.ASSEMBLYAI_API_KEY;
if (!ASSEMBLYAI_API_KEY) { ...500 with 'API key not configured'... }
```
Correct secret sourcing (env, not literal — contrast deepgram-key.js) ✅; error discloses only the fact of misconfiguration ✅ (log-only detail) ✅.

### Token mint (31-60)
```js
const expiresInSeconds = 600;
const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;
const tokenResponse = await fetch(url, {
  method: 'GET',
  headers: { 'Authorization': ASSEMBLYAI_API_KEY },
});
```

Verified against AssemblyAI's documentation ([temporary-token docs](https://www.assemblyai.com/docs/streaming/authenticate-with-a-temporary-token)):
- **Endpoint & method:** the docs' prose says "POST request", while their own JS quickstart sample issues `fetch(url)` (GET). The deployed function's GET matches the working sample; treat the docs' prose/samples inconsistency as an upstream docs quirk — worth re-verifying at upgrade time (flagged in `external-api-verification.md` §2).
- **`expires_in_seconds=600`:** within the documented 1-600 range (max) ✅.
- **Auth header without `Bearer`:** matches AssemblyAI's convention ✅.
- **One-time-use tokens:** documented — see C-07 for the systemic implication this function's design ignores.

Failure branch (46-60): returns upstream status + **raw upstream body** (`details: errorText`) — S-11's leak; correct HTTP status pass-through ✅ otherwise.

### Success (62-73)
`{ token: data.token }` with `no-cache, no-store, must-revalidate` ✅ (credential semantics correct).

### Catch (75-89)
`{ error, message: error.message, type: error.name }` — S-11 (client-visible internals); full detail also logged ✅.

---

## FINDINGS SUMMARY

| ID | Finding | Severity |
|---|---|---|
| — | Correct secret handling (env-only) | ✅ positive |
| — | Correct no-store caching | ✅ positive |
| S-03 | Wildcard CORS + OPTIONS branch | High (security) |
| S-10 | No rate limit → mint-for-free abuse surface | Medium |
| S-11 | Upstream body + error.message passthrough | Low |
| F-03 | No `AbortSignal.timeout` on upstream fetch | Medium (perf/robustness) |
| C-07 | Mints on every 50s client poll — waste amplified by this endpoint's cheap availability | Critical (cost) |
| F-07 | 4 emoji console logs per success | Low |

---

## PROPOSED HARDENED SHAPE (NOT APPLIED)

```js
export async function onRequest(context) {
  const key = context.env.ASSEMBLYAI_API_KEY;
  if (!key) return json({ error: 'not configured' }, 500);

  try {
    const res = await fetch(
      'https://streaming.assemblyai.com/v3/token?expires_in_seconds=600',
      { headers: { Authorization: key }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) {
      console.error('AASAI mint failed', res.status, await res.text());
      return json({ error: 'mint failed' }, 502);
    }
    const { token } = await res.json();
    return json({ token });                     // no-store via shared helper
  } catch (err) {
    console.error('AASAI mint error', err.message);
    return json({ error: 'mint error' }, 500);
  }
}
```
(+ WAF rate rule ~30/min/IP per hardening plan §5; CORS removed.)

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
