# RESPONSIVE & MOBILE REVIEW — LumiNote v02

- **Audit date:** 2026-08-16
- **Scope:** Viewport behavior (`public/styles.css`), the 100vh "viewport lock" architecture, touch ergonomics, mobile audio constraints, and the responsive breakpoints (900px / 600px).

---

## 1. THE VIEWPORT LOCK — INTENT vs MOBILE REALITY

```css
/* styles.css:38-42 */
html, body {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden; /* Lock viewport: NO outer page scrolling */
}
```

The design goal (per README: "Single-Window Viewport Lock: 100vh fixed desktop/mobile viewport with zero outer page scrollbars") is legitimate for an app-like tool, and the implementation is *architecturally* correct (flex column + `min-height: 0` on the scrollable editor — the hard part, done right).

**The problem:** `100vh` is the **large viewport** — it assumes browser chrome (URL bar, tab bar) is hidden. On mobile browsers where chrome is visible:

- iOS Safari: `100vh` = the viewport with the URL bar *collapsed*. With the bar visible (the default state after page load), `100vh` exceeds the visible height by ~60-100px. Since `overflow: hidden` forbids scrolling, the bottom of the page — the **record button row and footer** — is rendered *beneath the fold and unreachable* until the user scrolls (which collapses the bar, triggering a visible layout jump).
- Android Chrome: same class of issue with dynamic toolbars (behavior varies by scroll interaction; with `overflow:hidden` there is no scroll gesture to trigger collapse — the trap is self-reinforcing).
- Landscape phones: chrome takes proportionally more; the effect worsens.

**Fix (NOT APPLIED):** dynamic viewport units, supported in all modern engines since 2022-2023:

```css
html, body { height: 100dvh; max-height: 100dvh; }
/* with a fallback for older browsers: */
@supports not (height: 100dvh) { html, body { height: 100vh; } }
```

`dvh` tracks the *current* visible height, shrinking when toolbars appear. Apply everywhere `100vh` appears: `styles.css:39-41, 62-63`. For maximum stability during keyboard interactions see §3 (the editor's internal scroll + fixed chrome handles on-screen keyboards better than most layouts — the flex `min-height:0` architecture pays off here).

---

## 2. BREAKPOINT ANALYSIS

### 900px (`styles.css:608-635`)
- Controls column-reverse (record button on top, full width) ✅ — thumb-reachable, primary action emphasized.
- Utility buttons become a 2×2 grid ✅.
Sensible tablet/small-laptop arrangement.

### 600px (`styles.css:637-663`)
- Header stacks (logo row, then controls row full-width) ✅.
- Model switcher goes full-width; dropdown menu stretches edge-to-edge ✅ (commit `dfb7e03` did this deliberately).
- Status pill shares the row with the switcher — on very narrow devices (~320-360px) "Ready"/"Recording (AssemblyAI 3.5 Pro)" + dot + gap will overflow: `statusText` has `white-space: nowrap` on the *container* (`styles.css:278`) — the long model names (up to ~28 chars ≈ 200px at 0.8rem) plus the pill padding can exceed a 320px viewport minus the switcher. **Symptom: horizontal clipping of the status text inside a `overflow:hidden` body = invisible status.** Mitigation: allow the status text to truncate (`overflow: hidden; text-overflow: ellipsis; max-width: 45vw`) or shorten model labels on narrow viewports.

### Missing breakpoints
- **~1024-1200px (laptop)**: nothing needed — fluid max-width 1360 handles it ✅.
- **Landscape phones (height < 500px)**: untested territory — with the stacked header + editor header + stats + 2×2 grid + full-width record button, the editor can compress to near-zero height in landscape. A landscape media query (or `orientation: landscape and (max-height: 500px)`) collapsing the header rows would keep the editor usable.
- **Very large screens**: 1360px cap is a deliberate document width ✅.

---

## 3. ON-SCREEN KEYBOARD INTERACTION

When the mobile keyboard opens (user taps the editor to fix a word):
- The visual viewport shrinks; with `dvh` (post-fix) the layout adapts; today with `100vh` + `overflow:hidden`, iOS Safari keeps the layout viewport full-size and pans — the controls row can end up hidden behind the keyboard. The user's escape is the keyboard-dismiss affordance.
- The editor's internal scroll keeps the caret region visible (browsers auto-scroll focused contenteditable into the visual viewport) — mostly works ✅.
- Interaction with M-02's scroll hijack: with the editor focused, the hijack condition (`activeElement !== messageEl`) is false — good; but focus is lost the moment the user taps Stop (button click blurs the editor) → next interim yanks scroll to bottom while the keyboard is closing — visually jarring.

---

## 4. TOUCH ERGONOMICS

| Item | Assessment |
|---|---|
| Record button size | `padding: 0.65rem 1.85rem` at 0.975rem font ≈ 44-48px tall ✅ meets 44px minimums; full-width on ≤900px — excellent |
| Utility buttons | 0.85rem text + 0.55/0.95rem padding ≈ 38-40px — *slightly under* the 44-48px comfortable touch target; acceptable, note for polish |
| Model options | 0.65rem vertical padding ≈ 40px rows — acceptable; adjacent-gap 0.35rem is tight for fat-finger mis-taps (a mistap mid-recording triggers C-03's leak path!) |
| Hover-dependent affordances | `.logo:hover` rotate, button lifts — hover styles also fire on tap (sticky-hover) — cosmetic only |
| Double-tap zoom | No `touch-action` set; the record button receives rapid taps (start/stop) — mobile browsers' 300ms dblclick-zoom is mostly historical, but `touch-action: manipulation` on buttons removes residual delays on some devices |
| Pull-to-refresh | With `overflow: hidden` at the body, PTG gestures hit the *editor's* internal scroll — when the editor is at scrollTop 0 and the user pulls down, Chrome Android may trigger pull-to-refresh → **page reload → transcript loss** (compounding C-05!). `overscroll-behavior: contain` (or `none`) on `.transcription-output` is a one-line defense every text app should have |

**`overscroll-behavior` is the single most important mobile-hardening line missing from this codebase** given the no-persistence design.

---

## 5. MOBILE AUDIO & PERMISSIONS (behavioral)

- `getUserMedia` requires a secure context ✅ (pages.dev). On HTTP-local dev (`server.js` port 8000), mic access fails on mobile browsers — desktop-only for local dev (H-10 already flags local dev broadly).
- iOS Safari: AudioContext creation and `resume()` must occur in the same user-gesture call stack for reliable start — the current flow does reach `getAudioContext()` from the click handler (via `createMicrophone().startRecording`), but the eager DOMContentLoaded creation (M-04) leaves the context suspended and the un-awaited `resume()` can race the first quanta on iOS specifically (worst platform for this bug class).
- Backgrounding: on iOS, backgrounding the tab suspends AudioContext; returning can leave a suspended context with the WS alive (silence streamed). No `visibilitychange` handling exists. Recommended: on `visibilitychange → hidden` while recording, either keep capture (foreground-only reality on iOS) or offer pause; on `visible`, check `globalAudioContext.state` and `resume()` + flush `resetBuffer()`.
- Mobile CPU budget: the P-11 leak (3 switches = 4 pipelines) plus five backdrop-blur layers is thermal territory on mid-range phones — see P-11/design-system §7. The mobile user is the one who pays.

---

## 6. TEST MATRIX USED FOR THIS ANALYSIS (derived)

| Context | Risk found |
|---|---|
| iPhone Safari, portrait, bar visible | Record row below fold (§1) |
| iPhone Safari, keyboard open | Controls behind keyboard; jarring scroll on blur (§3) |
| Android Chrome, editor scrolled to top, pull down | Pull-to-refresh → data loss (§4) |
| 320-360px width | Status text clipped (§2) |
| Landscape phone | Editor collapses to unusable height (§2) |
| Backgrounded recording on iOS | Silence streamed, no recovery (§5) |

---

## 7. PRIORITIZED MOBILE FIXES (NOT APPLIED — ranked)

1. `100dvh` (+ `@supports` fallback) — unblocks the primary CTA on mobile Safari/Chrome.
2. `overscroll-behavior: contain` on the editor — closes the pull-to-refresh data-loss hole.
3. Status text truncation at narrow widths.
4. `touch-action: manipulation` on buttons.
5. `visibilitychange` handling for iOS backgrounding.
6. Landscape query for short viewports.
7. Touch-target bump on utility buttons (padding 0.65rem 1rem) and option rows (0.8rem).

---

*Analysis only — no source files were modified. Master index: `reports/README.md`.*
