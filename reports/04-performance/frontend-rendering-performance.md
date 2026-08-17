# FRONTEND RENDERING PERFORMANCE — LumiNote v02

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Context:** The transcript editor is a `contenteditable` div that updates at streaming cadence (multiple interim frames per second of active speech) and simultaneously accepts user edits. Everything below runs on the **main thread**; there is no virtualization, no scheduling, and no debounce anywhere in `public/index.js`.

---

## INDEX

| ID | Finding | Severity (perf) | Location |
|---|---|---|---|
| P-01 | `updateStats()` reads `innerText` (forced layout) on every keystroke AND every interim frame | High | `public/index.js:254-261` |
| P-02 | `renderTranscript()` triple layout-reads per interim frame (`scrollHeight`/`clientHeight`/`scrollTop` + writes) | High | `public/index.js:310-315` |
| P-03 | `onEditorInput()` clones the entire editor DOM per keystroke just to strip one span | Medium | `public/index.js:241-252` |
| P-04 | `innerHTML` SVG replacement on every recording-state change (GC churn, reparse) | Low | `public/index.js:642-645` |
| P-05 | `spellcheck="true"` compounds mutation cost during streaming | Low-Med | `public/index.html:80` |
| P-06 | `anime()` runs an rAF loop target for state changes that don't need it; elastic easing on a 2-element timeline per state flip | Low | `public/index.js:664-669` |
| P-07 | No `requestAnimationFrame` batching of interim updates — layout work runs inside WS message handlers at message cadence | Medium | `public/index.js:502-520`, `563-574` |
| P-08 | Word count regex splits a growing string on every update — O(n) per frame, O(n²) cumulative over a long session | Medium | `public/index.js:255-257` |
| P-09 | Editor grows unboundedly; no virtualization strategy or segment pruning for hour-long dictation | Medium (scale) | design |
| P-10 | Positive: animation work is transform/opacity-composited; pulse animations run on compositor-friendly box-shadow (mixed) | Info | `styles.css` |

---

# P-01 — `innerText` reads force synchronous layout on every mutation

```js
function updateStats() {
  const fullText = messageEl.innerText.trim();    // forced layout #1
  const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
  const chars = fullText.length;
  ...
}
```

`innerText` is not a simple property read: because it depends on rendering (line breaks, visibility), reading it **flushes pending style/layout work synchronously** (a forced reflow). `updateStats()` is called from:

- `onEditorInput()` — every user keystroke (`index.js:251`);
- `renderTranscript()` — every interim frame while speech streams (`index.js:290`);
- `commitActiveTurn()`, `clearTranscription()`, `fixGrammar()`.

During active dictation the sequence per interim frame is: DOM write (`liveSpan.textContent = cleanTurn`) → read `innerText` (layout flush) → `scrollToBottomSmart`'s geometry reads (another flush point) → write (`scrollTop`). This is the textbook **layout thrash / read-write interleaving** pattern. On a 30-minute transcript with a large DOM (P-09), each flush is O(content); on low-end Android this manifests as the classic "transcript jitters while I talk".

**Fix sketch (NOT APPLIED):**
- Maintain `baseText` as a string (already tracked!) and compute stats from `baseText + activeTurnText` — no DOM reads at all:

```js
function updateStatsFromState() {
  const full = (baseText + ' ' + activeTurnText).trim();
  ...
}
```

- If DOM truth is preferred, use `textContent` (no layout dependency) or cache the text on mutation.

---

# P-02 — Geometry reads in the scroll helper per interim frame

```js
function scrollToBottomSmart() {
  const distanceFromBottom = messageEl.scrollHeight - messageEl.clientHeight - messageEl.scrollTop;
  if (...) messageEl.scrollTop = messageEl.scrollHeight;
}
```

Three layout-dependent reads + a write, invoked from every `renderTranscript()` (i.e., per interim). Combined with P-01 in the same handler, each interim frame does at least two forced layouts. Also note the semantic bug tracked as M-02 (the `|| activeElement !== messageEl` hijack).

**Fix sketch:** rAF-coalesce scroll decisions (check the distance once per frame, not per message — see P-07), and track "pinned to bottom" with a scroll listener maintaining a boolean instead of measuring each time:

```js
let pinned = true;
messageEl.addEventListener('scroll', () => {
  pinned = messageEl.scrollHeight - messageEl.clientHeight - messageEl.scrollTop < 120;
}, { passive: true });
// in render: if (pinned) messageEl.scrollTop = messageEl.scrollHeight;   // single write
```

---

# P-03 — Whole-DOM clone per keystroke

```js
function onEditorInput() {
  const liveSpan = document.getElementById('liveTurnSpan');
  if (liveSpan) {
    const clone = messageEl.cloneNode(true);          // deep clone of entire editor
    const tempLiveSpan = clone.querySelector('#liveTurnSpan');
    if (tempLiveSpan) tempLiveSpan.remove();
    baseText = clone.innerText;                        // + forced layout on the clone
  } else {
    baseText = messageEl.innerText;
  }
  updateStats();
}
```

Every keystroke (including each auto-correction mutation) deep-clones the whole editor — for an hour-long transcript that's cloning thousands of text nodes per keypress — then reads `innerText` on the clone. Purpose: compute "editor text minus live span".

**Fix sketch (NOT APPLIED):** the same result without clone or layout reads:

```js
function computeBaseText() {
  let t = '';
  for (const node of messageEl.childNodes) {
    if (node.id === 'liveTurnSpan') continue;
    t += node.textContent;
  }
  return t;
}
```

(`textContent` on text nodes is layout-free; the live span check replaces the clone+remove dance entirely.)

---

# P-04 — SVG reparse on state changes

```js
if (recording) {
  buttonIcon.innerHTML = `<svg ...>...</svg>`;
} else {
  buttonIcon.innerHTML = `<svg ...>...</svg>`;
}
```

Each `updateRecordingState` call reparses SVG markup and discards the previous subtree. Frequency: every start/stop/switch/status change — not hot-path, but the pattern also re-creates DOM that could be two pre-rendered `<svg>` children toggled via `hidden`. Cost is minor; noted because it also erodes the CSP posture (an `innerHTML` sink, albeit constant-string) and because the same two SVGs already exist in `index.html` (duplicated markup drift risk).

---

# P-05 — `spellcheck` during streaming

Every interim write mutates the editor; with `spellcheck="true"` the engine re-underlines the changed regions — and browsers differ in how surgical they are (Chrome historically re-checks sentence-adjacent text). Combined with P-01/P-03 keystroke cost, typing during recording is the app's heaviest interaction. Proposal (from L-17): `messageEl.spellcheck = false` while `isRecording`, restore on stop — one line, measurable win on long sessions.

---

# P-06 — Animation calls

`updateRecordingState` ends with:

```js
anime({
  targets: [recordButton, statusIndicator],
  scale: [0.95, 1],
  duration: 350,
  easing: 'easeOutElastic(1, .8)'
});
```

- `statusIndicator` scaling conflicts with its own `pulse-ring` keyframe animation (transform-driven both ways — the pulse animates `transform: scale(...)`, and anime will fight the compositor animation for the same property on the same element while recording).
- Elastic overshoot on a status pill is decorative; with `prefers-reduced-motion` unimplemented (A-05), this is also an accessibility gap.
- Positive note: all continuous animations (`pulse-ring`, `pulse-button`, `spin`) animate `transform`/`box-shadow` — `transform` is compositor-friendly; `box-shadow` is paint-heavy but bounded to tiny elements. `spin` on the grammar icon animates `transform: rotate` — good.

---

# P-07 — No frame-aligned scheduling of stream updates

WS `onmessage` handlers call `renderTranscript()` synchronously at message arrival cadence. Providers emit interim updates roughly every 100-300 ms of audio; a burst (e.g., Deepgram flushing several `is_final` results after an utterance) can deliver 5-10 messages within one frame — each paying the P-01/P-02 layout tax in sequence instead of once per painted frame.

**Fix sketch (NOT APPLIED):** coalesce via rAF:

```js
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderTranscript(); });
}
```

Latest-message-wins semantics are exactly right for interim text — only the most recent interim matters.

---

# P-08 — Word counting is O(n) per frame

`fullText.split(/\s+/).filter(Boolean)` allocates an array of every word in the document on every update (keystroke + interim). For a 5,000-word session that's 5,000 string allocations × ~3-5/sec ≈ 15-25k allocations/sec during speech, plus GC pressure on mobile. Combined with P-01's read, stats are the single most expensive routine in the hot path. Incremental counting (track counts per committed turn; re-count only the live span) reduces this to O(current turn).

---

# P-09 — Unbounded editor growth (scale analysis)

Nothing prunes or virtualizes the editor. Growth estimate for dictation at ~150 wpm:
- DOM text grows ~750 words / 5 min ≈ 4.5 KB text / 5 min → ~55 KB / hour (plus per-turn text nodes and (post-C-06-fix) potential per-turn spans).
- `contenteditable` layout cost grows superlinearly with paragraph length in some engines; the `white-space: pre-wrap` single-node design (all text in one block, no paragraphs) makes line-box layout O(total) per mutation in the worst case — visible as input lag beyond roughly the 1-hour/10k-word mark on mid-range hardware.
- Mitigation options (ranked by effort): (1) split committed turns into `<p>` elements (bounded line boxes per block); (2) collapse turns older than N into an offscreen buffer (copy/export still reads full text); (3) full virtualization — overkill for the use case.

---

# P-10 — Positive performance properties observed

- **AudioWorklet architecture** (vs deprecated `ScriptProcessorNode`): audio conversion off the main thread — correct modern choice.
- **16 kHz mono capture** — 32 KB/s upload, the minimum sensible for ASR; no wasteful 48 kHz shipping.
- **`preconnect` hints for Google Fonts** present (`index.html:9-10`).
- **CSS custom properties** centralize theme values — no expensive selector patterns (`:has` absent, descendant selectors shallow).
- **No framework, no bundler** — zero KB of runtime overhead beyond anime.js (~17 KB gz); TTI is dominated only by fonts + CDN script (see network report N-03).
- **Toast/status updates are class toggles** — no style recalcs beyond transitions.

---

## MEASURED-COST SUMMARY (analysis-derived estimates)

| Hot path event | Current cost drivers | After proposed fixes |
|---|---|---|
| Interim frame (per ~200 ms while speaking) | innerText flush ×1-2, geometry reads ×3, string split O(words), possible spellcheck pass | one `textContent` write + one rAF-batched scroll write; stats from state strings |
| Keystroke during recording | deep clone O(editor), innerText flush ×2, stats split | `computeBaseText` walk (text nodes only), no flush |
| Recording state flip | SVG reparse + elastic rAF timeline | pre-rendered icons toggled, reduced-motion-aware micro-transition |
| Model switch (current, buggy path) | + leaked pipeline CPU (see audio report P-11) | single pipeline (C-03 fix) |

---

*Analysis only — no source files were modified. Related: `audio-pipeline-performance.md`, `network-and-api-performance.md`. Master index: `reports/README.md`.*
