# APPENDIX B — Provider Message Catalogs & Parser Contracts

- Purpose: the complete wire-level contract of both streaming providers as relevant to LumiNote, derived from provider documentation (sources in `07-research/web-research-findings.md`) and the app's parser code. Use this to extend parsers, write contract tests, and double-check every message field the app currently drops.

---

## B.1 ASSEMBLYAI — Streaming v3 (`wss://streaming.assemblyai.com/v3/ws`)

### Connection query parameters (app: `public/index.js:542`)

| Param | App value | Notes |
|---|---|---|
| `speech_model` | `universal-3-5-pro` / `universal-streaming-english` | `universal-3-5-pro` verified; **second id unverified** (research §1) |
| `language_code` | `en` | pinned (commit `bdf7b9c`) |
| `sample_rate` | `16000` | must equal capture rate ✅ |
| `encoding` | `pcm_s16le` | v3 token for 16-bit PCM ✅ |
| `token` | temp token | one-time-use (C-07); logged server-side (S-04) |

### Client→server messages

| Type | App sends? | Payload | When |
|---|---|---|---|
| binary audio | ✅ | raw PCM chunks (Int16LE) | every 100 ms |
| `{"type":"Terminate"}` | ✅ | — | on stop (immediately followed by close — H-05) |
| `{"type":"State","state":"pushing"}` | ❌ | optional P2.py state toggle | n/a |

### Server→client messages

| Type | Fields | Meaning | App handling (line) |
|---|---|---|---|
| `Begin` | `id`, `session_boundary_expiration`, `expires_at` | session opened; expiry bound | ❌ ignored — could drive pre-expiry rollover (H-04) |
| `Turn` | `turn_order`, `transcript`, `end_of_turn`, `end_of_turn_confidence`, `turn_is_formatted`, `words[{start,end,confidence,punctuated_word,word}]`, `confidence` | interim/final deltas | ⚠️ partial: only `turn_order` + `transcript` (563-574) |
| `Termination` | `audio_duration_seconds`, `session_duration_seconds` | session ended by server | ❌ ignored (H-04) |
| error frame | `type:"Error"`-shaped | auth/throttle/param failures | ❌ ignored |

**Dropped-field impact table:**

| Dropped field | What could be built | Status |
|---|---|---|
| `end_of_turn` / `end_of_turn_confidence` | commit turns at natural boundaries (M-10 fix) | recommended |
| `turn_is_formatted` | apply final formatting as committed text | recommended |
| `words[].start/end` | D-04 timeline rail; per-turn durations | roadmap |
| `Begin.expires_at` | session-age countdown / auto-rollover | recommended |
| `Termination` | clean stop + reason + reconnect | H-04 fix |

### Lifecycle states (documented)

```
CONNECTING → Begin → (Turn×n) → client Terminate → Turn(final) → Termination → close
                       └─ server-side termination (max duration / errors) → Termination → close
```

## B.2 DEEPGRAM — Listen (`wss://api.deepgram.com/v1/listen`)

### Query parameters (app: `public/index.js:480`)

| Param | App value | Notes |
|---|---|---|
| `model` | `nova-3` | ✅ documented |
| `language` | `en` | ✅ |
| `encoding` | `linear16` | ✅ |
| `sample_rate` | `16000` | ✅ |
| `smart_format` | `true` | yes/no param; doc says `true`/`false` — `true` ✅ |
| `interim_results` | `true` | ✅ |

### Client→server messages

| Type | App sends? | Notes |
|---|---|---|
| binary audio | ✅ | 100 ms PCM chunks |
| `{"type":"CloseStream"}` | ✅ (stop path) | graceful final-flush trigger — but closed immediately (H-05) |

### Server→client messages

| Type | Contents | App handling (line) |
|---|---|---|
| `Metadata` | `transaction_key`, `request_id`, `sha256` | ❌ ignored (benign; but request_id aids debugging) |
| `Results` | `channel{alternatives[{transcript, confidence, words[]}]}, is_final, speech_final, start, duration` | ⚠️ partial: `transcript`, `is_final` only (502-520) |
| `UtteranceEnd` | `last_word_end` | ❌ ignored — commit key for VAD endpointing |
| `Error` | `type:"Error"`, `err_msg` (e.g., auth 401) | ❌ ignored (H-04) |

### `Results.is_final` semantics (critical for the parser)

- `is_final: true` = this utterance segment is final **for the current endpointed chunk**; the app commits it (509-511) ✅.
- Consecutive finals append sequentially — correct with the current "append-on-commit" model.
- `speech_final: true` = the utterance (voice activity) ended; without `endpointing`/`vad_events` params the app cannot use silence boundaries; interim_results alone gives word-level interims only.
- With `smart_format=true`, interim text is NOT formatted ("i will" → final "I will") — the app's live span shows unformatted interim until commit; the committed text node contains the *final* text only if the last message before commit was final — which it is, on the final path ✅ — but on the switch/stop paths, `commitActiveTurn()` commits whatever interim text was last rendered (H-05's formatting loss).

### Auth subprotocol (`['token', credential]`)

- App: raw master key (C-02). Corrected: 30 s JWT from `POST /v1/auth/token` (hardening §3). The subprotocol mechanism itself is the documented browser path and needs no change.

## B.3 LANGUAGE TOOL — `/v2/check` (proxy: `functions/api/grammar.js:69-76`)

| Request | Value |
|---|---|
| Method/URL | `POST https://api.languagetool.org/v2/check` |
| Content-Type | `application/x-www-form-urlencoded` |
| Params | `text=<full transcript>`, `language=en-US` |
| Response | `{ matches: [{ message, offset, length, replacements: [{value}], rule: {id, description} }] }` |

Limits: 20 KB/request · 20 req/min/IP · 75 KB/min/IP · 30 suggestion-bearing matches/request (verified — H-09).

## B.4 CLOUDFLARE PAGES — own endpoints

| Endpoint | Method | Kind | Verified behavior |
|---|---|---|---|
| `/api/token` | GET (OPTIONS) | function | mints AAI token; CORS * (S-03); details passthrough (S-11) |
| `/api/deepgram-key` | GET (OPTIONS) | function | returns master key (C-02) |
| `/api/grammar` | POST, 405 otherwise | function | proxies LanguageTool + rules |
| static `/` | GET | Pages asset | `index.html` shell |

Request limits to note (platform): default request body cap applies to `/api/grammar`; no platform-level auth on `/api/*` paths — WAF rules required for rate limiting (hardening §4-5).

---

## B.5 CONTRACT TEST FIXTURES (copy-ready JSON for parser tests)

```json
// AAI Turn (interim)
{ "type": "Turn", "turn_order": 3, "transcript": "hello there", "end_of_turn": false, "confidence": 0.98, "words": [] }
// AAI Turn (final-formatted)
{ "type": "Turn", "turn_order": 4, "transcript": "Hello there.", "end_of_turn": true, "turn_is_formatted": true, "words": [{ "start": 0, "end": 900, "confidence": 0.99, "punctuated_word": "Hello" }] }
// AAI Termination
{ "type": "Termination", "audio_duration_seconds": 12.4, "session_duration_seconds": 12.6 }
// Deepgram interim
{ "type": "Results", "channel": { "alternatives": [{ "transcript": "i will call", "confidence": 0.94, "words": [] }] }, "is_final": false }
// Deepgram final
{ "type": "Results", "channel": { "alternatives": [{ "transcript": "I will call.", "confidence": 0.98, "words": [] }] }, "is_final": true }
// Deepgram error
{ "type": "Error", "err_msg": "You do not have enough credits" }
// LanguageTool match (overlap example)
{ "matches": [ { "offset": 10, "length": 4, "replacements": [{ "value": "X" }] }, { "offset": 12, "length": 4, "replacements": [{ "value": "Y" }] } ] }
```

These five fixtures cover: interim render, formatted commit (H-05 test), remote end (C-04 test), final commit, and parser robustness (H-03/H-04 tests).

---

*Appendix to the LumiNote audit. No source files modified. Master index: `reports/README.md`.*