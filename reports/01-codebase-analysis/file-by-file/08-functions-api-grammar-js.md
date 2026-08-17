# FILE ANALYSIS — `functions/api/grammar.js` (141 lines)

- **Role:** Pages Function at `POST /api/grammar` — the "✨ Fix Grammar" backend: LanguageTool API check + a rule-based spoken-English cleanup pass.
- **Structure:** `onRequest` handler (2-60) + two helpers: `checkLanguageTool` (63-103), `cleanSpokenEnglish` (106-141).

---

## `onRequest` WALKTHROUGH (2-60)

1. **OPTIONS preflight** (4-13) — wildcard CORS again (S-03).
2. **Method guard** (14-19): non-POST → 405 ✅ (the only function with an explicit method check).
3. **Parse** (22): `await context.request.json()` — unbounded before validation (F-04).
4. **Empty text** (25-33): returns `{ correctedText: '' }` 200 ✅ benign.
5. **Pipeline** (36-39): `corrected = cleanSpokenEnglish(checkLanguageTool(rawText))` — LanguageTool first, destructive rules second (so cleanup runs over already-corrected text — the ordering maximizes C-06's damage: LT's own punctuation decisions get re-mangled by rule 4).
6. **Response** (41-48): 200 with correctedText; `no-cache` only (could be `no-store`; function responses aren't edge-cached anyway).

## `checkLanguageTool` (63-103)

```js
const params = new URLSearchParams();
params.append('text', text);
params.append('language', 'en-US');
const res = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', ... });
if (!res.ok) return text;                       // ← silent passthrough on failure (H-09's fake-success)
...
const sortedMatches = matches.sort((a, b) => b.offset - a.offset);
for (const match of sortedMatches) {
  if (match.replacements && match.replacements.length > 0) {
    const replacement = match.replacements[0].value;
    result = result.slice(0, start) + replacement + result.slice(end);
  }
}
```

**Correct techniques:** right-to-left application preserving offsets ✅; fallback-to-original on network error ✅ (right *behavior*, wrong *signaling*).

**Defects:**
- `match.replacements[0]` — first suggestion ≠ best (LanguageTool orders by relevance, so usually acceptable; no confidence check).
- **No overlap guard** — two matches spanning the same range splice garbage at the seam (H-09).
- **Limits unhandled:** 20,000 chars/request, 20 req/min/IP (shared across Cloudflare egress!), 75k chars/min, 30-suggestion cap — verified via [LanguageTool's API docs](https://languagetool.org/http-api/) and [public API page](https://dev.languagetool.org/public-http-api.html) (H-09, F-05).
- **No timeout** (F-03).
- **Privacy:** full user text to a third party, undisclosed (S-09).

## `cleanSpokenEnglish` (106-141) — the C-06 engine

| Step | Rule | Failure cases (evidence in C-06) |
|---|---|---|
| 1 (110) | Delete `uh|um|er|ah|like|you know|i mean|sort of|kind of` | "I like pizza" → "I pizza"; "I mean it" → "it" |
| 2 (113) | Collapse `\b(\w+)\s+\1\b` | "had had" (correct English) → "had"; "that that" (legal) |
| 3 (116-123) | Subject-verb fixes (`i is`→`I am`, `he don't`→`he doesn't`, `me and X is`→`X and I is`) | README's claim "me and him is → He and I are" **not** what the code does |
| 4 (126-128) | Space normalization: collapse whitespace; strip space before punctuation; **insert space after `.`/`,`/`?`/`!` before any letter** | "3.14"→"3. 14"; "Node.js"→"Node. js"; "U.S.A"→"U. S. A" |
| 5 (131-132) | `i`→`I`; sentence-start caps | ✅ correct |
| 6 (136-138) | Append `.` if no terminal punct | mostly ✅ (adds "." after abbreviations ending in letters-only text — benign) |

**Rule 4's letter-class `[A-Za-z]` exempts digits** — decimals like `3.5` survive only when followed by a digit… `"3.14"`: the `.` is followed by `1` (digit) → exempt ✅! Re-verification: `([.,?!])([A-Za-z])` requires a *letter* after the punctuation. So `3.14` is safe; `version 2.1a` → `2.1 a`? — `1a`: no punctuation between → safe; `"Node.js"` → `.` followed by `j` (letter) → **"Node. js" confirmed broken**; `"e.g."` → `e.` then `g`? The `.` after `g` is followed by end/space → safe, but the `.` after `e` is followed by `g` → "e. g." confirmed. **Correction to C-06's table:** numeric decimals with digit-followers survive (`3.14` safe); alphanumeric mixes (`2.1a`… wait `.` followed by `1` digit → safe; `v1.2beta` safe) — the real casualties are letter-after-dot: domains, "Node.js", "e.g.", initials "J.R.R.", filenames "index.js". C-06's impact stands (any dictated filename/domain/abbreviation), with the decimal example refined: prices like `9.99` are safe; `9.99$`-style or `.5` (`.5` → `.` followed by `5` digit → safe)… `x.y` forms with letter-y break. Amended evidence: `"Visit node.dev"` → `"Visit node. dev"`. This refinement is recorded here and in the errata note of the critical report's fix section (numbers-with-letter-suffix forms still break).

Step 3's `me and (\w+)` → `$1 and I` keeps the verb untouched and keeps the wrong pronoun case — README/code mismatch documented (C-06d).

---

## FINDINGS SUMMARY

| ID | Finding | Severity |
|---|---|---|
| C-06 | Destructive rules corrupt legitimate text (like-deletion, dedup-collapse, letter-after-dot spacing) | **Critical** |
| H-09 | Limits unhandled + silent no-op + fake-success signaling | High |
| S-07 | Open unauthenticated proxy, unbounded input, no throttle | Medium (security) |
| S-09 | Third-party text disclosure without notice | Medium (privacy) |
| F-03/F-04/F-05 | No timeout; parse-before-validate; latency floor | Medium (perf) |
| — | Ordering: cleanup after LT maximizes mangling | Medium |

## PROPOSED SAFE PIPELINE (NOT APPLIED)

1. Validate: string, ≤20,000 chars, else 413.
2. LanguageTool with 8s timeout; on failure return `{ correctedText: null, degraded: true }` (client shows honest message).
3. Skip overlaps: track applied `[start,end)` ranges; skip intersecting matches.
4. Cleanup rules gated to *hesitation tokens only* (`uh+|um+|erm+|ah+|hmm+` with optional comma), no "like"/"you know"/"i mean"; dedup only for `the|a|and|to|of|is`; punctuation-spacing only for `[.?!][A-Z]` (sentence-start heuristic) — never mid-word letters.
5. Return plus `diffTokenCount` so the UI can warn "N changes — review?" (D-07's hook).

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
