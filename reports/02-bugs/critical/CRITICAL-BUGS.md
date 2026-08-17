# CRITICAL BUGS — LumiNote v02 Full Audit

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Scope:** Every file in the repository was read line-by-line. Nothing was modified.
- **Severity model:** CRITICAL = data loss, security breach, financial loss, or core-feature breakage that any normal user can trigger.

---

## INDEX OF CRITICAL BUGS

| ID | Title | Primary Location | One-line summary |
|---|---|---|---|
| C-01 | Live Deepgram API key committed to git AND served publicly | `functions/api/deepgram-key.js:13`, `public/index.js:136` | A real-looking 40-hex Deepgram secret is hardcoded in the repo and returned by a CORS-open endpoint |
| C-02 | `/api/deepgram-key` hands the full master key to any browser | `functions/api/deepgram-key.js:15` | Raw provider key exposed instead of a short-lived token — full account takeover of the Deepgram plan |
| C-03 | Live model switch leaks the old microphone pipeline and double-streams audio | `public/index.js:37-84` + `455-457` | Old MediaStream + AudioWorklet are never stopped; two pipelines interleave PCM into the new WebSocket |
| C-04 | Mic keeps recording (privacy) after a server-side WebSocket close | `public/index.js:528-531`, `582-587` | `onclose` only updates UI; `stopRecording()` is never called — the browser mic indicator stays on |
| C-05 | Logo click wipes the entire transcript with no confirmation | `public/index.html:18` | `onclick="window.location.reload()"` destroys all user text instantly |
| C-06 | Grammar engine corrupts legitimate text (deletes "like", collapses valid repeats, breaks "Node.js"/"e.g.") | `functions/api/grammar.js:106-141` | Rule pipeline rewrites "index.js" → "index. js", deletes the word "like" everywhere, collapses valid repeats |
| C-07 | Token one-time-use + 50-second background refresh burns the AssemblyAI quota | `public/index.js:139-143` + `functions/api/token.js:34-42` | Tokens are single-session per provider docs; ~72 wasted token generations/hour per open tab |

Each bug below contains: exact location, code excerpt, root cause, impact, reproduction steps, evidence from external docs (where relevant), and a concrete recommended fix with code. **No fixes were applied — this is analysis only.**

---

# C-01 — Live Deepgram API key committed to git AND served publicly

**Severity:** CRITICAL (secrets exposure)
**Files:**
- `functions/api/deepgram-key.js:13`
- `public/index.js:136` (client-side fallback)

### Evidence — server side

```js
// functions/api/deepgram-key.js (lines 12-15)
const DEEPGRAM_API_KEY = context.env.DEEPGRAM_API_KEY || "2b2fe3bc8ae482b82b218201b9c15c40a9fcba4e";

return new Response(JSON.stringify({ key: DEEPGRAM_API_KEY }), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  }
});
```

### Evidence — client side

```js
// public/index.js (lines 124-137)
async getDeepgramKey() {
  if (this.deepgramKey) return this.deepgramKey;
  try {
    const res = await fetch("/api/deepgram-key");
    const data = await res.json();
    if (data.key) {
      this.deepgramKey = data.key;           // cached for the tab's lifetime — see M-08
      return data.key;
    }
  } catch (e) {
    console.warn("⚠️ Failed to fetch Deepgram key from endpoint, using fallback.");
  }
  return "2b2fe3bc8ae482b82b218201b9c15c40a9fcba4e";
},
```

### Root cause

The key was hardcoded as a "fallback" so the app still works when the Cloudflare environment variable is not configured. That fallback value is a syntactically valid Deepgram API key (40 hex characters, matching Deepgram's key format) and it appears **twice** in the source tree — once server-side and once client-side — meaning it is shipped to every visitor's browser bundle and is additionally embedded in the full git history.

### Impact

1. **Anyone in the world** can read this key from the public GitHub repository (branch `cloudflare-v02` is pushed to `origin`).
2. Anyone can simply open DevTools on the live deployment (`https://luminote-v2.pages.dev`) and read the key from the fallback string, or call `GET /api/deepgram-key` and receive it in JSON.
3. With the key, an attacker gets full access to the Deepgram project: streaming transcription, pre-recorded audio, project settings, key management (depending on key permissions). Deepgram free-tier credits ($200) and any billing attached to the key can be drained.
4. Removing the key from the current commit is **not enough** — it remains recoverable from git history forever unless history is rewritten or the key is rotated.

### Reproduction (no tools needed)

1. Open the deployed site, open DevTools → Sources → `index.js`, search for `2b2fe3`.
2. Or: `curl https://luminote-v2.pages.dev/api/deepgram-key` → `{"key":"..."}` with `Access-Control-Allow-Origin: *`.

### Recommended fix (NOT APPLIED — recommendation only)

**Step 1 — rotate the key immediately in the Deepgram console.** This is the only complete remedy.

**Step 2 — remove the fallbacks:**

```js
// functions/api/deepgram-key.js — corrected pattern
export async function onRequest(context) {
  const DEEPGRAM_API_KEY = context.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: 'Deepgram not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  // ... mint a short-lived grant token instead — see C-02
}
```

```js
// public/index.js — corrected pattern: no hardcoded secret, fail loudly
async getDeepgramKey() {
  if (this.deepgramKey) return this.deepgramKey;
  const res = await fetch("/api/deepgram-key");
  const data = await res.json();
  if (!res.ok || !data.key) throw new Error("Deepgram key unavailable");
  this.deepgramKey = data.key;
  return data.key;
}
```

**Step 3 — scrub history** (`git filter-repo` or BFG) **after rotation**, or treat rotation alone as sufficient.

### External reference

Deepgram's own guidance is that API keys must stay server-side and that browsers should receive only short-lived grant tokens minted by `POST /v1/auth/token` (30-second TTL JWT, `usage::write` scope). Sources: [Token-Based Auth guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication), [Grant token API reference](https://developers.deepgram.com/reference/auth/tokens/grant), [Creating API keys](https://developers.deepgram.com/docs/create-additional-api-keys).

---

# C-02 — `/api/deepgram-key` hands the full master key to any browser

**Severity:** CRITICAL (architecture-level credential exposure)
**File:** `functions/api/deepgram-key.js` (whole file)

### Description

Even if the hardcoded fallback key in C-01 is removed and replaced with a proper environment variable, this endpoint's **design** is wrong: it returns the *full, long-lived master API key* to any caller, with `Access-Control-Allow-Origin: *`, no rate limiting, no authentication, and no referer check:

```js
return new Response(JSON.stringify({ key: DEEPGRAM_API_KEY }), {   // line 15
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',    // any origin may fetch this
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  }
});
```

Contrast with the AssemblyAI flow in the same app (`functions/api/token.js`), which correctly mints a **temporary token** server-side and only returns that. The Deepgram path skipped the equivalent mechanism.

### Impact

- The endpoint is a free key-vending machine: `curl https://luminote-v2.pages.dev/api/deepgram-key` returns the master key to anyone, from any origin, with no auth.
- Because the response is CORS `*`, *other people's websites* can silently fetch the key from a visitor's browser (any logged-in visitor to any malicious page) — no exploit chain needed beyond one HTTP call.
- Deepgram bills per usage — a stolen key means direct financial loss.

### Root cause

Deepgram's browser authentication is commonly demonstrated with `wss://api.deepgram.com/v1/listen` + the raw key via the `token` WebSocket subprotocol (which is exactly what `public/index.js:482` does). Copying that demo pattern verbatim moved the master key into the browser. Deepgram provides a proper temporary-token flow for exactly this case, but it was not used.

### Recommended fix (NOT APPLIED)

Convert the endpoint to a token minter and drop the raw key entirely:

```js
// functions/api/deepgram-key.js — recommended shape
export async function onRequest(context) {
  const KEY = context.env.DEEPGRAM_API_KEY;
  if (!KEY) return new Response(JSON.stringify({ error: 'not configured' }), { status: 500 });

  // Deepgram grant token: 30s TTL JWT, scope usage::write
  const res = await fetch('https://api.deepgram.com/v1/auth/token', {
    method: 'POST',
    headers: { 'Authorization': `Token ${KEY}` },
  });
  if (!res.ok) return new Response(JSON.stringify({ error: 'token mint failed' }), { status: 502 });

  const data = await res.json();
  return new Response(JSON.stringify({ token: data.token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

And on the client, connect with the ephemeral token (same subprotocol mechanism):

```js
ws = new WebSocket(dgUrl, ['token', dgTempToken]);
```

Notes on the 30-second TTL: Deepgram's documented behavior is that the token is validated at **connection time**, and an already-open WebSocket stays alive after token expiry — so a 30s token is sufficient for a streaming session started immediately. If sessions may start later than ~30s after minting, mint on demand at `startRecording()` time (recommended — it also pairs correctly with the one-time-use nature of these tokens).

Also remove `Access-Control-Allow-Origin: *` (same-origin app does not need CORS on these endpoints at all — see S-03 in the security report).

### External reference

- [Deepgram Token-Based Authentication](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) — temporary tokens, 30s TTL.
- [Deepgram JS SDK note](https://github.com/deepgram/deepgram-js-sdk) — REST calls (incl. grant) must be proxied server-side due to CORS; WS may consume the token directly.

---

# C-03 — Live model switch leaks the old microphone pipeline and double-streams audio

**Severity:** CRITICAL (core feature corruption + resource leak)
**Files:** `public/index.js:54-83` (`selectCustomModel`), `public/index.js:455-457` (`startRecording`)

### Evidence — the switch path

```js
// public/index.js (lines 54-83)
if (isRecording) {
  console.log(`🔄 Live switching active stream to ${selectedModel}...`);
  if (microphone && microphone.resetBuffer) {
    microphone.resetBuffer();          // only flushes the sample queue
  }
  ...
  if (ws) {
    ... ws.close(); ...
    ws = null;
  }

  setTimeout(async () => {
    await startRecording();            // 300ms later, fresh session
  }, 300);
}
```

### Evidence — why the old pipeline survives

```js
// public/index.js (lines 455-457)
async function startRecording() {
  try {
    microphone = createMicrophone();   // <-- module-level `microphone` is OVERWRITTEN
```

`selectCustomModel` never calls `microphone.stopRecording()`. It only calls `resetBuffer()` (which clears an `Int16Array` queue). Then `startRecording()` immediately **overwrites** the module-level `microphone` reference with a brand-new closure. The previous closure — which owns:

- an active `MediaStream` from `getUserMedia` (mic hardware in use),
- its own `MediaStreamAudioSourceNode`,
- its own `AudioWorkletNode` with `port.onmessage` still attached,

— becomes unreachable **but is still wired into the live audio graph and still firing `onmessage`**. Its callback closure reads the *module-level* `ws`:

```js
// public/index.js (lines 495-499) — the OLD callback, still running
microphone.startRecording((audioChunk) => {
  if (ws && ws.readyState === WebSocket.OPEN) {   // `ws` is module-level!
    ws.send(audioChunk);
  }
});
```

### What actually happens after a live switch

1. Old worklet keeps producing 100ms PCM chunks. Its callback sends them to the **new** WebSocket (module-level `ws` now points at the new session).
2. New microphone's worklet ALSO produces 100ms PCM chunks from a **second** `getUserMedia` stream, sending them to the same new WebSocket.
3. The new ASR session receives interleaved audio from two pipelines capturing the same microphone. For AssemblyAI/Deepgram this manifests as words repeated, words dropped, garbled decoding, or the server discarding the stream as corrupt.
4. Every additional switch adds another leaked pipeline (2 switches = 3 streams).

### Secondary effects

- The browser tab shows the recording indicator even after "Stop" because the leaked streams' tracks are never `stop()`-ed (their owning closure is unreachable).
- Two AudioWorklets + two MediaStreamSources run continuously — measurable CPU/battery cost on laptops and phones.
- The leaked pipeline also keeps growing its internal `audioBufferQueue` merge operations if the callback stops matching the buffer drain cadence.

### Reproduction

1. Start recording with the default model. Speak: "testing one two three".
2. While still recording, switch model to "Deepgram Nova-3".
3. Keep speaking. Observe duplicated/garbled words in the transcript, and the OS mic indicator never clearing even after Stop.
4. DevTools → Console shows only one "Connected" log, but Performance/CPU usage stays elevated; `navigator.mediaDevices.enumerateDevices()`-level inspection (or simply the tab's recording pill) confirms a live capture.

### Recommended fix (NOT APPLIED)

Tear down the old microphone before scheduling the restart:

```js
// inside selectCustomModel, before the setTimeout:
if (microphone) {
  microphone.stopRecording();   // stops tracks, disconnects nodes, clears callback
  microphone = null;
}
```

and harden `stopRecording()` inside the microphone object so it is idempotent (safe to call twice). Additionally, guard against rapid double-switches (see H-04) and null-check inside the worklet callback:

```js
microphone.startRecording((audioChunk) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(audioChunk);
});
// ...and when tearing down: audioWorkletNode.port.onmessage = null;  (already done in stopRecording)
```

The cleanest structural fix: pass the `ws` (or a send function) into `startRecording` as a parameter instead of reading the module-level variable, so an orphaned pipeline has no live socket to write to.

---

# C-04 — Mic keeps recording (privacy) after a server-side WebSocket close

**Severity:** CRITICAL (privacy)
**Files:** `public/index.js:528-531` (Deepgram onclose), `public/index.js:582-587` (AssemblyAI onclose)

### Evidence

```js
// Deepgram branch
ws.onclose = () => {
  console.log("Deepgram WebSocket closed");
  updateRecordingState(false, false);      // UI only — mic NOT stopped
};

// AssemblyAI branch
ws.onclose = (evt) => {
  if (evt.code === 1008) {
    alert("Session conflict (Too many concurrent sessions)...");
  }
  updateRecordingState(false, false);      // UI only — mic NOT stopped
};
```

`updateRecordingState(false)` flips `isRecording`, resets the button and status pill. It does **not** touch `microphone`. The microphone is only ever stopped in the user-initiated `stopRecording()` path (`public/index.js:616-619`).

### When this fires

- Provider closes the socket mid-session: token/auth expiry, server-side max session duration reached (AssemblyAI v3 sessions have a bounded duration), network interruption after TCP gives up, load-balancer idle timeout, error codes 1011/1006/4008/1008, etc.
- On AssemblyAI v3, when the server ends the session it sends a `Termination` message and closes — the client treats this exactly like a normal close, leaving the mic on.

### Impact

- The user sees "Ready" and believes capture has stopped, while the microphone keeps capturing at the OS level (tab recording indicator, Chrome's mic pill, macOS orange dot). This is a genuine privacy problem, not a cosmetic one: audio continues to be captured into the worklet (it is merely not sent anywhere once `ws` is null/closed).
- Battery/CPU drain continues silently.
- If the user later clicks "Start Recording", `startRecording()` runs `microphone = createMicrophone()` again — if the old reference was not nulled (it is not, on this path), the previous pipeline leaks exactly as in C-03.

### Recommended fix (NOT APPLIED)

Route *all* teardown — user-initiated or remote — through one function:

```js
function handleStreamEnded(unexpected = false) {
  if (microphone) { microphone.stopRecording(); microphone = null; }
  commitActiveTurn();
  currentTurnOrder = null;
  ws = null;
  updateRecordingState(false, false, unexpected ? "Connection lost" : null);
}

// in both onclose handlers:
ws.onclose = () => handleStreamEnded(true);
```

Optionally show a reconnect affordance (`"Connection lost — tap to resume"`) rather than silently resetting.

---

# C-05 — Logo click wipes the entire transcript with no confirmation

**Severity:** CRITICAL (user data loss)
**File:** `public/index.html:18`

### Evidence

```html
<div class="logo" onclick="window.location.reload()" title="Refresh LumiNote">
```

Commit `b3c9cdf` ("feat: Add click handler to logo for instant page refresh") introduced this deliberately. There is no `beforeunload` guard that checks for unsaved content — the only `beforeunload` handler (`public/index.js:701-707`) cleans up timers and closes the AudioContext; it never calls `preventDefault()`.

### Impact

- A transcript is pure client-side state: `baseText` / DOM only, never persisted (no localStorage, no autosave). Reload = permanent loss.
- Logos are the most-clicked element on any page by convention ("go home"/"refresh"). Users habitually click the logo mid-session; each such click destroys all dictated text instantly, with zero warning and zero recovery.
- The hover state (`styles.css:89-92` scale + opacity) actively signals clickability, making accidental activation more likely.
- Touch users on mobile are especially prone to hitting it (it sits in the top-left corner of the header).

### Recommended fix (NOT APPLIED)

Any or all of the following, in increasing order of safety:

1. Remove the click handler entirely (safest; a logo that does nothing is standard).
2. If refresh-on-logo is truly desired, confirm when content exists:

```js
document.querySelector('.logo').addEventListener('click', () => {
  if (messageEl.innerText.trim() && !confirm('Discard the current transcript?')) return;
  window.location.reload();
});
```

3. Add a `beforeunload` guard while text is non-empty:

```js
window.addEventListener('beforeunload', (e) => {
  if (messageEl.innerText.trim()) { e.preventDefault(); e.returnValue = ''; }
});
```

4. Pair with autosave (localStorage on `input`, debounced) so that even a reload does not lose text — see the recommendations roadmap (R-12).

---

# C-06 — Grammar engine corrupts legitimate text

**Severity:** CRITICAL (silent data corruption of user text)
**File:** `functions/api/grammar.js:106-141` (`cleanSpokenEnglish`)

This "cleanup" pipeline runs unconditionally over the **entire transcript** after LanguageTool processing, and several of its regexes are destructive on perfectly normal English.

### Evidence with concrete failure cases

**(a) Filler-word regex deletes meaningful words — line 110**

```js
s = s.replace(/\b(uh|um|er|ah|like|you know|i mean|sort of|kind of)\b,?\s*/gi, ' ');
```

| Input | Output | Why it's wrong |
|---|---|---|
| "I **like** pizza" | "I pizza" | "like" is a verb, deleted |
| "Sort **of** course we went" / "a sort **of** crisis" | mangled | "sort of" deleted even when grammatical |
| "He is 40, **er**, I mean 50" — okay | — | but "I mean" deletion also kills emphasis: "And I mean it." → "And it." |

The alternation is applied globally and case-insensitively with no part-of-speech awareness, so any sentence containing "like", "you know", "i mean", "kind of" is silently rewritten. For a dictation app whose users will say "like" constantly *as a real word* ("I like this design"), this is a data-integrity bug, not a style choice.

**(b) Duplicate-word collapse removes valid English — line 113**

```js
s = s.replace(/\b(\w+)\s+\1\b/gi, '$1');
```

| Input | Output | Why it's wrong |
|---|---|---|
| "I **had had** enough" | "I had enough" | "had had" (past perfect) is correct English |
| "that that particular case" | "that particular case" | legal construction |
| "She looked very very tired" — arguably fine to collapse | "very tired" | style, acceptable |

Because the flag is `gi`, "Had had" also collapses.

**(c) Punctuation spacing breaks letter-after-dot sequences — line 128**

```js
s = s.replace(/([.,?!])([A-Za-z])/g, '$1 $2');
```

The character class `[A-Za-z]` means a digit follower is exempt (so `3.14` and `9.99` survive ✅), but **any letter following a period/comma gets a space injected**:

| Input | Output |
|---|---|
| "Open index.js" | "Open index. js" |
| "Visit node.dev" | "Visit node. dev" |
| "e.g. that" | "e. g. that" |
| "J.R.R. Tolkien" | "J. R. R. Tolkien" |
| "Node.js" | "Node. js" |
| "2.1alpha" → `.` followed by `1` | safe (digit) — but "v1.beta" breaks |

Dictated filenames, domains, URLs with letter paths, initials, and abbreviations are the casualties — common content for a dictation tool. There is **no undo** after grammar fix (it overwrites `baseText`), so the corruption is permanent for the session.

**(d) README's flagship example doesn't match the code — lines 123 / README.md:85**

README claims:

> fixes subject-verb agreement (*"me and him is"* → *"He and I are"*)

Actual rule:

```js
s = s.replace(/\bme and (\w+) (is|are|was|were|go|want)\b/gi, '$1 and I $2');
```

- "me and him is" → **"him and I is"** (case not fixed, verb not fixed).
- The transformation also fires on quoted/deliberately informal text.

**(e) Capitalization rule damages mid-sentence words — line 131**

```js
s = s.replace(/\bi\b/g, 'I');
```

Correct for English, but combined with (a) deletions it can strand fragments; and `text.replace(/\bi\b/)` runs three passes of regex over the whole document each request (minor perf note, tracked in P-14).

### Impact

Single-click "Fix Grammar" is advertised as polish; it currently **loses and corrupts user content** in common cases (any sentence with "like", any decimal). Since the corrected text replaces the editor contents and `baseText` wholesale (`public/index.js:338-346`), and there is no history/undo beyond the contenteditable's native undo stack (which `innerText =` assignment breaks — see H-09), the corruption is effectively irreversible.

### Recommended fix (NOT APPLIED)

- Gate the destructive rules behind an explicit "spoken cleanup" toggle (UI checkbox), default **off**.
- For filler removal, only strip when between commas or at phrase boundaries: `\b(?:uh+|um+|erm+|er|ah|hmm+)\b[,.]?\s*` — i.e., pure hesitation tokens, not "like"/"you know"/"i mean".
- For duplicate collapse, whitelist known-valid doubles (`had`, `that`, `very` is fine to keep collapsing or not — decide) or require the repeat be flagged by LanguageTool instead.
- Replace (c) with a negative lookahead/lookbehind for digits and known safe sequences:

```js
s = s.replace(/([.,?!])([A-Za-z])(?<!\d\.[a-z])/g, '$1 $2');  // illustrative — see note
// Simpler robust version: only add space when preceded by end-of-word context:
s = s.replace(/([.?!])([A-Z][a-z])/g, '$1 $2');               // sentence boundary heuristic
```

(The lookahead version still mishandles "Node.js"; the sentence-case heuristic is safer because decimals are followed by digits, and "Node.js" by lowercase.)
- Fix (d) to produce "X and I <verb>" with verb correction via a small map (`is→are`, `was→were` for plural subjects; pronoun case map `him→he`, `them→they`).
- Before overwriting the editor, keep the pre-fix text for one-shot undo: store `lastBeforeGrammarFix` and offer an "Undo fix" toast (see R-14).

---

# C-07 — Token one-time-use + 50-second background refresh burns the AssemblyAI quota

**Severity:** CRITICAL (quota/financial waste, rate-limit outages)
**Files:** `public/index.js:93-151` (`TokenManager`), `functions/api/token.js:34-42`

### Evidence — client refresh cadence

```js
isValid() {
  if (!this.token || !this.tokenTimestamp) return false;
  const age = (Date.now() - this.tokenTimestamp) / 1000;
  return age < 55;                        // token considered stale after 55s
},
...
startBackgroundRefresh() {
  this.refreshInterval = setInterval(() => {
    this.fetchToken();                    // unconditional — ignores isValid()
  }, 50000);
},
```

### Evidence — server mints 10-minute tokens

```js
// functions/api/token.js (lines 34-35)
const expiresInSeconds = 600; // 10 minutes
const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;
```

### Why this is worse than "just wasteful"

Per AssemblyAI's documentation for the temporary-token endpoint ([Authenticate with a temporary token](https://www.assemblyai.com/docs/streaming/authenticate-with-a-temporary-token)):

- A token generated with `expires_in_seconds=600` lives **10 minutes**.
- **Each token has a one-time-use restriction and can only be used for a single session.**

Consequences:

1. The 50-second interval fetches a fresh token ~72 times/hour per open tab, while at most **one** of them will ever be used (the one that exists when the user clicks Start). The other ~71 are minted and abandoned — one-time-use means they cannot be banked.
2. Each mint is: 1 Cloudflare Pages Function invocation + 1 upstream AssemblyAI token API call. AssemblyAI's free tier is capacity-constrained on concurrent streams (README itself says 1 concurrent stream for AssemblyAI models); needless token generation risks provider-side throttling of the account.
3. `isValid()`'s 55-second window contradicts the 600-second lifetime — the two constants were presumably tuned by different bugs at different times. Because `fetchToken()` in the interval ignores `isValid()` anyway, the 55s check only affects the *first* `getToken()` after page load.
4. If the token endpoint ever fails during the interval (network blip), `fetchToken()` silently returns null and `this.token` keeps its previous value — actually benign, but only by accident (the error path doesn't clear state; see H-02 for the related stuck-state bug).

### Impact quantification

| Scenario | Token mints/day | Necessary mints/day |
|---|---|---|
| 10 idle open tabs for an 8h workday | 10 × 8 × 72 ≈ **5,760** | ≈ number of recording sessions (typically < 100) |
| 1 tab left open overnight (16h) | ≈ **1,152** | 0 |

### Recommended fix (NOT APPLIED)

- Delete `startBackgroundRefresh` entirely. Mint a token **on demand at session start** (`startRecording()`), which also matches the one-time-use semantics; optionally mint the next one during `Terminate` handling if back-to-back sessions are common.
- If pre-warming is kept for first-click latency, refresh at ≤ 9-minute cadence (for 600s tokens) and stop refreshing while recording (the token of an open WS is irrelevant).
- Surface token-mint failures as user-visible status instead of `console.error` only.

```js
// recommended shape
async function ensureFreshToken() {
  if (TokenManager.isValid()) return TokenManager.token;
  const t = await TokenManager.fetchToken();
  if (!t) throw new Error('token-unavailable');
  return t;
}
// call inside startRecording() right before constructing the WebSocket
```

---

## CROSS-REFERENCE TABLE

| Bug | Feeds into | Detailed in |
|---|---|---|
| C-01 hardcoded key | C-02 exposure design | `03-security/secrets-exposure-analysis.md` |
| C-03 leaked pipeline | C-04 mic-stays-on; H-04 race | `04-performance/audio-pipeline-performance.md` (P-05) |
| C-06 grammar corruption | H-09 undo destroyed | `01-codebase-analysis/file-by-file/08-functions-api-grammar-js.md` |
| C-07 token churn | S-05 cost exposure | `04-performance/network-and-api-performance.md` (P-09) |

---

*Report generated as part of the LumiNote full audit. Analysis only — the working tree was not modified. See `reports/README.md` for the complete report index.*
