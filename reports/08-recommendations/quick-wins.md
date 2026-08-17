# QUICK WINS — under 30 minutes each, ranked by value/effort

- **Audit date:** 2026-08-16 · Proposals only — none applied. Line references from commit `61bbfcb`.

---

## W-01 · Preconnect the streaming origins (2 lines, ~10 min)
**File:** `public/index.html` (head)
```html
<link rel="preconnect" href="https://api.deepgram.com">
<link rel="preconnect" href="https://streaming.assemblyai.com">
```
Shaves 1-3 RTT (≈100-300 ms) off session start on mobile — the product's core promise. (N-05)

## W-02 · `100dvh` viewport fix (~10 min)
**File:** `public/styles.css:39-41, 62-63`
```css
html, body { height: 100dvh; max-height: 100dvh; }
@supports not (height: 100dvh) { html, body { height: 100vh; max-height: 100vh; } }
```
Un-hides the record button under mobile browser toolbars. (responsive §1)

## W-03 · Overscroll containment (1 line)
**File:** `public/styles.css` (`.transcription-output`)
```css
overscroll-behavior: contain;
```
Kills pull-to-refresh-triggered transcript loss on Android. (responsive §4)

## W-04 · Stop mic on remote close (~15 min)
Route both `ws.onclose` handlers through one teardown that calls `microphone.stopRecording()`. (C-04)

## W-05 · Delete the token interval (~10 min)
Remove `startBackgroundRefresh`/`stopBackgroundRefresh` + the DOMContentLoaded call; call `getToken()` inside `startRecording()`. Saves ~72 wasted mints/hour/tab. (C-07)

## W-06 · AAI onmessage try/catch (~5 min)
Mirror the Deepgram guard at `index.js:563`. (H-03)

## W-07 · Live span non-editable (~5 min)
`liveSpan.contentEditable = 'false';` in `renderTranscript()` + CSS `user-select:none`. Ends silent edit destruction. (H-06)

## W-08 · Clamp + transfer in the worklet (~15 min)
The H-08/P-12/P-13 rewrite from the audio-processor file analysis — 24 lines total, fixes audio distortion *and* cuts allocations ~40×.

## W-09 · Guard anime calls (~5 min)
`const anim = (p) => window.anime && anime(p);` — 2 call sites. Ends false "Failed to copy" on CDN block. (M-03)

## W-10 · Emoji aria-hidden (~10 min)
Wrap 🧠🚀⚡ in `<span aria-hidden="true">` (3 options + JS label path). (A-06)

## W-11 · Reduced-motion media query (~10 min)
The C39 block from the accessibility audit — one size fits all animations. (A-05)

## W-12 · `:focus-visible` for the switcher (~5 min)
```css
.model-switcher-btn:focus-visible { outline: 2px solid var(--accent-purple); outline-offset: 2px; }
```
Replaces the bare `outline: none`. (A-03)

## W-13 · Meta description + OG + theme-color (~10 min)
4 lines in `<head>`; makes shares/search non-empty. (L-15)

## W-14 | Mode map consolidation (~20 min)
The `MODELS` const from M-01 — removes three duplicated name blocks and the model-name drift.

## W-15 · Spellcheck off while recording (~5 min)
`messageEl.spellcheck = false` in `updateRecordingState(true)`, restore on false. (L-17/P-05)

## W-16 · `wrangler.toml` prune + compatibility bump (~15 min)
Date bump + remove empty `[build]`/`[env]` blocks; verify with `wrangler pages dev`. (F-06)

## W-17 · `touch-action: manipulation` on buttons (~5 min)
One CSS rule — removes residual tap delay on some Android keyboards. (responsive §4)

## W-18 · Status text truncation (~5 min)
`#statusText { max-width: 45vw; overflow: hidden; text-overflow: ellipsis; }` — stops invisible-status clipping at 320 px. (responsive §2)

---

### The one-hour bundle
If you only have one hour: **W-01 + W-02 + W-03 + W-04 + W-06 + W-07** — two data-loss/mobile blockers, one privacy fix, one distortion fix, one crash guard. Everything else can wait for Phase 1.
