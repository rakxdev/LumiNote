# EXTERNAL API VERIFICATION MATRIX — LumiNote v02

- **Date:** 2026-08-16/17 · Every external endpoint/parameter the app relies on, verified against provider documentation during this audit. Purpose: separate "verified correct" from "works today, unverified" so upgrades are safe.

---

## 1. ASSEMBLYAI — VERIFIED ✅ (with two watch items)

| App usage (file:line) | Verified against docs | Verdict |
|---|---|---|
| `GET https://streaming.assemblyai.com/v3/token?expires_in_seconds=600`, `Authorization: <key>` (`functions/api/token.js:35-41`) | Docs prose says POST; official JS sample uses GET — app matches the working sample | ✅ works; ⚠️ watch for docs convergence (prose vs sample inconsistency is upstream) |
| `expires_in_seconds=600` | documented max = 600 | ✅ at limit |
| `wss://streaming.assemblyai.com/v3/ws?speech_model=universal-3-5-pro&language_code=en&sample_rate=16000&encoding=pcm_s16le&token=<t>` (`index.js:542`) | WS host/params/encoding tokens match docs; `speech_model=universal-3-5-pro` is the docs' own example model | ✅ |
| Binary audio frames, 100 ms cadence | docs stream 4096-byte chunks; cadence unconstrained (smaller+frequent OK) | ✅ |
| `{"type":"Terminate"}` on stop (`index.js:605`) | correct termination message | ✅ (but close-without-awaiting-final contradicts documented final-flush flow — H-05) |
| Handles only `Turn` messages | docs also define `Begin`, `Termination`, error frames | ❌ gap (H-04) |
| `universal-streaming-english` model id (`index.html:51`) | **not found in any doc crawled** | ⚠️ unverified — works per repo history/claims; re-verify against the model-selection page before next deploy |

## 2. DEEPGRAM — VERIFIED ⚠️ (params right, credential pattern wrong)

| App usage | Verdict |
|---|---|
| `wss://api.deepgram.com/v1/listen?model=nova-3&language=en&encoding=linear16&sample_rate=16000&smart_format=true&interim_results=true` (`index.js:480`) | ✅ all params documented and correctly spelled |
| Auth: raw API key via WS subprotocol `['token', key]` (`index.js:482`) | ⚠️ documented browser mechanism — but provider guidance says keys stay server-side; the grant-token flow (`POST /v1/auth/token`, 30s TTL JWT) is the sanctioned browser path → C-02 |
| `is_final`/interim consumption of `Results` messages | ✅; `speech_final`/`UtteranceEnd`/`Error` unhandled (H-04) |
| `{"type":"CloseStream"}` on stop | ✅ correct message |

## 3. LANGUAGETOOL — VERIFIED ✅ (limits drive H-09)

| App usage | Verdict |
|---|---|
| `POST https://api.languagetool.org/v2/check` with `text`, `language=en-US` (`grammar.js:69-76`) | ✅ correct endpoint/params |
| No length/rate handling | ❌ 20 KB/request, 20 req/min/IP, 75 KB/min/IP, 30-suggestion caps all unhandled |
| Applies `replacements[0]` | ⚠️ acceptable heuristic; overlap risk noted |

## 4. BROWSER PLATFORM APIs — code-read verification

| API | Usage | Verdict |
|---|---|---|
| `AudioContext{sampleRate:16000, latencyHint}` | supported all evergreen; iOS honors on modern versions | ✅ (M-04 gesture note) |
| `AudioWorklet` + `registerProcessor` | Safari 14.1+; no fallback in app (M-08) | ⚠️ |
| `navigator.clipboard.writeText` | secure-context; app on pages.dev ✅; needs focus — handled via catch | ✅ |
| `getUserMedia({audio:true})` | defaults vary (P-18 recommends explicit DSP constraints) | ⚠️ |
| `Intl.Segmenter` (proposed M-12 fix) | all evergreen since 2022-2023 | ✅ viable |
| `AbortSignal.timeout` (proposed F-03 fix) | Workers runtime + evergreen browsers | ✅ viable |
| `:has()`, `:placeholder-shown` (proposed H-11 fix variants) | `:has` baseline 2023+ — use `br:only-child` variant for safety | ✅ |

## 5. CDN ASSETS

| Asset | Verdict |
|---|---|
| `cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1` | ✅ exists/loads (path verified); ❌ no SRI (S-08); v4.5 is current (see research §4) |
| Google Fonts css2 multi-family URL | ✅ valid syntax; `display=swap` present |

---

## SUMMARY TABLE

| Integration | Parameters | Auth pattern | Protocol handling | Verdict |
|---|---|---|---|---|
| AssemblyAI token+WS | ✅ | ✅ (temp token) | ❌ partial (H-04/H-05) | **Best-practice-compliant core, protocol gaps** |
| Deepgram WS | ✅ | ❌ raw key (C-02) | ❌ partial | **Params right, architecture wrong** |
| LanguageTool | ✅ | n/a (public) | ❌ limits unhandled | **Works at hobby scale only** |

---

*Master index: `reports/README.md`.*
