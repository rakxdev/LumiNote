# LOW-SEVERITY BUGS & DEFECTS — LumiNote v02 Full Audit

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Severity model:** LOW = cosmetic drift, dead code, hygiene issues, and small robustness gaps that do not measurably break flows today but corrode maintainability or polish.

---

## INDEX

| ID | Title | Location |
|---|---|---|
| L-01 | `data-theme="dark"` attribute is dead — no theme system consumes it | `public/index.html:2` |
| L-02 | Model naming inconsistent between dropdown, status pill, and switch toasts | `public/index.html:28-57` vs `public/index.js:60-62` (details in M-01) |
| L-03 | Duplicate CSS resets: `reset.css` (Meyer) **and** `* { margin:0; padding:0 }` in `styles.css` | `public/reset.css:86-93`, `public/styles.css:32-36` |
| L-04 | `transition: all` on interactive elements — perf + surprise-animation anti-pattern | `public/styles.css:166`, `201`, `221`, `277`, `507` |
| L-05 | z-index magic numbers (50, 100, 1000) without a layer scale | `public/styles.css:147`, `205`, `465` |
| L-06 | `X-UA-Compatible` meta is obsolete in a modern evergreen-targeted app | `public/index.html:5` |
| L-07 | Obsolete `browserslist` config with no build pipeline consuming it | `package.json:15-24` |
| L-08 | `eslint`/`prettier` shipped as production dependencies | `package.json:9-14` |
| L-09 | Dual lockfiles: `package-lock.json` + `yarn.lock` + Yarn 4 via `.yarnrc.yml` | repo root |
| L-10 | `package.json` name is the upstream demo's name (`assemblyai-realtime-js-demo`) | `package.json:2` |
| L-11 | "Connected" status state is nearly unreachable (only the switch flow passes it) | `public/index.js:648`, `658-659` |
| L-12 | Logo title tooltip says "Refresh LumiNote" — misclick fear (ties to C-05) | `public/index.html:18` |
| L-13 | `svg_icons/` (16 files) is dead weight in the deployed repo | `svg_icons/` |
| L-14 | Stale `.wrangler/tmp` build artifacts on disk (correctly gitignored) | `.wrangler/tmp/` |
| L-15 | No `robots.txt`, no sitemap, no `meta description`/OG tags — SEO/social black hole | `public/index.html` |
| L-16 | SVG-only favicon: no `favicon.ico`/apple-touch-icon fallback for legacy tabs & touch homescreen | `public/index.html:8` |
| L-17 | `spellcheck="true"` on a live-streaming editor costs CPU on every mutation | `public/index.html:80` |
| L-18 | Two Google font families × 11 weights total loaded; only a handful used | `public/index.html:11` |
| L-19 | Footer/back-reference claims "Powered by LumiNote Engine" — self-referential non-source | `public/index.html:126` |
| L-20 | `title` attributes used as the only tooltip mechanism — no touch equivalent | throughout `public/index.html` |

---

# L-01 — Dead `data-theme` attribute

```html
<html lang="en" data-theme="dark">
```

Nothing in `reset.css` or `styles.css` references `[data-theme]`. Either the attribute is leftover scaffolding for a planned light theme (in which case the CSS variables in `:root` should be re-scoped under `[data-theme="dark"]` now, so a light palette can slot in later), or it should be removed. As-is it misleads readers into expecting theming support.

---

# L-02 — Model naming drift (cross-ref)

Dropdown labels: "🧠 AssemblyAI Universal-3.5 Pro" / "🚀 Deepgram Nova-3 (150ms)" / "⚡ AssemblyAI Fast Realtime". Status pill names: "AssemblyAI 3.5 Pro" / "Deepgram Nova-3" / "AssemblyAI Fast". Switch toast: "AssemblyAI 3.5 Pro". Same model, three visible names. Full analysis and fix (central `MODELS` map) in **M-01**.

---

# L-03 — Double CSS reset

`reset.css` is the classic Eric Meyer reset (2011 vintage, `v2.0 | 20110126` — 15 years old at audit time), zeroing margins/padding/borders across ~50 selectors. `styles.css:32-36` then re-zeroes globally with the modern box-sizing reset:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
```

Both loaded, ~130 lines of redundancy. The modern idiom is a 6-line reset (`*, *::before, *::after { box-sizing: border-box }` + `margin: 0`) plus targeted list/quote rules as needed — or a single line: `all: unset`-style normalizations are not recommended, but replacing Meyer with a 20-line modern reset removes the legacy selectors (`applet`, `object`, `center`, `big`, `strike`…) that target browsers no longer in any support matrix.

---

# L-04 — `transition: all`

Five occurrences animate *every* animatable property on state change:

```css
.model-switcher-btn   { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.model-dropdown-menu  { transition: all 0.25s ...; }
.model-option         { transition: all 0.2s ease; }
.status-indicator-container { transition: all 0.3s ease; }
.control-button       { transition: all 0.25s ease; }
```

Costs: (1) the browser can't skip properties it doesn't need to interpolate, so changes like `visibility` or class toggles that touch layout-triggering properties get animated unintentionally; (2) future edits that change, say, `height` cause surprise transitions; (3) style-recalc cost on low-end hardware. Replace with explicit property lists (`transition: background-color .25s, border-color .25s, box-shadow .25s, transform .25s`).

---

# L-05 — z-index scale

`z-index: 50` (switcher), `100` (dropdown), `1000` (toast) — three ad-hoc layers. Adopt a documented scale (e.g., `--z-dropdown: 30; --z-toast: 60;` tokens) so future modals/popovers slot in without a stacking war.

---

# L-06 — `X-UA-Compatible` obsolete

```html
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
```

Meaningful only for IE9-11 document-mode selection; evergreen browsers ignore it, and the app already requires `AudioWorklet` (unavailable in any IE). Dead weight in `<head>`.

---

# L-07 — Unused `browserslist`

`package.json` carries production/development browserslist arrays, but there is no bundler/transpiler in the pipeline (raw `<script src="index.js">`). The config is inert. Either introduce a build (see recommendations R-16) or delete the block.

---

# L-08 — Tooling in `dependencies`

```json
"dependencies": {
  "axios": "^1.9.0", "dotenv": "^16.4.1",
  "eslint": "^8.56.0", "express": "^4.18.2", "prettier": "^3.2.5"
}
```

`eslint` and `prettier` are dev tools; `express`/`dotenv`/`axios` exist only for the (broken, per H-10) local server. Correct split: `devDependencies` for all four if local-dev support is kept. Also missing entirely: a `lint` script, a `format` script, an `engines` field, and any test runner.

---

# L-09 — Dual lockfiles

The repo contains **`package-lock.json` (npm) and `yarn.lock` (Yarn) plus `.yarnrc.yml` pinning Yarn 4.1.0 via `yarnPath`**. Two resolvers will drift; installs differ depending on which tool a contributor uses; CI has no declared winner. Pick one (the Yarn 4 zero-install setup is more deliberate — `.gitignore` already excludes `.yarn/*` except releases), delete `package-lock.json`, and document the command in README.

---

# L-10 — Upstream demo name

`"name": "assemblyai-realtime-js-demo"` — the project is LumiNote; the name leaks into lockfiles, logs, and any future `npm`/CI metadata. Rename to `luminote`.

---

# L-11 — "Connected" state is a ghost

`updateRecordingState(false, connected=true)` renders the green "Connected" pill (`styles.css:295-298`) — but the only caller passing `connected=true` with `recording=false` is the brief "Switching…" transitional call at `index.js:64`, which immediately gets superseded by `updateRecordingState(true, true)` on `onopen`. Users effectively never see it. Either remove the state or show "Connected · idle" after `onopen` until first audio arrives — a genuinely useful signal that is currently skipped.

---

# L-12 — Tooltip advertises the destructive reload

`title="Refresh LumiNote"` on the logo — combined with C-05 (instant transcript loss), the tooltip *encourages* the click. Whatever C-05's resolution, the tooltip should say what it does honestly ("Reload page — discards transcript") or the handler should go away.

---

# L-13 — `svg_icons/` dead weight

16 SVGs, none referenced by `public/index.html` or CSS (the app uses inline SVGs + `logo.svg`). They ship in the git repo (not in the Pages deploy, since only `public/` is deployed). Keep in an `assets/src/` design folder if they're the icon source-of-truth, or prune.

---

# L-14 — Stale wrangler temp artifacts

`.wrangler/tmp/pages-*` (three sessions' worth of generated `functionsWorker-*.js`, `_routes.json`, etc.) sit on disk. `.gitignore` covers `.wrangler`, so no repo impact — noted because they confused the initial file inventory and can leak absolute paths/pre-release code if ever zipped into a share.

---

# L-15 — SEO/social metadata absent

No `<meta name="description">`, no Open Graph, no Twitter card, no `theme-color`, no `robots.txt`, no canonical URL. For a deployed public product page this forfeits link-previews and search presence for ~10 lines of HTML.

---

# L-16 — Favicon coverage

`<link rel="icon" type="image/svg+xml" href="logo.svg">` only. Legacy contexts that want `favicon.ico` (some bookmarkers, older Enterprise tools) and iOS home-screen installs (`apple-touch-icon`, PNG 180×180) fall back to generic icons. Add `favicon.ico` + `apple-touch-icon.png` + `manifest` (also required groundwork for the PWA/offline direction in `future_enhancement.txt`).

---

# L-17 — `spellcheck="true"` on the streaming editor

The browser re-spellchecks the growing editor on every mutation — with interim updates arriving multiple times per second during recording, this multiplies the mutation cost (compounding P-03's layout thrash). Consider toggling spellcheck off while `isRecording` is true (attribute is settable at runtime) and restoring it on stop.

---

# L-18 — Font payload

```html
<link href="...family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" ...>
```

11 font files (2 families × 4-5 weights) from Google Fonts. Actual use: Inter 400/500/600 (body, buttons, stats) and Outfit 700 (the 5-character "LumiNote" wordmark). `Inter:300` appears unused entirely; `Outfit` non-700 weights unused. Trimming to `Inter:wght@400;500;600` + `Outfit:wght@700` cuts ~4 font downloads (~120-200 KB of woff2 pre-compression on slow links). The stylesheet link is also render-blocking; `rel="preload" as="style" onload` pattern or self-hosting via `@fontsource` removes the third-party round-trip (which also helps the CSP story in S-09).

---

# L-19 — Footer self-reference

"Powered by LumiNote Engine" credits the app to itself. If the intent is attribution, link the actual engines (AssemblyAI, Deepgram) — that also matches the MIT license attribution norms.

---

# L-20 — `title`-only tooltips

All icon buttons rely on `title` for explanation. `title` is inaccessible to touch users, unreliable for screen readers, and never appears on keyboard focus in most browsers. Prefer visible labels (already present on all four utility buttons — good), and add `aria-label` parity plus focus-visible treatment (see accessibility audit A-03).

---

## Aggregated stats for this audit tier

- 20 entries; all verified against the working tree as of commit `61bbfcb`.
- None require data migration or API changes; all are safe to batch into a "polish" PR series.

---

*Analysis only — no source files were modified. Master index: `reports/README.md`.*
