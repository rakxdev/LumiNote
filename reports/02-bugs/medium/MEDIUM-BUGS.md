# MEDIUM-SEVERITY BUGS — LumiNote v02 Full Audit

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Severity model:** MEDIUM = real defects with bounded impact: degraded UX in common flows, inconsistent state, edge-case failures, or missing safeguards — worth fixing in the normal course of development.

---

## INDEX

| ID | Title | Primary Location |
|---|---|---|
| M-01 | Model-switch updates label/state before the new stream is actually up; naming strings diverge in three places | `public/index.js:37-84`, `446-448`, `650-652` |
| M-02 | Auto-scroll hijack: unfocused editor forces scroll-to-bottom on every interim, even when the user deliberately scrolled up | `public/index.js:310-315` |
| M-03 | If the anime.js CDN is blocked, successful copies report "Failed to copy" | `public/index.js:359-392` |
| M-04 | `AudioContext.resume()` is fire-and-forget — first words of a recording can be silence | `public/index.js:165-169` |
| M-05 | No WebSocket send backpressure check (`bufferedAmount`) — slow networks bloat memory | `public/index.js:495-499`, `556-560` |
| M-06 | Deepgram key fetched at page load for every visitor and cached forever | `public/index.js:681-684`, `124-137` |
| M-07 | "Fix Grammar" is enabled during live recording — corrected and raw text interleave | `public/index.html:110-113`, `public/index.js:318-356` |
| M-08 | No AudioWorklet feature detection — unsupported browsers get a stuck "Recording" UI | `public/index.js:183-210` |
| M-09 | `alert()` used for runtime errors despite an existing toast system | `public/index.js:467`, `537`, `584`, `592` |
| M-10 | Rapid `Turn` messages without `end_of_turn` handling can produce run-on sentences | `public/index.js:563-574` |
| M-11 | `commit` history references `icons.html` gallery that does not exist in the repo | git history vs file tree |
| M-12 | Word/character counters are whitespace-based — wrong for any non-space-delimited content | `public/index.js:254-261` |
| M-13 | `beforeunload` cleanup is best-effort and misses the mic/WS teardown | `public/index.js:701-707` |
| M-14 | Stop-during-`Connecting` closes a socket that was never open — silent no-op path masks failures | `public/index.js:610-613` |

---

# M-01 — Model label/state updates before the switch actually succeeds

**Files:** `public/index.js:43-52` (label swap), `54-83` (restart), `446-448` + `650-652` (names duplicated)

Three problems braided together:

**(a) Optimistic state.** `selectCustomModel` sets `selectedModel = value` and rewrites the dropdown label immediately (lines 43-46), then *attempts* a restart. If the restart fails (token endpoint down, provider rejects the model, network black-hole), the UI permanently claims the new model while no session is running. Restarting via the record button then uses `selectedModel` — which is correct — but during the "Switching…" window, failures leave the status pill stuck on "Switching to X..." because nothing resets it (no `onerror` path sets a "switch failed" status; `onerror` handlers call `updateRecordingState(false)` which does reset text — acceptable — but only if the WS ever errors rather than hangs, see H-02).

**(b) Name strings duplicated in three places.** The human-readable model name is constructed independently at:

- `selectCustomModel` lines 60-62 (`"Deepgram Nova-3"` / `"AssemblyAI Fast"` / `"AssemblyAI 3.5 Pro"`)
- `toggleRecording` lines 446-448 (same trio, duplicated)
- `updateRecordingState` lines 650-652 (same trio, duplicated again)

…and the HTML dropdown uses yet a fourth set (`"AssemblyAI Universal-3.5 Pro"`, `"Deepgram Nova-3 (150ms)"`, `"⚡ AssemblyAI Fast Realtime"`). The status pill therefore says "Recording (AssemblyAI 3.5 Pro)" while the dropdown says "🧠 AssemblyAI Universal-3.5 Pro" for the same model. Any rename (or new model) requires four synchronized edits; drift is already visible.

**(c) Inconsistent provider predicates.** The live-switch close path uses `selectedModel.startsWith('deepgram')` (line 69) while `stopRecording` and the branch logic use `selectedModel === 'deepgram-nova-3'` (lines 478, 602). Adding a `deepgram-nova-2` option would silently take the wrong close/branch path in one of the two sites.

### Recommended fix (NOT APPLIED)

Single source of truth:

```js
const MODELS = {
  'universal-3-5-pro':          { label: 'AssemblyAI Universal-3.5 Pro', provider: 'assemblyai' },
  'universal-streaming-english':{ label: 'AssemblyAI Fast Realtime',    provider: 'assemblyai' },
  'deepgram-nova-3':            { label: 'Deepgram Nova-3',             provider: 'deepgram' },
};
const modelInfo = () => MODELS[selectedModel];
// everywhere: `modelInfo().label`, `modelInfo().provider === 'deepgram'`
```

Update the label only after `onopen` of the new session (or roll back on failure).

---

# M-02 — Auto-scroll hijack when the editor is not focused

**File:** `public/index.js:310-315`

```js
function scrollToBottomSmart() {
  const distanceFromBottom = messageEl.scrollHeight - messageEl.clientHeight - messageEl.scrollTop;
  if (distanceFromBottom < 120 || document.activeElement !== messageEl) {
    messageEl.scrollTop = messageEl.scrollHeight;
  }
}
```

The condition is an **OR**. Second operand: if the editor is not the focused element, force scroll to bottom — regardless of how far up the user has scrolled. Concrete scenario:

1. User is dictating a long memo (recording active).
2. They scroll up inside the transcript to re-check something said a minute ago (scrolling does not necessarily move focus to the contenteditable; and even if a click focused it, clicking any other UI element — e.g. hovering toward the Copy button — blurs it).
3. The next interim frame (every ~100-400 ms while speaking) yanks the view back to the bottom.

The user effectively **cannot review earlier transcript content while recording** unless they keep the caret inside the editor at all times — and even then, clicking Copy/Export/Grammar blurs it and triggers the hijack.

The intent was presumably "if the user is not actively editing (caret elsewhere), keep the newest text visible". The correct formulation is an AND (only follow when already near the bottom), plus a sticky "follow" toggle:

```js
if (distanceFromBottom < 120) messageEl.scrollTop = messageEl.scrollHeight;
```

…and optionally an explicit "jump to latest" affordance (a small floating button) when `distanceFromBottom >= 120` during streaming, which is the pattern mature chat/transcript UIs use.

---

# M-03 — anime.js CDN failure turns successful copies into "Failed to copy"

**Files:** `public/index.js:359-392`, `public/index.html:130`

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
```

```js
try {
  await navigator.clipboard.writeText(text);      // SUCCEEDS
  copyIcon.style.display = 'none';
  tickIcon.style.display = 'inline-block';
  showCopyFeedback('Copied to clipboard!');
  anime({ targets: tickIcon, ... });              // ReferenceError if CDN blocked
  ...
} catch (err) {
  showCopyFeedback('Failed to copy');             // misleading: copy DID succeed
}
```

If cdnjs is unreachable (firewalled networks — common in corporate/IN contexts, China GFW, offline PWA-ish use, or any cdnjs outage), the global `anime` is undefined. `navigator.clipboard.writeText` already succeeded, so the text **is** on the clipboard; the animation call then throws, and the catch shows "Failed to copy". The user pastes, gets text, and learns the app lies to them — or worse, re-copies repeatedly.

The same global is used unguarded in `updateRecordingState` (line 664) and `fixGrammar`'s flow is unaffected; `updateRecordingState`'s `anime()` is the last statement, so its throw is mostly cosmetic — but `copyToClipboard`'s catch is a genuine false-failure report.

Also note: no SRI (`integrity` attribute) on the CDN script (see security hardening plan S-09), and the version is frozen on the legacy 3.2.1 line — anime.js v4 (current, 4.5.x) has a redesigned API ([upgrade notes](https://github.com/juliangarnier/anime/issues/1105)).

### Recommended fix (NOT APPLIED)

- Guard the animation: `if (window.anime) anime({...});` or a tiny `safeAnimate()` wrapper.
- Move the animation out of the copy `try` block so clipboard success/failure is reported on clipboard outcome alone.
- Self-host `anime.min.js` (~17 KB gz) to remove the CDN dependency entirely, add SRI if kept on CDN.

---

# M-04 — `AudioContext.resume()` is fire-and-forget

**File:** `public/index.js:165-169`

```js
if (globalAudioContext.state === 'suspended') {
  globalAudioContext.resume();     // not awaited
}
```

The context is created eagerly on `DOMContentLoaded` (line 688) — **outside any user gesture** — so Chrome/Firefox/Safari create it in the `suspended` state under autoplay policy. The first real click on "Start Recording" does eventually reach `getAudioContext()` → `resume()`, but the promise is discarded: `microphone.startRecording()` proceeds immediately, connecting the source and worklet to a context that may still be transitioning `suspended → running`.

Effects: the worklet's `process()` does not tick (or ticks late) while suspended/resuming, so the first few hundred milliseconds of speech can be dropped — "It cut off the first word" — an intermittent, device/policy-dependent complaint that is very hard to reproduce in testing (a warm tab that already resumed audio doesn't show it).

### Recommended fix (NOT APPLIED)

```js
async function getAudioContext() {
  if (!globalAudioContext || globalAudioContext.state === 'closed') {
    globalAudioContext = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
  }
  if (globalAudioContext.state === 'suspended') {
    await globalAudioContext.resume();
  }
  return globalAudioContext;
}
// createMicrophone().startRecording already awaits addModule; make it:
audioContext = await getAudioContext();
```

Also drop the eager `getAudioContext()` call on DOMContentLoaded (line 688) or keep it as a warm-up with the understanding it will remain suspended until first gesture.

---

# M-05 — No `bufferedAmount` backpressure check when sending audio

**Files:** `public/index.js:495-499` (Deepgram), `556-560` (AssemblyAI)

```js
microphone.startRecording((audioChunk) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(audioChunk);            // unconditional
  }
});
```

Audio is produced at a fixed real-time rate (32 KB/s of PCM at 16 kHz/16-bit). If the uplink degrades (weak cellular, congested Wi-Fi), the socket's internal send queue grows without bound because the sender never consults `ws.bufferedAmount`. For a 10-minute recording on a link that only passes half the bitrate, ~9-10 MB of PCM accumulates in memory; latency compounds (the transcript falls further behind), and on low-memory mobile devices the tab can be killed. There is also no cap-and-drain strategy (drop-oldest is acceptable for live transcription — the freshest audio matters most).

### Recommended fix (NOT APPLIED)

```js
const MAX_BUFFERED = 512 * 1024;   // ~0.5 MB ≈ 16s of PCM headroom

if (ws && ws.readyState === WebSocket.OPEN) {
  ws.send(audioChunk);
  if (ws.bufferedAmount > MAX_BUFFERED) {
    // Upstream saturated: signal degradation in the status pill; optionally
    // skip sends until bufferedAmount drains below half the cap.
    setStatusDegraded('Network slow — transcript may lag');
  }
}
```

---

# M-06 — Deepgram key fetched at page load for every visitor, cached forever

**Files:** `public/index.js:681-684` (fetch on load), `124-137` (cache)

```js
await Promise.all([
  TokenManager.fetchToken(),          // AssemblyAI token
  TokenManager.getDeepgramKey()       // full Deepgram master key
]);
```

Every visitor — including those who never record a single word with the Deepgram model — triggers a `/api/deepgram-key` function invocation and receives the master key into their browser (see C-02 for the exposure angle; this entry covers the behavioral angle):

- **Wasted invocations:** idle visitors consume Pages Functions quota.
- **Stale-forever cache:** `this.deepgramKey` is never invalidated. If the key is rotated server-side (which C-01/C-02 mandate), every already-open tab keeps sending the old key until reload, producing confusing auth failures (`onclose` 1006-style resets with no diagnostics, per H-04).
- **Needless blast radius:** the key sits in heap for the tab's lifetime, available to any injected script or extension scrape (mitigated only by not having the key client-side at all — the real fix).

### Recommended fix (NOT APPLIED)

Fetch on demand at Deepgram-session start (and ideally replace the key with a minted 30s grant token per C-02). If pre-warming is desired, invalidate after a TTL (e.g., 5 minutes) and re-fetch before each Deepgram connect.

---

# M-07 — "Fix Grammar" is enabled during live recording

**Files:** `public/index.html:110-113` (button — note `clearButton` is disabled during recording at `index.js:633-636`, but `grammarButton` is not), `public/index.js:318-356`

Sequence of the bug:

1. Recording is active; the live span shows an in-flight interim turn.
2. User clicks **Fix Grammar**. Client sends `messageEl.innerText` — which includes the *current interim text* — to `/api/grammar`.
3. Response arrives and executes:

```js
baseText = data.correctedText;
activeTurnText = "";
currentTurnOrder = null;
messageEl.innerText = baseText;      // wipes DOM, including #liveTurnSpan
```

4. The stream is still connected. The next `Turn` message arrives: `currentTurnOrder` was reset to `null`, so the incoming (old) turn's `turn_order` is compared against `null` — no commit is triggered — and `renderTranscript()` recreates the live span and appends the *raw, uncorrected, still-evolving* transcript right after the just-corrected text.

Result: a hybrid document where corrected text is immediately followed by a fresh, uncorrected duplicate continuation of the same turn (the interim that was baked into the grammar request continues evolving server-side). For Deepgram the effect is similar: the next interim recreates text that was already corrected-and-committed.

### Recommended fix (NOT APPLIED)

Simplest: disable `grammarButton` (and `downloadButton`, arguably) while `isRecording === true`, exactly like `clearButton`. Better UX: queue the fix and apply it at `stopRecording()` after the final result lands.

---

# M-08 — No AudioWorklet feature detection

**Files:** `public/index.js:183-210`

`startRecording()` awaits `audioContext.audioWorklet.addModule('audio-processor.js')` with no capability check. Browsers without `audioWorklet` (Safari ≤ 14.0, legacy Android WebView, some in-app webviews) reject the `addModule` promise *after* the WebSocket has already been opened in `onopen`'s async continuation — the UI transitions to "Recording", the mic indicator lights up, and no audio ever reaches the provider: a fully stuck state (user must click Stop; the mic-only path teardown happens correctly there).

### Recommended fix (NOT APPLIED)

Gate on load and at click time:

```js
function audioWorkletSupported() {
  return typeof AudioWorkletNode === 'function' &&
         (window.AudioContext?.prototype?.audioWorklet != null);
}
```

If unsupported, either fall back to a `ScriptProcessorNode` path (deprecated but universally available) or show "Live transcription requires a newer browser" before requesting mic permission.

---

# M-09 — `alert()` for runtime errors despite an existing toast system

**Files:** `public/index.js:467`, `537`, `584`, `592`

Four sites use blocking `window.alert()`:

- "Microphone permission denied…"
- "Failed to get authorization token. Please try again."
- "Session conflict (Too many concurrent sessions)…"
- "Error accessing microphone. Please check permissions."

The app already has a polished toast component (`showCopyFeedback`, `public/index.js:413-425`) — using `alert()` for these is inconsistent and hostile on mobile (alert blocks the audio pipeline interactions, dismisses keyboard state, and in some in-app browsers looks like a system crash dialog). Errors also can't be styled or queued.

### Recommended fix (NOT APPLIED)

Route through the toast with an error variant (existing `.copy-feedback` styling with a red dot), and reserve `alert` for nothing. Include actionable text: "Mic permission denied — click the 🔒 icon in the address bar to allow."

---

# M-10 — `end_of_turn` is ignored; run-on sentence risk on AssemblyAI

**File:** `public/index.js:563-574`

```js
if (msg.type === "Turn") {
  const { turn_order, transcript } = msg;
  if (currentTurnOrder !== null && turn_order !== currentTurnOrder) {
    commitActiveTurn();
  }
  ...
}
```

Turn boundaries are detected solely by `turn_order` changing. The AssemblyAI v3 protocol also provides `end_of_turn` / `end_of_turn_confidence` / `turn_is_formatted` fields (per the [streaming docs](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio)); the commit logic keys on `turn_order` alone, which works for *starting* a new turn but ignores the server's explicit end signal. Practical consequences:

- The final formatted version of a turn (`turn_is_formatted`) may not be distinguished from interim text; the committed text is whatever the last update happened to be.
- On stop, the dangling turn is committed by `stopRecording()` regardless of whether the server considered it complete — acceptable — but during streaming, if the provider re-uses a `turn_order` across a silence gap (behavior not under client control), commits silently fail to trigger, producing run-on paragraphs.

### Recommended fix (NOT APPLIED)

Also commit when `msg.end_of_turn === true` (after applying that message's transcript), and treat `turn_is_formatted` as the cue to replace the span content with final formatting.

---

# M-11 — Git/docs drift: referenced `icons.html` gallery doesn't exist

Commit `a28bca1` says: *"…and create 15 SVG icons + visual gallery at /icons.html"*. The current tree contains `svg_icons/` (16 SVGs) but **no `icons.html`** anywhere. Either the gallery was deleted without updating docs, or it was never committed. Anyone following the history to find the gallery hits a 404 (and on Cloudflare Pages, an unstyled default 404 — there is no custom `404.html` either).

Related drift: `README.md`'s architecture tree (lines 33-50) omits `server.js`, `tokenGenerator.js`, `package.json`, `.eslintrc.js`, and the `reports/` suite added by this audit; `CLOUDFLARE_DEPLOYMENT.md` repeats the same tree.

### Recommended fix (NOT APPLIED)

Re-add or delete `icons.html` deliberately; align both docs' trees with reality (this audit's `reports/` directory should also be listed once merged).

---

# M-12 — Whitespace-based word count

**File:** `public/index.js:254-261`

```js
const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
```

For English this is acceptable. But the app's own value proposition includes transcribing numbers, code identifiers, emails, and multilingual speakers; for any language without space delimiters (Hindi — which the git history shows was an actual problem: commit `bdf7b9c` "prevent unwanted Hindi switching" — Japanese, Chinese, Thai), the counter reports "1 word" for an entire paragraph. Since the product explicitly locks to English today, this is latent rather than active — but the counter also mis-counts hyphenated compounds, "e.g." vs "e. g." (which C-06's grammar pass actively creates!), and emoji-only utterances.

### Recommended fix (NOT APPLIED)

Use `Intl.Segmenter` where available (word granularity handles CJK and compound punctuation correctly), with the split as fallback:

```js
function countWords(text) {
  if (typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter('en', { granularity: 'word' });
    return [...seg.segment(text)].filter(s => s.isWordLike).length;
  }
  return text.split(/\s+/).filter(Boolean).length;
}
```

---

# M-13 — `beforeunload` cleanup misses mic and WebSocket

**File:** `public/index.js:701-707`

```js
window.addEventListener('beforeunload', () => {
  TokenManager.stopBackgroundRefresh();
  if (globalAudioContext) {
    globalAudioContext.close();
  }
});
```

The handler stops the token timer and closes the shared AudioContext, but does not: stop mic tracks, send `Terminate`/`CloseStream`, or close `ws`. On unload the browser tears these down anyway, so the user impact is minimal — but server-side, the provider session lingers until its own idle/keepalive timeout, which on metered concurrency (AssemblyAI free tier = **1 concurrent stream** per README) can block the user's next session start ("Session conflict (Too many concurrent sessions)" — the exact alert at `index.js:584`) for a brief window after closing a tab mid-recording.

### Recommended fix (NOT APPLIED)

In `beforeunload`, if `ws?.readyState === OPEN`, attempt `ws.send(JSON.stringify({type:'Terminate'}))` and `ws.close()` synchronously (send-then-close during unload is still delivered by major browsers); `navigator.sendBeacon` is not applicable to WS but the synchronous close handshake usually is.

---

# M-14 — Stop-during-CONNECTING silently swallows the connection attempt

**File:** `public/index.js:610-613`

```js
if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
  try { ws.close(); } catch (error) {}
}
```

This path is correct cleanup (closing a CONNECTING socket is legal), but combined with H-02's missing timeout, the observable behavior for a stuck connect + user-clicks-Stop is: status flips to "Ready", the connection attempt dies, and no error is ever surfaced — the user believes the provider is fine and retries, hitting the same black hole with zero diagnostic breadcrumbs. A `console.info('Connection attempt cancelled by user')` plus a first-failure toast ("Couldn't reach AssemblyAI — check your network") would make the retry loop legible. Tracked here because the fix belongs with H-02's timeout work.

---

## Not bugs, but noted during verification (positive findings)

- **Transcript rendering is XSS-safe**: all ASR text enters the DOM via `textContent`/`createTextNode`/`innerText` assignment only (`renderTranscript`, `commitActiveTurn`, `fixGrammar`). No `innerHTML` sink touches provider-controlled strings. The only `innerHTML` writes are the two hardcoded SVG icon swaps in `updateRecordingState` (`index.js:642-644`) with constant strings. ✅
- **Right-to-left replacement application** in `checkLanguageTool` (`grammar.js:87-96`) is the correct ordering technique — the flaw there is only the missing overlap check (H-09).
- **English lock** (`language_code=en`, `language=en`) is consistently applied on both providers (commit `bdf7b9c`), matching the README claim.
- **Model id `universal-3-5-pro` is genuine** — verified against AssemblyAI's current streaming docs; the "Universal-3.5 Pro" branding in the UI is accurate.

---

*Analysis only — no source files were modified. Master index: `reports/README.md`.*
