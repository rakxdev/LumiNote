# FILE ANALYSIS — `public/reset.css` (129 lines)

- **Role:** Eric Meyer's CSS Reset v2.0 (`20110126` release), loaded before `styles.css`.

---

## CONTENTS

Verbatim upstream reset (verified against the canonical meyerweb source):
1. Element-list margin/padding/border/font normalization (~90 selectors, lines 6-93) including long-dead elements: `applet`, `object`, `iframe`, `center`, `big`, `strike`, `tt`, `var`, `acronym`.
2. HTML5 display-role block normalization (95-107) for `article`…`section` — needed for IE8/9-era engines.
3. `body { line-height: 1 }` (108-110) — immediately overridden by `styles.css` (`line-height: 1.5`, line 52) — an intentional two-step (reset then set) that costs nothing but shows the file's age.
4. List-style removal (111-114) — also re-removed by nothing; the app has no lists, so inert.
5. Quote pseudo-content clearing (116-125).
6. Table collapse (126-129).

---

## ASSESSMENT

**Functionally harmless.** Loaded once (1.9 KB, ~0.7 KB gz), cached, executes in microseconds. The double-reset with `styles.css:32-36` (L-03) means most of this file is redundant *in this app*: the global `* { margin:0; padding:0; box-sizing:border-box }` already covers the reset's primary job.

**Redundancy inventory (vs `styles.css`'s own reset):**
- margin/padding zeroing: duplicated.
- border zeroing: reset does it; styles.css doesn't — but no element relies on cleared borders except where explicitly set.
- font normalization (`font: inherit` on form elements): the only uniquely valuable piece for a form-bearing app — **LumiNote has no form elements**, so also inert.
- quote/table/list rules: no such content.

**Effective unique contribution today: nothing.** Every rule is either duplicated, overridden, or targets absent elements.

**Legacy-context bugs the reset encodes:**
- `body { line-height: 1 }` without immediate restore would be a footgun if styles.css failed to load (unstyled fallback renders 1.0 leading — inaccessible wall of text). Minor: the failure mode requires CSS failure anyway.
- IE-era HTML5 display rules target browsers that cannot run this app at all (AudioWorklet requirement).

---

## RECOMMENDATION (NOT APPLIED)

Replace both resets with one modern minimal block (~20 lines) either at the top of `styles.css` or as the new `reset.css`:

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; }
p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
```

(Josh Comeau's "modern CSS reset" lineage — the 2020s idiom.) Net effect: −120 lines, one fewer request-able file to merge (or same file count), and no legacy selector noise for future maintainers to wonder about.

---

## SCORECARD

| Dimension | Rating |
|---|---|
| Fitness for this app | ★★☆☆☆ (works, but ~0 unique value) |
| Currency | ★☆☆☆☆ (2011 vintage) |
| Risk | ★★★★★ (zero risk — pure inert CSS) |

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
