# FILE ANALYSIS — `public/index.html` (133 lines)

- **Role:** The single page: document shell, font/meta wiring, the complete application UI (header/model switcher/editor/controls/footer), and script loading.
- **Structure quality:** Landmark-complete (`header`, `main`, `footer`), lean DOM (~60 elements), inline SVGs for all iconography (no image requests except fonts/logo).

---

## HEAD ANALYSIS (lines 1-14)

| Line | Element | Assessment |
|---|---|---|
| 2 | `<html lang="en" data-theme="dark">` | `lang` ✅ a11y-critical; `data-theme` dead hook (L-01) |
| 4 | charset UTF-8 ✅ first-child correct position | |
| 5 | `X-UA-Compatible` | obsolete (L-06) |
| 6 | viewport `width=device-width, initial-scale=1.0` | ✅ standard; no `viewport-fit=cover` — needed for `env(safe-area-inset-*)` use on notched phones (relevant to D-10 proposal; currently unused so no impact) |
| 7 | `<title>LumiNote \| Real-Time Speech Intelligence</title>` | ✅ descriptive |
| 8 | SVG favicon | only icon format (L-16) |
| 9-11 | Fonts: preconnect ×2 + stylesheet | preconnect ✅; render-blocking sheet (N-03); 11 weights (L-18); `display=swap` ✅ |
| 12-13 | `reset.css` then `styles.css` | correct cascade order ✅; both render-blocking (normal, small) |

**Missing from head:** meta description, Open Graph/Twitter, `theme-color` (dark chrome address bar), canonical (L-15); any `<noscript>` story (see below).

---

## BODY STRUCTURE (lines 15-132)

### Header (17-66)

- **Logo div (18-24):** `onclick="window.location.reload()"` + `title` — C-05's data-loss trap; also a `<div>` acting as a button (not focusable/operable — A-11's keyboard table). Contents: `logo.svg` with alt ✅ + wordmark span + version badge `v02` (nice release signaling).
- **Model switcher (26-60):** custom dropdown — button trigger ✅ (real `<button type="button">` ✅), div options ❌ a11y (A-04); `id`s present for JS; checkmark SVGs per option (visible via `.active` class ✅); emoji icons (A-06); descriptions per option ✅ (H-6 recognition). The three `data-value`s: `universal-3-5-pro` (active/default per commit `80c015a`), `deepgram-nova-3`, `universal-streaming-english` — note only `universal-3-5-pro` was externally verifiable as a documented model id; the other two work per the deployed behavior claimed in docs, flagged in `external-api-verification.md` §3.
- **Status (61-64):** dot div + `statusText` span — visual-only semantics (A-01/A-02).

### Main — transcription interface (68-122)

- **Editor header (69-78):** title with SVG ✅; "Interactive Editing Enabled" badge — *informs the flagship feature* ✅ good product thinking (though H-06 makes the claim partly false in the live-span region).
- **Editor (80):** `id="message"` `contenteditable="true"` `spellcheck="true"` + `data-placeholder` — the app's heart. Missing `role="textbox"`/`aria-multiline` (implicit for contenteditable in modern AT, but explicit is safer), missing live region for streamed updates (A-01). `spellcheck` perf note (P-05/L-17).
- **Stats (83-88):** word/char counts; separator dot. Static text, updated by JS — fine.
- **Toast (90-93):** `copyFeedback` + `toastText` + accent dot. Fixed-position (CSS), single instance (stacking noted in index.js analysis).
- **Controls (95-122):**
  - Four utility buttons (Clear/Copy/Export/Fix Grammar): real `<button>`s ✅; SVG + visible label ✅; `title` present (L-20); Copy has dual icons (copy/tick) toggled by JS ✅; ids for JS ✅. Clear has `id="clearButton"` disabled-managed during recording (M-07's asymmetry — grammar/download aren't).
  - Record button (116-121): `icon-container` span wrapper for JS SVG injection (P-04) + `buttonText` span.
- **All five buttons use inline `onclick`** → requires the `window.*` exports (index.js:709-717) → CSP-hostile pattern (hardening plan §6).

### Footer (125-127)

Static copyright 2026 + self-referential "Powered by LumiNote Engine" (L-19). `role="contentinfo"` implicit ✅.

### Scripts (130-131)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
<script src="index.js"></script>
```

- End-of-body placement ✅ (no `defer` needed given position).
- Order dependency (index.js references `anime` global at call time — not load time — so CDN latency delays DOMContentLoaded handlers via script-order execution, N-04).
- No SRI, no `crossorigin` (S-08). No fallback/loading-state handling (M-03).
- No `<noscript>`: with JS disabled the page renders the full UI (server serves static HTML) and every button silently does nothing except… nothing — inline onclicks need JS; the editor *is* typeable without JS (contenteditable works) but Copy/Export/Record are dead. A `<noscript>` banner is 3 lines.

---

## SEMANTIC/STRUCTURAL GAPS SUMMARY

1. No `<h1>` — the wordmark is a styled `<span>`. Screen-reader document outline has zero headings (minor; single-view app).
2. Logo/switcher interactions not keyboard-complete (A-04, A-11).
3. No `aria-*` attributes anywhere in the document (zero occurrences — verified).
4. Buttons good; interactive divs (logo, options) bad — consistent pattern gap.
5. No skip-link/target needed (no page scroll) ✅ by design.

---

## ASSESSMENT

| Dimension | Rating |
|---|---|
| Semantics | ★★★☆☆ landmarks yes, widget ARIA no |
| Head completeness | ★★☆☆☆ |
| Progressive enhancement | ★☆☆☆☆ |
| Maintainability | ★★★☆☆ inline handlers scattered; ids stable; readable layout |
| Page weight | ★★★★☆ 6.6 KB HTML, zero render-critical images |

**Highest-value HTML edits (proposals):** noscript banner; meta description + OG + theme-color; convert inline onclicks to addEventListener (unblocks CSP + removes globals); listbox ARIA on the dropdown; `aria-live` on status; make the logo a `<button>` or non-interactive.

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
