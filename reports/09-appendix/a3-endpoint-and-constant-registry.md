# APPENDIX C — Endpoint, ID, and Constant Registry

- Purpose: a single machine-checkable registry of every URL, selector, id, constant, and magic number in the codebase (commit `61bbfcb`), with the source line. Use for refactors (renames), audits (constant drift), and the acceptance checks.
- Format per row: value → where (file:line) → role → usage notes.

---

## C.1 ENDPOINTS & URLS

| URL / path | Location | Role |
|---|---|---|
| `/api/token` | `public/index.js:101` (fetch) · `functions/api/token.js` (route) | AssemblyAI temp-token mint |
| `/api/deepgram-key` | `index.js:127` · `functions/api/deepgram-key.js` | Deepgram key vending (C-02) |
| `/api/grammar` | `index.js:330` (POST) · `functions/api/grammar.js` | grammar correction |
| `/token` | `server.js:11` | legacy local-server route — **mismatch** (H-10) |
| `https://streaming.assemblyai.com/v3/token?expires_in_seconds=600` | `functions/api/token.js:35` · `tokenGenerator.js:5` | AAI token mint (GET) |
| `wss://streaming.assemblyai.com/v3/ws?speech_model=…&language_code=en&sample_rate=16000&encoding=pcm_s16le&token=…` | `index.js:542` | AAI streaming |
| `wss://api.deepgram.com/v1/listen?model=nova-3&language=en&encoding=linear16&sample_rate=16000&smart_format=true&interim_results=true` | `index.js:480` | Deepgram streaming |
| `https://api.languagetool.org/v2/check` | `functions/api/grammar.js:69` | LanguageTool |
| `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap` | `index.html:11` | fonts (render-blocking, N-03) |
| `https://fonts.googleapis.com` / `https://fonts.gstatic.com` | `index.html:9-10` | preconnects |
| `https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js` | `index.html:130` | animation lib (M-03/S-08) |
| `audio-processor.js` (relative) | `index.js:189` | worklet module |

## C.2 DOM SELECTORS (JS-grabbed ids & classes)

| Selector | Line | Element |
|---|---|---|
| `#recordButton`, `#buttonText`, `#buttonIcon` | `index.js:3-5` | record control |
| `#message`, `#copyFeedback` | 6, 11 | editor, toast root |
| `#statusIndicator`, `#statusText` | 7-8 | status pill |
| `#wordCount`, `#charCount` | 10-11 | stats |
| `.model-badge` | 12 | v02 badge |
| `#customModelSwitcher`, `.model-option`, `#selectedModelLabel`, `#modelDropdownMenu` | 25-52/HTML | switcher |
| `#liveTurnSpan` | 242-282 | live interim span |
| `#clearButton`, `#grammarButton`, `#copyButton`, `#downloadButton`, `.copy-icon`, `.tick-icon`, `#toastText` | 320-424 | controls |

**Selector collision risk:** `#liveTurnSpan` is created at runtime inside `#message`; any future CSS/scoping must account for it. No duplicate ids found ✅.

## C.3 DESIGN/CONFIG CONSTANTS

| Constant | Value | Location | Drift check |
|---|---|---|---|
| `sampleRate` | 16000 | `index.js:159`, worklet context | matches WS params ✅ |
| chunk duration | 100 ms (`sampleRate*0.1`) | `index.js:201-203` | ✓ |
| `MAX_16BIT_INT` | 32767 | `audio-processor.js:1` | asym rail (H-08) |
| token expiry (server) | 600 s | `token.js:34`, `tokenGenerator.js:13` | vs client 55 s ❌ (C-07) |
| token "valid age" | 55 s | `index.js:96` | contradicts 600 ❌ |
| refresh interval | 50000 ms | `index.js:141` | C-07 |
| switch delay | 300 ms | `index.js:81` | race (H-01) |
| scroll margin | 120 px | `index.js:312` | M-02 |
| toast hold | 2200 ms | `index.js:424` | stacking bug |
| copy icon revert | 2000 ms | `index.js:387` | ✓ |
| `interactive` latencyHint | — | `index.js:160` | ✓ |
| max-width container | 1360 px | `styles.css:56` | ✓ |
| media queries | 900/600 px | `styles.css:608,637` | responsive §2 |
| font weights | Inter 300-700, Outfit 400-700 | `index.html:11` | L-18 |
| Config: name | `luminote-v2` | `wrangler.toml:2` | matches docs ✅ |
| Config: compat date | `2024-01-01` | `wrangler.toml:3` | stale (F-06) |
| Deepgram key literal | `2b2fe3…c4e` | `deepgram-key.js:13`, `index.js:136` | **S-01 rotate** |

## C.4 MODEL IDS & LABELS (the M-01/L-02 drift map)

| `data-value` (HTML:33,42,51) | Provider branch (`index.js:478`) | Status text label (`index.js:650-652`) | Toast label (`index.js:60-62`) | HTML label |
|---|---|---|---|---|
| `universal-3-5-pro` (default, `index.js:17`) | AAI else-branch | "AssemblyAI 3.5 Pro" | "AssemblyAI 3.5 Pro" | "🧠 AssemblyAI Universal-3.5 Pro" |
| `universal-streaming-english` | AAI else-branch | "AssemblyAI Fast" | "AssemblyAI Fast" | "⚡ AssemblyAI Fast Realtime" |
| `deepgram-nova-3` | DG branch (`index.js:478`) | "Deepgram Nova-3" | "Deepgram Nova-3" | "🚀 Deepgram Nova-3 (150ms)" |

Predicates in use: `selectedModel === 'deepgram-nova-3'` (478, 602) vs `selectedModel.startsWith('deepgram')` (69) — inconsistent (M-01c).

## C.5 SECRETS & ENV KEYS

| Key | Where defined | Where consumed | Notes |
|---|---|---|---|
| `ASSEMBLYAI_API_KEY` | Cloudflare secret (docs) | `token.js:16` | correct env-only ✅ |
| `DEEPGRAM_API_KEY` | Cloudflare secret (docs) / **literal** | `deepgram-key.js:13` | rotate + fix (S-01) |
| `.env` local | gitignored ✅ | `tokenGenerator.js` via dotenv | |
| Account ID `25bff71e…` | `CLOUDFLARE_DEPLOYMENT.md:25,28,33` | example commands | S-06 scrub |

## C.6 FUNCTION/MESSAGE TYPE STRINGS

| String | Lines | Role |
|---|---|---|
| `"CloseStream"` | `index.js:70`, `603` | DG close |
| `"Terminate"` | `index.js:72`, `605` | AAI close |
| `"Turn"` | `index.js:565` | AAI frame type |
| `"Results"` | `index.js:505` | DG frame type |
| `"is_final"` | `index.js:509` | DG final flag |
| `"audio_data"` | `audio-processor.js:18` | worklet→main message key |
| `registerProcessor('audio-processor', …)` | `audio-processor.js:24` | worklet name — must match `new AudioWorkletNode(audioContext, 'audio-processor')` ✅ |

## C.7 RUNTIME FLAG/CLASS STATES

| Class/flag | Meaning | Toggled at |
|---|---|---|
| `isRecording` (module) | session active | `index.js:627` |
| `.recording` (button/pill) | UI recording state | `index.js:638,647` |
| `.connected` (pill) | ghost state (L-11) | `index.js:648` |
| `.loading` (grammar btn) | spinner | `index.js:327,354` |
| `.open` (switcher) | dropdown open | `index.js:28-34` |
| `.show` (toast) | toast visible | `index.js:420-424` |
| `.active` (model-option) | selected option | `index.js:49-50` |

---

*Appendix to the LumiNote audit. No source files modified. Master index: `reports/README.md`.*