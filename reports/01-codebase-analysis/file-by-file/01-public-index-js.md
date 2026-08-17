# FILE ANALYSIS — `public/index.js` (716 lines)

- **Role:** The entire client application: DOM wiring, model switcher, token/key management, audio pipeline, dual-provider WebSocket streaming, live transcript rendering, editing state reconciliation, and utility actions (copy/download/grammar/clear).
- **Architecture:** Single IIFE-less script, module-scope state, seven functions exported to `window.*` for inline `onclick` handlers. No imports, no build step.
- **Complexity anchors:** `TokenManager` object (singleton, lines 87-151), `createMicrophone` closure factory (172-231), streaming state trio `baseText`/`activeTurnText`/`currentTurnOrder` (14-22).

---

## SECTION MAP

| Lines | Section | Cross-refs |
|---|---|---|
| 1-12 | DOM handle grab | — |
| 14-22 | Global state | H-01 races |
| 24-84 | Model dropdown + live switch | C-03, H-01, M-01 |
| 87-151 | `TokenManager` | C-07, M-06 |
| 153-170 | `getAudioContext` | M-04 |
| 172-238 | Microphone factory + `mergeBuffers` | P-11..P-14, H-08 |
| 241-261 | `onEditorInput` / `updateStats` | P-01, P-03, H-06, M-12 |
| 264-315 | `renderTranscript` / `commitActiveTurn` / `scrollToBottomSmart` | P-02, P-07, M-02, M-10 |
| 318-356 | `fixGrammar` | M-07, H-07 |
| 359-411 | `copyToClipboard` / `downloadTranscript` | M-03 |
| 413-435 | Toast / `clearTranscription` | — |
| 438-453 | `toggleRecording` | H-02 |
| 455-596 | `startRecording` — dual-provider branch | C-03, C-04, H-03, H-04, N-07 |
| 598-624 | `stopRecording` | H-05, M-13, M-14 |
| 626-670 | `updateRecordingState` | P-04, P-06, M-01 |
| 673-707 | Init + teardown listeners | M-13 |
| 709-717 | Global exports | security note below |

---

## DETAILED WALKTHROUGH

### Lines 1-22 — Handles and state

```js
/* global anime */                       // ESLint pragma for the CDN global
const recordButton = document.getElementById("recordButton");
...
let selectedModel = "universal-3-5-pro"; // Default: AssemblyAI Universal-3.5 Pro
let baseText = ""; 
let currentTurnOrder = null;
let activeTurnText = "";
```

Eleven `getElementById` grabs at parse time — script sits at end of body so elements exist (fragile only if moved; no `DOMContentLoaded` guard, unlike the listener registration at 673 which waits for the event — inconsistent but currently safe). The `/* global anime */` pragma documents the CDN dependency for lint (M-03 details the runtime failure mode).

State trio semantics:
- `baseText` — committed/editor-owned text (excluding live interim span). Maintained lazily via `onEditorInput` (user edits) and `commitActiveTurn` (ASR commits).
- `activeTurnText` — latest interim transcript for the in-flight turn.
- `currentTurnOrder` — last-seen AssemblyAI turn id (null between sessions).

Note: `baseText` is *derived state* — the DOM is the real source of truth, and every writer re-derives it differently (clone-strip in `onEditorInput`, direct read in `commitActiveTurn`, wholesale assignment in `fixGrammar`). The divergent derivations are the root of H-06's edit-loss class.

### Lines 24-84 — Dropdown control + live switch

`toggleModelDropdown`/`closeModelDropdown` — class toggle on `#customModelSwitcher`; outside-click closes via the document listener (693-699). Keyboard gap: A-04.

`selectCustomModel(value, label, element)`:
- Early-return if same model ✅.
- Label/options class updates — synchronous UI ✅ (but optimistic per M-01).
- Live-switch branch (54-83): `resetBuffer()` (flush queue — deliberate, commit `5cd7436`), send provider-appropriate close message (CloseStream vs Terminate — note `startsWith('deepgram')` here vs `=== 'deepgram-nova-3'` at line 602, M-01c), `ws.close()`, null out, `setTimeout(startRecording, 300)`.

**The critical omission:** no `microphone.stopRecording()` — the leak analyzed as C-03. Also no timer cancellation — H-01's races. The 300ms constant is a timeout-not-event (N-08).

### Lines 87-151 — TokenManager

```js
const TokenManager = {
  token: null, tokenTimestamp: null, refreshInterval: null, deepgramKey: null,
  isValid() { ... age < 55 ... },
  async fetchToken() { fetch("/api/token") ... },
  async getToken() { isValid ? token : fetchToken() },
  async getDeepgramKey() { ... fetch("/api/deepgram-key") ... fallback literal ... },
  startBackgroundRefresh() { setInterval(fetchToken, 50000) },
  stopBackgroundRefresh() { clearInterval ... },
};
```

- `isValid()` 55s vs server 600s — the mismatch analyzed in C-07.
- Interval calls `fetchToken()` directly (ignoring `getToken()`'s validity gate) — every 50s, unconditionally.
- `getDeepgramKey` — caches forever (M-06), embeds the leaked key as fallback (C-01), and on fetch failure *silently* proceeds with the fallback (masking misconfiguration — the security report's "fallback-as-feature" antipattern).
- No fetch timeout/abort anywhere (H-10 family).
- `fetchToken` treats non-JSON bodies via exception → null → caller alerts (acceptable), but non-200-with-token-shaped-JSON would still be consumed — the endpoint contract is trusted blindly.

### Lines 153-170 — AudioContext

Pre-created 16 kHz/interactive context; recreated if closed; `resume()` fire-and-forget (M-04). Positive: singleton pattern prevents the classic multi-context exhaustion ✅; `beforeunload` closes it (701-707).

### Lines 172-238 — Microphone factory

Closure-per-recording owning: `stream`, `audioContext` ref, `audioWorkletNode`, `source`, `audioBufferQueue`.

- `requestPermission()` — bare `{audio:true}` (P-18).
- `startRecording(onAudioCallback)` — lazy re-permission if stream null (184); `addModule` each time (P-16); connects worklet→**destination** (193). The destination connection is required to keep the worklet's `process()` active in all engines (silent output since `process` never writes outputs) — correct pattern, worth a comment for future readers.
- onmessage: merge queue → 100ms threshold → slice exact sample count (`floor(sampleRate*0.1)`) → callback with `Uint8Array` view of the buffer (207 — note: **view over the whole queue buffer**, not a copy; safe because `mergeBuffers` returns a fresh array each time; subtle but currently correct).
- `resetBuffer()` — clears queue only (the live-switch flush).
- `stopRecording()` — nulls message handler **before** disconnect (ordering prevents late messages ✅), disconnects nodes, stops tracks, clears queue. This function is correct — the tragedy of C-03 is that it isn't *called* on the switch path.

`mergeBuffers` (233-238) — allocation-per-merge; P-14's cost analysis.

### Lines 241-315 — Editing reconciliation & rendering

- `onEditorInput` (241-252): the clone-strip derivation (P-03/H-06).
- `updateStats` (254-261): innerText split count (P-01, P-08, M-12).
- `renderTranscript` (264-291): creates `#liveTurnSpan` on demand (with the space-guard at 274-279 — nice detail: prevents gluing interim onto the previous word when the last DOM child is a text node without trailing space); sets `textContent` (XSS-safe ✅); scroll+stats side effects.
- `commitActiveTurn` (293-307): replaces span with a text node prefixed by a separator space; refreshes `baseText` from DOM.
- `scrollToBottomSmart` (310-315): the OR-condition hijack (M-02) and geometry cost (P-02).

### Lines 318-356 — fixGrammar

POSTs full editor text; on success — the wholesale replacement sequence (H-07); no disabled-guard during recording (M-07); no timeout; `grammarButton` gets `loading` class (spinner) but remains clickable (double-fire possible — heuristic review H-5).

### Lines 359-411 — Copy / download

- Copy: clipboard API + icon swap + anime + 2s revert — the anime-in-try-block defect (M-03).
- Download: Blob + object URL + anchor click + revoke — correct lifecycle (`revokeObjectURL` after click ✅); filename date-stamped ✅. Minor: no `URL.revokeObjectURL` deferral race risk here (synchronous click); Safari legacy `download` attr n/a modern.

### Lines 413-435 — Toast + clear

`showCopyFeedback` — single shared toast; `toastText` branch keeps the default text node path working if the span is missing (defensive ✅). Toast timeout fixed at 2200ms — repeated calls stack (clearTimeout missing → earlier timer hides a newer toast prematurely — cosmetic microbug worth noting).

`clearTranscription` — full reset; called from inline onclick; disabled during recording via `updateRecordingState` (633-636) ✅ (the guard grammar lacks).

### Lines 438-453 — toggleRecording

Disabled-guard + symmetric disable on both branches (H-02's stuck-button surface). Model-name derivation duplicated (M-01).

### Lines 455-596 — startRecording (the core)

Sequence: new microphone → permission (with .then/.catch boolean — fine) → close any existing ws (472-475 — the *only* ws hygiene) → branch:

**Deepgram branch (478-531):**
```js
const dgKey = await TokenManager.getDeepgramKey();
const dgUrl = 'wss://api.deepgram.com/v1/listen?model=nova-3&language=en&encoding=linear16&sample_rate=16000&smart_format=true&interim_results=true';
ws = new WebSocket(dgUrl, ['token', dgKey]);
```
- URL params correct per Deepgram's API (linear16/16k/smart_format/interim_results ✅); `nova-3` + `language=en` valid pairing.
- `onopen` — null-microphone guard (486-490) is dead code in practice (microphone was just created and permission verified) but harmless.
- `onmessage` — try/catch ✅; handles `Results` with `channel.alternatives[0]`; **is_final path has a subtle semantic**: `activeTurnText = transcript; commitActiveTurn();` — Deepgram is_final results are per-utterance-segment; consecutive finals append via commit ✅. Empty-transcript guard ✅.
- `onerror` → UI reset (mic NOT stopped — C-04 family); `onclose` → UI reset (C-04 proper).

**AssemblyAI branch (533-587):**
- Token via TokenManager (536) — the C-07 mint-timing surface.
- URL: `speech_model=${selectedModel}&language_code=en&sample_rate=16000&encoding=pcm_s16le&token=${token}` — `pcm_s16le` is the v3 encoding token ✅ (matches docs' default 16-bit PCM framing); token-in-query (S-04).
- `onmessage` — no try/catch (H-03); only `Turn` handled (H-04 — `Begin`/`Termination`/errors dropped); turn-switch detection via `turn_order` only (M-10).
- `onclose` — 1008 → alert (session conflict; the free-tier single-stream reality) — good specificity, wrong idiom (M-09); no mic stop (C-04).

**Shared:** outer catch alerts (592). No connection timeout (H-02). Token fetch after permission (N-07 ordering).

### Lines 598-624 — stopRecording

Send provider close message (guarded) → immediate `ws.close()` (H-05) → mic stop ✅ → `commitActiveTurn` ✅ → `currentTurnOrder = null` → UI reset. The mic teardown here is correct — it's the *other* teardown paths (remote close, switch) that skip it.

### Lines 626-670 — updateRecordingState

Central UI truth: button text/icon/class, status pill classes+text, clear-button disable, anime flourish. innerHTML SVG swaps (P-04); name re-derivation (M-01); the anime/statusIndicator property collision (P-06).

### Lines 673-717 — Init, teardown, exports

- DOMContentLoaded: state init, editor input binding, token+key prefetch (M-06/N-02), background refresh start (C-07), audio warm-up, stats.
- Outside-click closer for dropdown.
- `beforeunload` — timer stop + context close (M-13's gaps).
- **Global exports (709-717):** seven functions onto `window` to serve inline handlers. This is the CSP-unfriendly pattern (inline `onclick` + globals) — works, blocks a strict CSP (S-05's `script-src` can't adopt `'unsafe-inline'` for handlers if hardened later... note: inline *handlers* are governed by `script-src-attr`/'unsafe-inline' — a future hardening step should convert to `addEventListener` bindings; tracked in hardening plan §6).

---

## QUALITY ASSESSMENT

| Dimension | Rating | Notes |
|---|---|---|
| Readability | ★★★★☆ | Clear names, consistent formatting, section comments; the streaming-state trio needs a doc block |
| Correctness | ★★☆☆☆ | C-03/C-04/C-07 classes; per-function logic mostly clean, lifecycle seams are the failures |
| Robustness | ★★☆☆☆ | try/catch pockets, no timeouts, silent swallows (`catch (e) {}` ×4) |
| Testability | ★☆☆☆☆ | No units; DOM+network fused; exports are UI functions only |
| Security | ★★☆☆☆ | Transcript path XSS-safe ✅; key fallback ❌; inline-handler/global pattern blocks CSP |
| Performance | ★★☆☆☆ | Layout thrash + allocation churn in hot paths (P-01..P-14) |

**Refactor directions (not applied):** (1) split into ES modules (`app.js`, `audio.js`, `providers/{assemblyai,deepgram}.js`, `editor.js`, `tokens.js`) — build-free via `<script type="module">`; (2) extract a `Session` object owning {ws, microphone, model} with explicit `start/stop/switch` transitions — kills the C-03/H-01 class by construction; (3) replace inline handlers with bound listeners.

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
