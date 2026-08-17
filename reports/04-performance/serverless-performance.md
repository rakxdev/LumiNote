# SERVERLESS PERFORMANCE — LumiNote v02 Cloudflare Pages Functions

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Scope:** `functions/api/token.js`, `functions/api/deepgram-key.js`, `functions/api/grammar.js`, plus `wrangler.toml` runtime configuration. Cloudflare Pages Functions run on the V8 isolates runtime (same family as Workers); startup cost is near-zero, so performance is dominated by upstream calls, payload handling, and invocation volume.

---

## INDEX

| ID | Finding | Severity | Location |
|---|---|---|---|
| F-01 | Token function performs an upstream AssemblyAI call on every invocation — and invocations arrive every 50 s per open tab (N-01) | High (volume) | `functions/api/token.js:35-42` |
| F-02 | No caching layer anywhere (no Cache API, no KV) — every grammar check re-pays the LanguageTool round trip; every token request mints fresh | Medium | all three functions |
| F-03 | No upstream timeouts in any function — a hung provider ties the function until the platform limit | Medium | token/grammar functions |
| F-04 | `grammar.js` does unbounded `request.json()` parsing before any validation | Medium | `functions/api/grammar.js:22` |
| F-05 | LanguageTool upstream is the latency floor for grammar (typically 300-1500 ms) with no chunk-parallelism for long text | Low-Med | `functions/api/grammar.js:63-103` |
| F-06 | `compatibility_date = "2024-01-01"` — 2.5+ years stale at audit time; missing runtime fixes/features | Low | `wrangler.toml:3` |
| F-07 | Console logging on the hot path (4 log lines per successful token request incl. emoji) — noise in tail logs; no structured levels | Low | `functions/api/token.js:31,44,64` |
| F-08 | Positive: correct no-store on credential responses; JSON-only contracts; stateless functions (scale horizontally for free) | Info | all |

---

# F-01 — Token mint volume

Server side of C-07/N-01. Each `/api/token` hit executes:

1. `context.env` lookup (free),
2. `fetch()` to `https://streaming.assemblyai.com/v3/token?...` — one upstream RTT (Cloudflare → AssemblyAI, typically 50-150 ms),
3. JSON parse/serialize and respond.

At the client's 50-second cadence, one idle tab generates 72 upstream provider calls/hour that are **never consumed** (one-time-use tokens). The client-side fix (mint-on-demand) eliminates this entirely; the server-side complement is a rate limit per IP (hardening plan §5) so a modified/abusive client cannot drive unbounded minting.

Worth stating the non-fix explicitly: caching tokens (e.g., KV) would be **wrong** even at first glance — one-time-use means a cached token serves exactly one future session; worse, concurrent users would race for the same token. The correct server behavior is mint-per-request with volume control at the edge (rate rule), which is what the design naturally becomes after C-07.

---

# F-02 — Zero caching

**Grammar:** identical text re-checked (double-clicks, "run it again after one more fix") re-pays the LanguageTool round trip and quota. A content-hash cache would absorb these:

```js
// sketch — KV binding required in wrangler.toml ([kv.namespaces] GRAMMAR_CACHE)
const key = `grammar:v1:${await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))}`;
// hex-encode key; check GRAMMAR_CACHE.get(key); on miss, call upstream and put with expirationTtl: 3600
```

Privacy note: caching user text in KV is a data-retention decision — hash the text as the key, store only the corrected output, short TTL, and document it (or skip caching if the zero-persistence posture in S-12 is a product principle — then cache only a `seen-hash → skip` flag for unchanged text, which stores no content).

**Token:** not cacheable (see F-01). **Deepgram key:** should not exist as an endpoint (C-02).

---

# F-03 — Missing upstream timeouts

None of the three functions pass an `abort` signal to `fetch`. On the Pages Functions runtime, a hanging upstream holds the invocation until the platform's CPU/wall limits intervene; the client (no timeout either — H-10/M-14) shows an infinite "loading" spinner for grammar or a stuck "Connecting" for recording. One-line fix per call site:

```js
signal: AbortSignal.timeout(5000)   // token/key mint
signal: AbortSignal.timeout(8000)   // LanguageTool
```

`AbortSignal.timeout` is supported in the Workers runtime (and modern browsers) — verify against the pinned compatibility date after bumping F-06.

---

# F-04 — Unbounded parse before validation

```js
const body = await context.request.json();
const rawText = body.text || '';
```

`request.json()` buffers and parses whatever arrives (subject only to the platform body cap). A 10 MB JSON of nested depth is parsed before any length/type check. Validation-first shape:

```js
const text = typeof body?.text === 'string' ? body.text : null;
if (text === null || text.length === 0) return json({ correctedText: '' });
if (text.length > 20000) return json({ error: 'text too long' }, 413);
```

(The parse itself still buffers the body — the platform-level guard is a WAF rule capping request size for `/api/*`, listed in the hardening checklist.)

---

# F-05 — Grammar latency floor

LanguageTool public API latency (300-1500 ms typical for paragraph-length text) sets the client's perceived "Fix Grammar" duration. Mitigations in priority order: (1) correct — the current single call is fine for ≤ ~2 KB text; (2) chunk >4 KB transcripts into paragraph chunks and process sequentially (parallel risks the 20 req/min shared-IP cap — H-09); (3) move to self-hosted LanguageTool or a faster provider (R-09) if grammar becomes a headline feature. Also note the free API caps suggestions at 30 misspellings — long transcripts get silently partial results even when the call succeeds.

---

# F-06 — `compatibility_date` staleness

```toml
compatibility_date = "2024-01-01"
```

The date pins the runtime's behavior flags; a 2.5-year-old date opts the project out of bug fixes and newer standard-library additions (flag-gated). Routine hygiene: bump to a recent date during a maintenance window, run `wrangler pages dev` against it, and verify the three functions + `AbortSignal.timeout` usage. Also worth reviewing in the same pass: `[build] command = ""` + `watch_dirs = []` + empty `[env.*] vars` blocks add nothing and can be pruned; `pages_build_output_dir = "public"` is the modern key (correct).

---

# F-07 — Logging hygiene

`token.js` logs four emoji-tagged lines per successful request (`'✅ API key loaded…'`, `'📡 … status:'`, `'✅ Token generated…'`). At 72 req/hour/tab (F-01) that's ~350 log lines/hour per idle visitor in `wrangler tail` / dashboards — drowning genuinely interesting errors (the same file logs failures with the same visual weight). Recommend: log at `debug`/`info` level for success (or only on first-seen), `error` for failures, structured fields instead of prose. No behavior change — pure observability ergonomics.

---

# F-08 — Positive findings

- **Stateless by design** — no shared mutable state across invocations; horizontal scaling is free; no cold-start penalty class (V8 isolates).
- **Correct cache semantics on credentials** — `no-cache, no-store, must-revalidate` on token/key responses prevents edge/browser caching of secrets.
- **Error responses are JSON end-to-end** — the client never has to parse HTML error pages (though the bodies leak internals — S-11).
- **Right-sized functions** — each endpoint does one job; routing via the `functions/api/` file convention is the idiomatic Pages pattern.
- **Method checks present** where it matters (`grammar.js` 405s non-POST; token endpoint is GET-only by convention — though neither rejects other methods *explicitly* on token/key; minor).

---

## INVOCATION COST SUMMARY (per hour, steady state, 100 concurrent open tabs)

| Endpoint | Current invocations | Necessary invocations |
|---|---|---|
| `/api/token` | 100 × 72 = 7,200 | ≈ sessions started (≤ a few hundred) |
| `/api/deepgram-key` | 100 × 72 = 7,200 (page-load fetch is once per tab — actually 100, corrected: 1 per tab open) | 0 (endpoint should mint per Deepgram session start) |
| `/api/grammar` | on-demand only | same (plus cache-hit elimination) |

(Correction on the middle row: the key fetch happens once at DOMContentLoaded, not on the 50 s interval — so 100 invocations/hour for 100 tab-loads that hour, not 7,200. The token row's 7,200 stands. Table reflects corrected figures.)

---

*Analysis only — no source files or configuration were modified. Master index: `reports/README.md`.*
