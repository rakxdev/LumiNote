# ACCESSIBILITY AUDIT (WCAG 2.2) — LumiNote v02

- **Audit date:** 2026-08-16
- **Standard applied:** WCAG 2.2 (Level A/AA focus, noting AAA where trivially attainable), informed by W3C techniques including [Understanding SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) and [Technique C39 (prefers-reduced-motion)](https://www.w3.org/WAI/WCAG22/Techniques/css/C39), and [MDN's prefers-reduced-motion reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).
- **Method:** Static audit of `public/index.html`, `public/styles.css`, `public/index.js` — DOM semantics, name/role/value, keyboard paths, contrast (computed), motion, and live-region behavior.

---

## SUMMARY

| Area | Status |
|---|---|
| Keyboard operability | 🟡 Partial — one hard blocker (dropdown), several gaps |
| Screen reader semantics | 🔴 Multiple failures (live regions, dropdown, buttons) |
| Contrast | 🟢 Mostly passing (two borderline cases) |
| Motion / vestibular | 🔴 No reduced-motion support at all |
| Focus visibility | 🟡 Editor has a ring; buttons rely on defaults; one `outline: none` with no replacement |
| Forms/media alt text | 🟢 Images minimal and labeled |
| Overall estimate | **Does not meet WCAG 2.2 AA** in current form; ~6 focused fixes would clear the major failures |

---

## FINDINGS

### A-01 · No live region for the transcript — screen readers get nothing from the core feature
**Level:** A failure (SC 4.1.3 Status Messages / effectively 1.1.1 for the product's primary output)
**Location:** `public/index.html:80`, `public/index.js:264-307`

The transcript — the entire point of the application — is a plain `contenteditable` div. As interim and final text stream in, a screen reader user receives no announcement: contenteditable regions announce edits the *user* makes, not programmatic mutations. The status pill's state changes (`statusText`) are likewise not in a live region.

**Fix (NOT APPLIED):**
```html
<div id="message" ... aria-label="Transcript editor" role="textbox" aria-multiline="true"></div>
<p id="statusText" aria-live="polite"></p>
<!-- plus a visually-hidden mirror announcing committed turns: -->
<span class="sr-only" aria-live="polite" id="turnAnnouncer"></span>
```
…with `turnAnnouncer.textContent = committedText` on `commitActiveTurn()`. (Announce finals, not interims — interim chatter at 4 Hz is unusable.)

### A-02 · Status communicated by color alone
**Level:** AA concern (SC 1.4.1 Use of Color)
**Location:** `public/styles.css:281-298`

The status dot's gray/green/red conveys state; the adjacent text ("Ready"/"Recording") does disambiguate for sighted users — the failure is really A-01 (the text isn't announced). Shape reinforcement (idle: hollow ring; recording: filled + pulse; connected: checkmark) would also help color-blind users at a glance.

### A-03 · `outline: none` on the model switcher with no replacement
**Level:** AA failure (SC 2.4.7 Focus Visible)
**Location:** `public/styles.css:167`

```css
.model-switcher-btn { ... outline: none; }
```
No `:focus-visible` style replaces it — keyboard users lose the focus indicator entirely on this control.

**Fix:** `outline: none` → `:focus:not(:focus-visible) { outline: none }` and `:focus-visible { outline: 2px solid var(--accent-purple); outline-offset: 2px; }`.

### A-04 · Dropdown is not keyboard-operable and lacks ARIA
**Level:** A failure (SC 2.1.1 Keyboard)
**Location:** `public/index.html:26-60`, `public/index.js:24-35`

The custom switcher is div-based (`model-option` divs with `onclick`). With a keyboard: the trigger button focuses, Enter/Space open it (via click simulation), but:
- Options are divs — not focusable, not announced as options (`role="option"`/`listbox` absent).
- Arrow keys don't move between options; Enter doesn't select (only the synthesized click works if focus were on them — it isn't).
- Esc doesn't close; no `aria-expanded` on the trigger; no `aria-selected` on options.
- Tab order skips the options entirely → **keyboard users cannot change models**.

**Fix (NOT APPLIED):** standard listbox pattern — `role="listbox"` on the menu, `role="option"` + `tabindex="-1"` + `aria-selected` on options, `aria-haspopup="listbox" aria-expanded` on the trigger, arrow/Home/End/Esc/Enter handling, focus management on open/close. (Or replace with a styled native `<select>` — the glassmorphism can wrap it; native semantics for free.)

### A-05 · No `prefers-reduced-motion` support
**Level:** AAA under 2.1, expected AA-grade best practice; WCAG technique C39
**Location:** entire `styles.css` (no media query present)

Two infinite animations (`pulse-ring` 1.5s forever on the status dot; `pulse-button` 2s forever on the record button — both involve expanding box-shadow rings), plus spring/elastic transitions, run unconditionally. Users with vestibular disorders get permanently animating UI while the app's core state is "recording".

**Fix (NOT APPLIED):**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
…and gate the `anime()` calls in JS (`window.matchMedia('(prefers-reduced-motion: reduce)').matches`), replacing the elastic scale with an instant state change.

### A-06 · Emoji used as meaningful icons without `aria-hidden`/labels
**Level:** AA concern (SC 1.4.1 / 4.1.2)
**Location:** `public/index.html:28,33-57`

Model options use 🧠/🚀/⚡ as identifiers ("🧠 AssemblyAI Universal-3.5 Pro"); screen readers announce them variously ("brain", "rocket", "high voltage" — inconsistent across engines) interleaved with the label. The selected-model button text also embeds the emoji. Decorative here (the text carries meaning): wrap or strip — `<span aria-hidden="true">🧠</span>` in static HTML; for the JS-updated label, set `textContent` without emoji or use two spans.

### A-07 · Icon-only semantics rely on `title`
**Level:** AA concern (SC 4.1.2 Name, Role, Value)
**Location:** all utility buttons (`public/index.html:97-113`)

Buttons have visible text labels (good) *and* `title` duplicating them (harmless). The record button pairs icon + text ✅. The `title`-only pattern flagged in L-20 would fail if any future icon-only buttons appear; current text labels keep this at "concern".

### A-08 · Placeholder as sole instruction
**Level:** Best-practice concern (SC 3.3.2 Labels or Instructions — borderline pass)
**Location:** `public/index.html:80`

`data-placeholder="Start recording or type your text here... You can edit any word while live transcribing!"` disappears on first keystroke — including the instruction that live editing is possible. The fact that the app *edits around* an active stream is non-obvious; a first-run hint bubble (dismissable) or persistent help affordance is more durable than placeholder text. Also: placeholder italic gray `--text-muted` at `1.025rem` passes contrast (≈4.6:1) but the italic + small delta from body size is a legibility squeeze.

### A-09 · Lang attribute and page title
✅ `lang="en"` present, `<title>` descriptive. Missing: `aria-label` on the `<main>`-less layout — actually `<main class="transcription-interface">` exists ✅; `<header>`/`<footer>` landmarks present ✅. Landmark structure is genuinely fine.

### A-10 · Recording control is a toggle without state semantics
**Level:** AA concern (SC 4.1.2)
**Location:** `public/index.html:116-121`, `public/index.js:626-670`

The button's accessible name ("Start Recording"/"Stop Recording") does update via `buttonText.textContent` ✅ — the state is in the name, which works. Cleaner: `aria-pressed` toggle semantics or keep name-swapping (current approach is acceptable). The disabled-during-connect states are announced ✅ (native `disabled`).

### A-11 · Contrast borderline cases
From the design-system computations: `.option-desc` (#64748b at 0.7rem on #121620) ≈4.3:1 — just below the 4.5:1 AA threshold for normal text; the record button's gradient-cyan end ≈3.2-4.5:1 range for white text. Fixes: `--text-muted` → `#7c8ba1`-ish for small text contexts, or bump size/weight; darken gradient terminal stop (see design-system §10.6).

### A-12 · Audio content has no text alternative — N/A (the app *produces* the text alternative; inherently accessible output) ✅
The product itself is an accessibility tool for Deaf/hard-of-hearing meeting contexts — which makes the input-side gaps (A-01, A-04) more consequential, not less: the audience most served by live transcription disproportionately includes assistive-tech users.

---

## KEYBOARD WALKTHROUGH (traced)

| Control | Reachable | Operable | Notes |
|---|---|---|---|
| Logo (div) | Tab? No — it's a `div` with onclick, **not in tab order**, not keyboard-clickable | ❌ | Ironically the one destructive control is the one keyboards *can't* reach |
| Model switcher trigger | ✅ (button) | Open: ✅; choose: ❌ (A-04) | Esc/close: ❌ |
| Status | static | — | not announced (A-01) |
| Editor | ✅ | ✅ typing | focus ring custom ✅ |
| Clear/Copy/Export/Grammar | ✅ | ✅ | focus-visible default retained (no outline:none) ✅ |
| Record button | ✅ | ✅ | name updates with state ✅ |
| Toast | appears | n/a | not announced (add `role="status"`) |

**Priority fix order:** A-01 (live regions) → A-04 (dropdown keyboard) → A-05 (reduced motion) → A-03 (focus ring) → A-06 (emoji) → A-11 (contrast pair).

---

*Analysis only — no source files were modified. Master index: `reports/README.md`.*
