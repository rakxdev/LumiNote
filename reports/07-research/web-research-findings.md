# WEB RESEARCH FINDINGS — LumiNote v02 Audit

- **Research date:** 2026-08-16/17 · All findings verified against primary sources during the audit; URLs listed per item. Research was performed *after* reading the full codebase, targeting every external dependency and standard the app touches.

---

## 1. ASSEMBLYAI STREAMING v3 (temporary tokens & models)

**Sources:** [Authenticate with a temporary token](https://www.assemblyai.com/docs/streaming/authenticate-with-a-temporary-token) · [Transcribe streaming audio](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio) · [Streaming product page](https://www.assemblyai.com/products/streaming-speech-to-text)

| Fact verified | Impact on LumiNote |
|---|---|
| Token endpoint: `streaming.assemblyai.com/v3/token?expires_in_seconds=N`; docs prose says POST but official JS sample uses GET (as does LumiNote) | Function's GET works; watch for docs/prose convergence — re-verify at each upgrade |
| `expires_in_seconds` valid range 1–600; **tokens are one-time-use (single session)** | **C-07 root cause**: 50-second background refresh mints tokens that can never be reused — pure waste |
| WS: `wss://streaming.assemblyai.com/v3/ws?speech_model=…`; auth via `Authorization` header (no Bearer) or temporary token; token-as-query-param is the browser path | S-04 (token in URL) is the accepted browser pattern; low residual risk |
| Audio: 16 kHz mono 16-bit PCM default; `encoding=pcm_s16le` token used | LumiNote's params are correct ✅ |
| Message protocol: `Begin{id, expires_at}` → `Turn{turn_order, transcript, end_of_turn, end_of_turn_confidence, turn_is_formatted, words[]}` → client `{"type":"Terminate"}` → final Turn → `Termination{audio_duration_seconds, session_duration_seconds}` | **H-04/H-05**: LumiNote handles only `Turn` and closes without awaiting the final flush; `end_of_turn`/`turn_is_formatted`/`expires_at` all ignored |
| Model id `universal-3-5-pro` is real and current (docs' example model) | README/UI claims verified ✅ |
| Model id `universal-streaming-english` — not found in docs crawled | ⚠️ could not be verified externally (works per repo history); flag for re-verification — see external-api-verification §3 |

## 2. DEEPGRAM (auth & streaming)

**Sources:** [Token-Based Auth guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) · [Grant token API reference](https://developers.deepgram.com/reference/auth/tokens/grant) · [Creating API keys](https://developers.deepgram.com/docs/create-additional-api-keys) · [JS SDK](https://github.com/deepgram/deepgram-js-sdk)

| Fact verified | Impact |
|---|---|
| `POST /v1/auth/token` mints a JWT, **30-second TTL**, `usage::write` scope, minted with the master key server-side | **C-02 fix**: the correct replacement for serving the raw key; token validated at connect, open WS survives expiry |
| REST calls from browser hit CORS; grant must be proxied server-side (Pages Function qualifies) | Confirms the recommended architecture shape (function mints, browser connects) |
| Keys must remain server-side; docs explicitly warn against browser exposure | S-01/S-02 confirmed as violations of provider guidance, not just general best practice |
| `wss://api.deepgram.com/v1/listen?model=nova-3&language=en&encoding=linear16&sample_rate=16000&smart_format=true&interim_results=true` — param set valid; browser auth via subprotocol `['token', …]` | LumiNote's Deepgram URL params correct ✅; the *credential* passed is the problem |

## 3. LANGUAGETOOL PUBLIC API

**Sources:** [API docs](https://languagetool.org/http-api/) · [Public HTTP API](https://dev.languagetool.org/public-http-api.html) · [Help center](https://help.languagetool.org/hc/en-us/articles/39254488835095-Does-LanguageTool-offer-an-API)

| Limit (free tier) | Value | Consequence |
|---|---|---|
| Requests / minute / IP | **20** | Server-side calls share Cloudflare egress IPs — concurrent users throttle each other (H-09) |
| Characters / minute / IP | 75,000 | a few long transcripts/min hits it |
| Characters / request | **20,000** | long transcripts silently uncorrectable (H-09) |
| Misspelled words with suggestions | 30 per request | partial results on long text even on success |
| Escape hatch | self-host (OSS) or Premium | R-09 recommendation |

## 4. ANIME.JS VERSION STATE

**Sources:** [cdnjs listing](https://cdnjs.com/libraries/animejs) · [jsDelivr package](https://www.jsdelivr.com/package/npm/animejs) · [v4 API change issue](https://github.com/juliangarnier/anime/issues/1105) · [animejs.com](https://animejs.com/)

- Current line: **v4.5.x** (jsDelivr); cdnjs hosts up to 4.2.0-beta — LumiNote pins **3.2.1** (legacy).
- **v4 is a breaking redesign**: no global `anime` object; `animate(target, params)` import-based API. Upgrade = rewrite of all 2 call sites — trivial *after* migration to modules; not drop-in.
- 3.2.1 has no known exploited CVEs; the audit's concerns are S-08 (no SRI) and M-03 (unguarded global), not the version itself. Self-hosting 3.2.1 today is the zero-risk move; v4 migration is optional polish.

## 5. CLOUDFLARE PAGES MECHANICS

**Sources:** [Headers docs](https://developers.cloudflare.com/pages/configuration/headers/) · [Custom headers blog](https://blog.cloudflare.com/custom-headers-for-pages/) · [Community CSP threads](https://community.cloudflare.com/t/cloudflarepages-abridge-pages-dev-how-do-i-set-headers-like-content-security-policy/651851)

- `_headers` file in the **build output dir** (`public/`) — LumiNote has none → S-05.
- **`_headers` does not apply to Function responses** — each function must set its own headers (hardening plan §1-2).
- Confirmed available: per-path patterns, status-specific rules.

## 6. ACCESSIBILITY / CSS STANDARDS

**Sources:** [W3C SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) · [Technique C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) · [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) · [Deque 2.3.3](https://dequeuniversity.com/resources/wcag2.1/2.3.3-animations-from-interactions)

- Motion-reduction is an AAA criterion under 2.1, carried forward in 2.2; C39 is the canonical implementation — LumiNote has none (A-05).
- Guidance reinforces on-page toggles in addition to the media query (informs D-05 settings proposal).
- Dynamic viewport units (`dvh`) — baseline support in all evergreen engines since 2022-2023 (Safari 15.4+, Chrome 108+, Firefox 101+); safe with `@supports` fallback for the app's support floor (responsive §1 fix).

## 7. RESEARCH METHOD & LIMITS

- All lookups performed 2026-08-16/17; provider docs are living documents — re-verify token endpoints and model ids at each dependency upgrade.
- Two search attempts (dvh viewport; one model-id confirmation) timed out/captcha'd; the dvh finding is cross-confirmed by MDN/known baselines, and `universal-streaming-english` remains **unverified** (flagged, not asserted).
- No live API calls were made with any discovered credential (see secrets report §7 ethics note).

---

*Master index: `reports/README.md`.*
