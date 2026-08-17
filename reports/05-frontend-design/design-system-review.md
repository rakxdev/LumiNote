# DESIGN SYSTEM REVIEW — LumiNote v02

- **Audit date:** 2026-08-16
- **Scope:** `public/styles.css` (663 lines) + `public/reset.css` (129 lines) + typography/color usage in `public/index.html` and `public/logo.svg`. Assessment of the design-token architecture, visual language coherence, and CSS engineering quality — as a system, independent of the bugs tracked elsewhere.

---

## 1. VERDICT

A genuinely competent dark-glassmorphism system for a v02 product: consistent token usage, restrained accent deployment, and a clear visual hierarchy. Weaknesses are structural (no light theme despite the `data-theme` hook, no spacing/type scale, hardcoded color literals bypassing tokens) and hygienic (legacy reset, `transition: all`, magic z-index — tracked as L-03/L-04/L-05).

---

## 2. TOKEN ARCHITECTURE

### 2.1 What exists (`styles.css:2-30`)

| Category | Tokens | Assessment |
|---|---|---|
| Surfaces | `--bg-dark`, `--bg-card`, `--bg-card-border`, `--bg-editor` | Good layered-surface model; card uses translucent rgba (glass) — intentional |
| Text | `--text-primary`, `--text-secondary`, `--text-muted` | Correct 3-tier hierarchy; all three actually used |
| Accents | `--accent-purple/pink/cyan`, `--accent-gradient`, `--badge-gradient` | Gradient carries brand; purple is the working accent |
| Semantic | `--success`, `--error`, `--warning` | Success/error used; **`--warning` declared, never used** (dead token) |
| Elevation | `--shadow-lg`, `--shadow-glow`, `--shadow-recording` | Semantic names, all used |
| Radius | `--radius-sm/md/lg/full` | Clean 4-step scale, consistently applied |

### 2.2 What's missing

- **No spacing scale.** Every gap/padding is a literal (`0.75rem`, `1.25rem`, `0.4rem 0.95rem`…). A `--space-1..8` scale would halve the visual QA surface.
- **No type scale.** Font sizes are literals from 0.7rem to 1.65rem with no defined steps (`0.725rem`, `0.775rem`, `0.825rem`, `1.025rem`, `1.1rem` — the `1.025rem` placeholder vs `1.1rem` body pair is a 0.075rem near-miss that reads as a mistake, not a decision).
- **No z-index tokens** (L-05).
- **No motion tokens** (durations/easings repeated as literals: `0.25s cubic-bezier(0.4,0,0.2,1)` appears 5×; `ease` 8×; three distinct cubic-beziers without names).
- **No breakpoint tokens** (900px/600px hardcoded — fine in plain CSS, but document them).

### 2.3 Token discipline audit

Literal colors that bypass tokens (grep-verified occurrences in rules, not counting `:root` definitions):

- `#a78bfa` used directly at `styles.css:178`, `415` — should be `var(--accent-purple-300)`-style step; the palette has no "light purple" token though the design needs one three times.
- `#c084fc` at `styles.css:130`, `533` — same gap: a "badge text purple" token is missing.
- `rgba(139, 92, 246, …)` (accent-purple's rgb) hardcoded ~12 times at various alphas — alpha steps are a legitimate reason to inline, but a `--accent-purple-a15/a25/a35…` set would make the glass-tint system legible.
- `rgba(255,255,255,…)` whites at `0.05/0.08/0.15` — an opacity-step set is missing.

None of these are bugs — they're the difference between "uses tokens" and "has a token system".

---

## 3. COLOR & CONTRAST

Background stack: near-black `#0b0c10` with two fixed radial-gradient tints (purple 12% top-left, cyan 10% bottom-right) — a tasteful "aurora" backdrop that avoids the flat-black cave.

Contrast spot-checks (against the effective dark backgrounds, computed from the declared values):

| Element | FG | BG (effective) | Ratio | WCAG |
|---|---|---|---|---|
| Body text `--text-primary` #f1f5f9 | on #0b0c10+glass | ≈17:1 | AAA ✅ |
| Secondary #94a3b8 | on #0b0c10 | ≈7.3:1 | AA/AAA ✅ |
| Muted #64748b | on #0b0c10 | ≈4.6:1 | AA (normal) ✅ borderline |
| Muted option-desc #64748b **0.7rem (≈11.2px)** | on dropdown #121620 | ≈4.3:1 | ⚠ AA requires 4.5 for normal text; small size makes it worse in practice |
| Live-turn `#a78bfa` | on #0e1117 | ≈6.4:1 | AA ✅ |
| Badge text `#c084fc` 0.7rem | on badge tint over dark | ≈7:1 | ✅ |
| Button text #fff on purple-pink-cyan gradient | mid-gradient | ≈3.2-4.5:1 varies by stop | ⚠ gradient buttons guarantee contrast *ranges*, not values — the cyan end (x≈100%) is the weak stop, though label rarely overlaps it at this width |

Full accessibility treatment (focus, motion, semantics) in `accessibility-audit.md`.

---

## 4. TYPOGRAPHY

- **Families:** Inter (UI/workhorse) + Outfit (wordmark only). Sensible pairing; both variable-font capable via Google Fonts (though requested as static weights — L-18).
- **Sizes in use:** 0.7 → 1.65rem across ~10 values. The editor body (1.1rem / 1.75 line-height) is comfortably readable for long-form — the right call for the primary surface. Micro-labels at 0.7-0.725rem are fashionably small; 0.75rem with `letter-spacing` would be kinder (and safer for contrast).
- **Wordmark:** gradient text via `background-clip: text` with both `-webkit-` and standard properties (`styles.css:112-121`) — correctly dual-written ✅. `letter-spacing: -0.02em` suits Outfit's geometry.
- **Uppercase micro-labels** (`.editor-title`) with `0.05em` tracking — professional detail.

---

## 5. COMPONENT INVENTORY & QUALITY

| Component | Lines | Quality notes |
|---|---|---|
| Model switcher (custom dropdown) | 143-264 | Best-built component: open/close transitions, chevron rotation, active checkmark, hover/active states, outside-click close (JS), full-width mobile variant. Missing: keyboard navigation (Tab/arrows/Esc — see A-04), `aria-expanded` |
| Status pill | 266-310 | Three states + pulse animation; clean |
| Editor card | 378-418 | Focus ring, custom thin scrollbar (Firefox `scrollbar-*` + no WebKit equivalent — Chrome gets default scrollbar; a `::-webkit-scrollbar` block would unify), `pre-wrap` for speech text ✅ |
| Toast | 443-481 | Spring cubic-bezier, glass, dot accent; fixed top-center; good |
| Buttons (control/record) | 501-594 | Consistent radius/hover-lift idiom; disabled states styled ✅; grammar loading spinner ✅ |
| Footer/header | 67-141, 597-605 | Thin, quiet — correct |

**Scrollbar note:** `scrollbar-width: thin; scrollbar-color: var(--accent-purple) transparent` (`styles.css:396-397`) is Firefox-only syntax; Chromium shows the chunky default. Five lines of `::-webkit-scrollbar` pseudo-elements would complete the polish on the app's most-scrolled element.

---

## 6. LAYOUT SYSTEM

- **Viewport lock:** `html, body { height: 100vh; max-height: 100vh; overflow: hidden }` + `.container` flex column + `.transcription-interface { flex: 1; min-height: 0 }` — the "only the editor scrolls" architecture is correctly built (the `min-height: 0` comments at lines 321/389 show the author fought and won the classic flexbox battle). Mobile viewport-unit pitfalls (100vh vs dynamic toolbars) are analyzed in `responsive-mobile-review.md`.
- **Grid vs flex:** All flex; appropriate at this complexity. The controls row going `column-reverse` at 900px (record button visually on top — sensible thumb placement) with utility buttons as a 2-col grid is a thoughtful mobile arrangement.
- **Width strategy:** max-width 1360px with fluid padding — fits the "document editor" genre.

---

## 7. GLASSMORPHISM — COST/BENEFIT

Backdrop-filter usage: header pill (blur 16), dropdown (20), status pill (12), main card (16), toast (20). Five stacked blur layers. Benefit: the aurora background reads through the chrome, giving depth without heavy borders. Cost: each blur is a full compositing pass on its layer region; stacked over a `background-attachment: fixed` body gradient, low-end GPUs pay noticeably. On desktop, imperceptible; on a 250 Android, this is part of why the page feels heavy during streaming (compounding P-01/P-02). Recommendation: keep blur on the dropdown + toast (high-value moments), replace the always-on card/header blurs with pre-blended translucent solids (the current `rgba` colors are already 75-90% opaque — the blur contributes little at those opacities).

---

## 8. MOTION DESIGN

- **Vocabulary:** 150-350ms, ease-out family, one spring (toast `cubic-bezier(0.34, 1.56, 0.64, 1)`), two infinite pulses (status dot 1.5s, record button 2s), one spinner. Coherent and restrained.
- **The pulses** communicate "live capture" — functional, not decorative ✅.
- **Gap:** no `prefers-reduced-motion` handling anywhere (A-05) — the infinite pulses are exactly what the media query exists for.
- **`transition: all`** ×5 (L-04) and the `anime()`/CSS-animation property collision on `.status-indicator` (P-06).

---

## 9. RESET STRATEGY

Meyer reset v2 (2011) + global modern reset — double coverage, legacy selectors for dead browsers (`applet`, `object`, `center`, `big`, `strike`), and `box-sizing` applied globally only in the second file. Replace both with one ~20-line modern reset: `*,*::before,*::after{box-sizing:border-box;margin:0}` + `body{line-height:1.5}` + `img,svg{display:block;max-width:100%}` + list/quote/form normalizations actually needed. (L-03.)

---

## 10. DESIGN-SYSTEM ROADMAP (proposals, not applied)

1. **Formalize scales:** `--space-1: .25rem` … `--space-8: 3rem`; type steps at 0.75/0.875/1/1.125/1.25/1.5/2rem; `--z-*` layers; `--duration-fast/base-slow`, `--ease-out`, `--ease-spring` tokens.
2. **Alpha-step tokens** for the purple/cyan glass tints (`--accent-purple-a10/20/30`) — deletes ~15 inline rgba literals.
3. **Light theme** via the existing `data-theme` hook (L-01): re-point the ~12 semantic tokens; the aurora becomes a soft violet-tinted white; glass blurs drop (they read poorly on light). Ship as `prefers-color-scheme`-aware with a manual toggle.
4. **Scrollbar parity** (`::-webkit-scrollbar` companions).
5. **A `--warning` decision:** use it (e.g., "Switching…"/degraded-network states — currently those borrow neutral colors) or delete it.
6. **Gradient-button contrast floor:** darken the cyan stop (`#06b6d4` → `#0891b2`) or cap the gradient before the pure-cyan end for the record button so white text keeps ≥4.5:1 across the full width.

---

*Analysis only — no source files were modified. Master index: `reports/README.md`.*
