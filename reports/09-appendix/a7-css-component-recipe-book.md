# APPENDIX G — CSS Component Recipe Book

- Purpose: every component in `styles.css` restated as a maintainable recipe (token-consistent, with the fixes from the audit folded in). Reference for the design-system roadmap; nothing applied.

---

## G.1 MODERN RESET (replaces reset.css + `*{}` — L-03)

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; }
p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
```

## G.2 TOKEN SCALE ADDITIONS (design-system §10)

```css
:root {
  /* spacing */
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
  --space-4: 1rem;    --space-5: 1.5rem; --space-6: 2rem;
  --space-7: 3rem;
  /* type */
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-base: 1rem;
  --text-lg: 1.125rem; --text-xl: 1.25rem; --text-2xl: 1.5rem; --text-3xl: 2rem;
  /* z-layers */
  --z-base: 0; --z-dropdown: 30; --z-toast: 60; --z-modal: 90;
  /* motion */
  --dur-fast: 150ms; --dur-base: 250ms; --dur-slow: 350ms;
  --ease-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  /* alpha steps for glass tints */
  --accent-purple-a10: rgba(139, 92, 246, 0.10);
  --accent-purple-a20: rgba(139, 92, 246, 0.20);
  --accent-purple-a35: rgba(139, 92, 246, 0.35);
}
```

## G.3 VIEWPORT SHELL (responsive §1 fix)

```css
html, body {
  height: 100dvh; max-height: 100dvh; overflow: hidden;
}
@supports not (height: 100dvh) {
  html, body { height: 100vh; max-height: 100vh; }
}
.container {
  height: 100%;            /* inherits the dvh chain */
  max-height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.transcription-interface { flex: 1; min-height: 0; }   /* keep the critical flex rule */
```

## G.4 EDITOR (P-01/P-02/M-02/H-11/FIXES folded)

```css
.transcription-output {
  /* ...existing visual rules... */
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain;            /* responsive §4 */
  scrollbar-width: thin; scrollbar-color: var(--accent-purple) transparent;
}
.transcription-output::-webkit-scrollbar { width: 8px; }
.transcription-output::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.4); border-radius: 9999px;
}
/* placeholder robust to stray <br> (H-11) */
.transcription-output:empty::before,
.transcription-output:has(> br:only-child)::before {
  content: attr(data-placeholder);
  color: var(--text-muted); pointer-events: none; font-style: italic;
}
```

## G.5 LIVE TURN (H-06 fix)

```css
.live-turn {
  color: #a78bfa;
  border-bottom: 2px dashed rgba(167, 139, 250, 0.5);
  user-select: none;        /* caret cannot settle inside */
  cursor: default;
  pointer-events: none;     /* defense in depth; JS sets contentEditable=false too */
}
```

## G.6 FOCUS VISIBLE (A-03 fix)

```css
:focus-visible { outline: 2px solid var(--accent-purple); outline-offset: 2px; }
.model-switcher-btn:focus:not(:focus-visible) { outline: none; }
/* default focus ring is retained for all other controls */
```

## G.7 REDUCED MOTION (A-05 fix, C39)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## G.8 RECORD BUTTON CONTRAST (A-11 — gradient floor)

```css
.record-button {
  background: linear-gradient(135deg, #7c3aed 0%, #db2777 55%, #0891b2 100%);
  /* darker stops: white text keeps ≥4.5:1 across the full width */
}
```

## G.9 MOBILE STATUS TRUNCATION (responsive §2)

```css
#statusText { max-width: 45vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

## G.10 TOUCH TARGETS (responsive §4)

```css
button { touch-action: manipulation; }
.control-button { padding: 0.65rem 1rem; min-height: 44px; }
.model-option { padding: 0.8rem 0.85rem; min-height: 44px; }
```

## G.11 SAFE-AREA DOCK (D-10 direction)

```css
.controls { padding-bottom: env(safe-area-inset-bottom, 0px); }
```

## G.12 TRANSITION LISTS (L-04)

```css
/* replace every `transition: all …` with explicit lists, e.g.: */
.model-switcher-btn { transition: background-color var(--dur-base) var(--ease-out),
                                     border-color var(--dur-base) var(--ease-out),
                                     box-shadow var(--dur-base) var(--ease-out),
                                     transform var(--dur-base) var(--ease-out); }
```

---

*Appendix to the LumiNote audit. Reference CSS only — nothing applied. Master index: `reports/README.md`.*