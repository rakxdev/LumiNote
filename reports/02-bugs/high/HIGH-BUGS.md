# HIGH-SEVERITY BUGS — LumiNote v02 Full Audit

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Severity model:** HIGH = features that fail under realistic conditions, corrupt data, or break the development/deployment workflow — but are not direct credential exposure or guaranteed-every-load breakage (those are CRITICAL).

---

## INDEX

| ID | Title | Primary Location |
|---|---|---|
| H-01 | Live model-switch races: rapid re-switch duplicates sessions; Stop during the 300 ms window resurrects recording | `public/index.js:80-83` |
| H-02 | No connection timeout — record button can stay permanently disabled if the WS never opens | `public/index.js:438-453` |
| H-03 | AssemblyAI `onmessage` has no try/catch (Deepgram branch does) — one malformed frame throws | `public/index.js:563-574` |
| H-04 | Server-sent session events (`Begin`, `Termination`, `Metadata`, `UtteranceEnd`, errors) are silently ignored | `public/index.js:563-587` |
| H-05 | Stop path closes the WebSocket immediately after `Terminate`/`CloseStream` — final result never arrives | `public/index.js:598-614` |
| H-06 | User keystrokes typed into the live interim span are silently destroyed by the next interim update | `public/index.js:264-291` |
| H-07 | `fixGrammar` replaces the editor via `innerText =` — native undo (Ctrl+Z) and caret are destroyed | `public/index.js:338-346` |
| H-08 | Int16 PCM conversion lacks clamping — loud input wraps around and produces loud distortion | `public/audio-processor.js:14-16` |
| H-09 | LanguageTool limits (20 KB/request, 20 req/min/IP) are unhandled — grammar silently no-ops on long transcripts | `functions/api/grammar.js:63-103` |
| H-10 | Local dev server (`yarn serve`) does not implement `/api/*` — the app is broken when run locally | `server.js` |
| H-11 | Editor placeholder disappears after manual select-all + delete (`:empty` vs the `<br>` contenteditable leaves behind) | `public/styles.css:405-411` |

---

# H-01 — Live model-switch races

**File:** `public/index.js:80-83` (inside `selectCustomModel`)

```js
setTimeout(async () => {
  await startRecording();
}, 300);
```

### Race A — Stop during the switch window

Timeline:

1. User is recording and picks a new model. `selectCustomModel` closes the old WS and schedules `startRecording()` at T+300 ms. UI shows "Switching to …".
2. At T+150 ms the user changes their mind and clicks **Stop Recording**. `toggleRecording()` sees `isRecording === true` (it was kept true by `updateRecordingState(true, true, ...)` at line 64), so it calls `stopRecording()`: microphone stopped, `ws` null, UI → "Ready".
3. At T+300 ms the pending timer fires `startRecording()` unconditionally. Recording starts again — new `getUserMedia` prompt-free capture, new WS session — while the user believes everything is stopped. Status flips back to "Recording" with no user action.

The user can only regain control by clicking Stop a second time. On browsers where the mic indicator is subtle, the user may simply not notice the tab is recording again (ties into the privacy impact of C-04).

### Race B — Rapid double model switch

1. Switch from model A → B: timer 1 scheduled.
2. Within the 300 ms window, switch B → C: `selectCustomModel` runs again. At this point `isRecording` is still `true` (UI state was set to recording-ish "Switching…"), so it flushes buffers, closes `ws` (already null from the first switch — the `if (ws)` guard handles that), and schedules timer 2.
3. Both timers fire `startRecording()` back-to-back. Each call performs `microphone = createMicrophone()` + a fresh `getUserMedia` + a fresh WebSocket. The first session leaks exactly as described in C-03, and the two sessions race to write into the same editor through `renderTranscript()`/`commitActiveTurn()`.

There is no token/sequence guard, no cancellation of the pending timer, and no mutex on `startRecording`.

### Recommended fix (NOT APPLIED)

```js
let pendingSwitch = null;   // module level

function scheduleRestart() {
  if (pendingSwitch) clearTimeout(pendingSwitch);
  pendingSwitch = setTimeout(async () => {
    pendingSwitch = null;
    if (!switchIntentActive) return;      // user cancelled by pressing Stop
    await startRecording();
  }, 300);
}
```

`stopRecording()` must set `switchIntentActive = false` and clear `pendingSwitch`; `selectCustomModel` sets it `true`. `startRecording()` should additionally refuse to run if `isRecording` is already true and no switch is in flight (idempotency guard).

---

# H-02 — No connection timeout: record button can stay permanently disabled

**File:** `public/index.js:438-453` (`toggleRecording`), `455-596` (`startRecording`)

```js
async function toggleRecording() {
  if (recordButton.disabled) return;
  if (isRecording) {
    recordButton.disabled = true;        // (a) stop path
    stopRecording();
  } else {
    recordButton.disabled = true;        // (b) start path — disabled BEFORE connecting
    ...
    await startRecording();
  }
}
```

Re-enabling happens only in: `ws.onopen` (line 493/554), `ws.onerror` (526/579), the outer `catch` (594), or the early-return paths that call `updateRecordingState(false)` (which force-enables at lines 629-631).

**Failure mode:** a `new WebSocket(...)` can remain in `CONNECTING` for a long time (e.g., blackholed network, provider accepting TCP then stalling the upgrade, aggressive mobile NAT). `onopen`, `onerror`, and `onclose` may each take tens of seconds to fire — or, in the worst cellular cases, only fire on page unload. Until one of them fires, the button is disabled and the status pill says "Connecting (…)…" forever. The user has no cancel affordance; the only recovery is a page reload — which, per C-05, also destroys the transcript.

### Recommended fix (NOT APPLIED)

```js
const CONNECT_TIMEOUT_MS = 10000;

function withConnectionTimeout(ws, onTimeout) {
  const t = setTimeout(() => {
    if (ws.readyState === WebSocket.CONNECTING) {
      try { ws.close(); } catch (e) {}
      onTimeout();
    }
  }, CONNECT_TIMEOUT_MS);
  ws.addEventListener('open', () => clearTimeout(t));
  ws.addEventListener('close', () => clearTimeout(t));
}
```

Call it right after both `new WebSocket(...)` constructions; on timeout, surface "Could not reach the transcription service" and re-enable the button. A Cancel affordance during Connecting is the UX-level equivalent.

---

# H-03 — AssemblyAI `onmessage` has no try/catch

**Files:** `public/index.js:563-574` (AssemblyAI) vs `502-520` (Deepgram)

```js
// Deepgram — defensive
ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    ...
  } catch (e) {
    console.error("Deepgram message parse error:", e);
  }
};

// AssemblyAI — no guard
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);    // throws on any non-JSON frame
  if (msg.type === "Turn") { ... }
};
```

If the server (or an intermediary proxy) ever delivers a non-JSON or empty-frame payload, `JSON.parse` throws inside the event handler. The exception propagates as an unhandled error event: this frame is lost (fine), but more importantly any state logic after the parse line never runs for that message, and error noise obscures the real cause in diagnostics. WebSocket message handlers that can throw should be wrapped identically in both branches; the asymmetry shows the guard was an afterthought.

Also note the AssemblyAI branch silently ignores every non-`Turn` type (see H-04).

### Recommended fix (NOT APPLIED)

Wrap in try/catch mirroring the Deepgram branch, and log `event.data?.slice?.(0, 200)` on failure for diagnosability.

---

# H-04 — Server-sent session events are silently ignored

**Files:** `public/index.js:563-574`, `502-520`

Per the AssemblyAI Streaming v3 message protocol (verified against [Transcribe streaming audio](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio)), a session receives at least:

| Message | Meaning | Current handling |
|---|---|---|
| `Begin` | Session opened; includes `id` and **`expires_at`** | ignored |
| `Turn` | Interim/final transcript deltas | handled |
| `Termination` | Server ended the session; includes `audio_duration_seconds`, `session_duration_seconds` | **ignored** |
| error payloads | auth failures, throttling, invalid params | **ignored** |

Deepgram equivalents ignored as well: `Metadata` (session id), `UtteranceEnd`, and `{"type":"Error", ...}` results.

### Concrete failure

When the provider ends the session — max session duration reached, account throttled, or audio-format error — it sends `Termination`/an error and closes. The client's `onclose` then does `updateRecordingState(false,false)` (see C-04: microphone stays on). The user's experience: the transcript simply **stops growing** while they keep talking. Nothing explains why, and the mic pill stays lit. If the reason was "session duration limit", the fix (auto-restart a new session) is trivially implementable on `Termination` — but only if the message is read.

`Begin.expires_at` could also drive a countdown/automatic session rollover before the hard cutoff — currently unused.

### Recommended fix (NOT APPLIED)

```js
ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case 'Begin':       sessionExpiresAt = msg.expires_at; break;
      case 'Turn':        /* existing logic */ break;
      case 'Termination': handleSessionEnded('Session ended by server'); break;
      default:
        if (msg.type === 'Error' || msg.error) handleSessionEnded(msg.message || 'Stream error');
    }
  } catch (e) { console.error('AASAI message error:', e); }
};
```

`handleSessionEnded` should stop the mic (fixing C-04 for this path) and show a reconnect affordance.

---

# H-05 — Stop path never waits for the final transcript

**File:** `public/index.js:598-624` (`stopRecording`)

```js
if (ws) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ...
      ws.send(JSON.stringify({ type: "Terminate" }));   // or CloseStream for Deepgram
    } catch (error) {}
  }
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    try { ws.close(); } catch (error) {}                // closed IMMEDIATELY
  }
  ws = null;
}
```

AssemblyAI's documented close semantics: after sending `Terminate`, the client should **keep the connection open briefly to receive the last final transcript** (the server finalizes the open turn, then replies with `Termination`). Deepgram behaves the same way after `CloseStream` — final `is_final` results are flushed before the socket closes.

By calling `ws.close()` on the very next line, LumiNote guarantees that whatever the ASR had **not yet emitted as an interim update is lost**, and even the emitted interim is never upgraded to its final, `smart_format`-ed form (punctuation, casing, number formatting). `commitActiveTurn()` (line 621) then freezes the *last interim* text as permanent transcript.

**User-visible symptom:** the last phrase of every recording — typically the last 0.3–1.5 seconds of speech — is missing or appears with raw formatting ("i will call you tomorrow" without the final period/capitalization the final result would have carried).

### Recommended fix (NOT APPLIED)

Graceful close with bounded wait:

```js
async function stopRecording() {
  const finalize = new Promise((resolve) => {
    ws.addEventListener('message', (ev) => {
      try { if (JSON.parse(ev.data).type === 'Termination') resolve(); } catch (e) {}
    });
    ws.addEventListener('close', () => resolve());
  });
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'Terminate' }));
  await Promise.race([finalize, new Promise(r => setTimeout(r, 1500))]); // cap the wait
  try { ws?.close(); } catch (e) {}
  ...
}
```

(Deepgram: wait for the post-`CloseStream` final `Results` or socket close, same race with a ~1s cap.)

---

# H-06 — Edits typed into the live interim span are silently destroyed

**Files:** `public/index.js:264-291` (`renderTranscript`), `241-252` (`onEditorInput`)

The live turn is a dedicated `<span id="liveTurnSpan" class="live-turn">` appended to the editor, rendered in purple with a dashed underline — it looks exactly like editable text (it is: the whole editor is `contenteditable`). On every interim update:

```js
liveSpan.textContent = cleanTurn;    // line 282 — wholesale replacement
```

Any characters the user typed **inside that span** between two interim frames (roughly 100–400 ms apart while actively speaking) are silently overwritten. The same applies to deletions. There is no guard such as `liveSpan.setAttribute('contenteditable','false')`, no advisory styling change, and no attempt to merge user edits with the incoming text.

Compounding it, `onEditorInput` computes `baseText` by cloning the editor and stripping the live span — so a user typing *into* the span produces a `baseText` that excludes their own keystrokes; if the stream then idles (no new interim for that turn), the user's edits exist only inside a span that the next `renderTranscript()` will clobber.

### Recommended fix (NOT APPLIED)

- Make the live span non-editable so the caret cannot enter it:
  - `liveSpan.contentEditable = 'false';` (works in all modern engines), plus
  - `live-span { user-select: none; cursor: default; }` styling and a tooltip "Live text — edit after the turn completes".
- Alternatively (higher effort): keep it editable but diff-merge user input against the incoming interim (this is what commercial live captions do); given the app's scope, the `contenteditable=false` approach is the right cost/benefit.

---

# H-07 — `fixGrammar` destroys native undo and the caret

**File:** `public/index.js:338-346`

```js
if (data.correctedText) {
  baseText = data.correctedText;
  activeTurnText = "";
  currentTurnOrder = null;
  messageEl.innerText = baseText;       // wholesale DOM replacement
  ...
}
```

Two consequences:

1. **Undo is gone.** `innerText` assignment is not part of the contenteditable's transaction stack in Chromium/Firefox — after it, Ctrl+Z either does nothing or undoes a pre-fix keystroke. Combined with C-06 (the grammar pipeline corrupting decimals and deleting "like"), the user has no way back. The advertised flow "✨ Fix Grammar" is one-way.
2. **Caret/selection is lost.** Any selection or cursor position collapses to nowhere; if the user had selected text mid-edit, it silently vanishes from the selection model.

### Recommended fix (NOT APPLIED)

- Preserve a snapshot before replacing, and expose an "Undo" action in the success toast for N seconds:

```js
const previous = { text: messageEl.innerText, base: baseText };
messageEl.innerText = baseText;
showCopyFeedback('✨ Grammar polished — click to undo', () => {
  baseText = previous.base;
  messageEl.innerText = previous.text;
});
```

- Longer term, apply corrections via targeted DOM edits (or `document.execCommand('insertText')`-style transactions which remain undoable) rather than whole-element replacement.

---

# H-08 — Int16 conversion lacks clamping → distortion on loud input

**File:** `public/audio-processor.js:12-18`

```js
const float32Array = Float32Array.from(channelData)
const int16Array = Int16Array.from(
  float32Array.map((n) => n * MAX_16BIT_INT)
)
```

`TypedArray.from` performs **ToInteger + wrapping** on out-of-range values — it does **not** saturate. `Int16Array` stores `(value + 65536) % 65536` interpreted as signed two's complement:

- Input sample `1.0` → `32767` ✔ (exactly at the rail)
- Input `1.5` (common when the mic/AGC overshoots, or the user shouts) → `49150` → wraps to `49150 - 65536 = -16386` → a **full-scale negative** sample instead of `+32767`.

Perceptually this is a loud click/crackle on every clipped sample — precisely during emphatic dictation ("the number is **SIXTY FOUR**"). Sustained clipping sounds like a broken raspy version of the word, and ASR accuracy on those frames degrades because the waveform presented to the model is not merely loud — it's sign-inverted garbage.

### Recommended fix (NOT APPLIED)

Saturate instead of wrap (and avoid the triple allocation while at it):

```js
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channelData = input[0];
    const int16 = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));   // clamp to [-1, 1]
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this.port.postMessage({ audio_data: int16.buffer });
    return true;
  }
}
```

(Asymmetric scaling `-32768 / +32767` is the standard convention; see P-06 in the performance report for the allocation discussion.)

---

# H-09 — LanguageTool limits unhandled → grammar silently no-ops

**File:** `functions/api/grammar.js:63-103` (`checkLanguageTool`)

Verified limits of the free public API ([LanguageTool API docs](https://languagetool.org/http-api/), [public API page](https://dev.languagetool.org/public-http-api.html)):

| Limit | Free tier value | Consequence for LumiNote |
|---|---|---|
| Text length per request | **20,000 characters** | Longer transcripts → HTTP error → `if (!res.ok) return text;` → user silently gets the original text back with a "✨ Grammar polished!" success toast (client can't tell — see `public/index.js:338-348`, any non-empty `correctedText` triggers success, and `corrected === rawText` still returns success) |
| Requests per minute per IP | **20** | The call is made **server-side from Cloudflare Pages Functions** — all users share Cloudflare egress IPs. A handful of simultaneous users exhausts the quota for everyone; responses become 429 → silent no-op again |
| Characters per minute per IP | 75,000 | A few long transcripts per minute hit this cap across shared IPs |
| Misspelled-word suggestions cap | 30 | Long texts get incomplete suggestions even when accepted |

Additionally `checkLanguageTool` applies replacements using only `match.replacements[0]` and applies them back-to-front after sorting — overlapping matches (LanguageTool flags them freely) can splice the string into garbage at the overlap. There is no `offset` sanity check (e.g., skipping matches whose range intersects the previous applied one).

### Recommended fix (NOT APPLIED)

- Chunk text to ≤ 20,000 chars per call (paragraph-aware), aggregating matches with per-chunk offset adjustment.
- Treat `429`/`!res.ok` as a *distinct* outcome: return `{ correctedText: text, degraded: true }` and have the client show "Grammar service busy — text unchanged" instead of a fake success.
- Track applied match ranges and skip overlaps.
- For scale: self-host LanguageTool (open source) or use the paid API — removes the shared-IP throttle entirely (see roadmap R-09).

---

# H-10 — Local dev server doesn't implement `/api/*` — the app is broken locally

**Files:** `server.js` (whole file), `package.json` (`"serve": "node server.js"`)

`server.js` serves `public/` statically and exposes exactly one route:

```js
app.get("/token", async (req, res) => { ... });   // note: /token, not /api/token
```

The frontend calls:

- `GET /api/token` (`public/index.js:101`) → 404 (express has no such route; also no /token match since paths differ)
- `GET /api/deepgram-key` (`public/index.js:127`) → 404 → **falls back to the hardcoded key** (C-01) — which "works", masking the gap
- `POST /api/grammar` (`public/index.js:330`) → 404 → `res.json()` parses the HTML 404 body → throws → "Failed to process grammar"

So `yarn serve` produces an app where AssemblyAI recording is impossible ("Failed to get authorization token. Please try again." alert), grammar always fails, and Deepgram only functions because of the leaked key. The README's Getting Started section never mentions running `wrangler pages dev`, which is the tool that *would* wire `functions/api/*` correctly.

### Recommended fix (NOT APPLIED)

Either retire `server.js`/`tokenGenerator.js` (the Cloudflare Functions supersede them — see M-16) and document:

```bash
npx wrangler pages dev public --compatibility-date=2024-01-01
# plus local secrets: npx wrangler pages secret put ... / .dev.vars file
```

or proxy the missing routes in `server.js`:

```js
app.get(['/api/token', '/token'], async (req, res) => { ...same logic... });
```

A `.dev.vars` file (gitignored) with `ASSEMBLYAI_API_KEY` / `DEEPGRAM_API_KEY` pairs with `wrangler pages dev`.

---

# H-11 — Placeholder disappears after manual select-all + delete

**Files:** `public/styles.css:405-411`, `public/index.html:80`

```css
.transcription-output[contenteditable="true"]:empty::before {
  content: attr(data-placeholder);
  ...
}
```

The `:empty` pseudo-class matches elements with **no child nodes at all** — not even whitespace text nodes or `<br>`. The programmatic clear path (`clearTranscription` sets `messageEl.innerText = ""`) happens to leave the element empty, so the placeholder returns there. But the *manual* path — user selects all and hits Backspace/Delete (the most common way to clear an editor) — leaves a residual `<br>` in Chromium and WebKit (and sometimes an empty text node in Firefox). With a child present, `:empty` no longer matches and the placeholder silently disappears for the rest of the session, leaving an intimidating blank box with only the HTML `data-placeholder` attribute (invisible) as a hint.

### Recommended fix (NOT APPLIED)

Use the modern, purpose-built pseudo-class which tolerates whitespace/`<br>`:

```css
.transcription-output:has(> br:only-child):empty, /* keep old rule */
.transcription-output:placeholder-shown { ... }
```

Simplest robust variant supported since 2023+ in all engines:

```css
.transcription-output:empty::before,
.transcription-output:has(> br:only-child)::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  font-style: italic;
}
```

Alternatively normalize in JS on input: if `innerText.trim() === ''` then `messageEl.innerHTML = ''` (drops the stray `<br>`), restoring `:empty` semantics.

---

## Related findings tracked elsewhere

- Mic-stays-on after remote close → **C-04** (critical report).
- Double-streaming after model switch → **C-03** (critical report).
- Grammar corruption rules → **C-06** (critical report).
- CDN failure turning successful copies into "Failed to copy" → **M-04** (medium report).
- `innerText` read on every keystroke (layout thrash) → **P-03** (performance report).

---

*Analysis only — no source files were modified. Master index: `reports/README.md`.*
