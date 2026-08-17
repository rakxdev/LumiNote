# CODE QUALITY REVIEW — LumiNote v02

- **Audit date:** 2026-08-16 · **Branch:** `cloudflare-v02` (`61bbfcb`) · Read-only analysis.

---

## 1. OVERALL SCORECARD

| File | Lines | Correctness | Robustness | Readability | Maintainability | Security |
|---|---|---|---|---|---|---|
| `public/index.js` | 716 | ★★ | ★★ | ★★★★ | ★★ | ★★ |
| `public/index.html` | 133 | ★★★★ | ★★★ | ★★★★ | ★★★ | ★★★ |
| `public/styles.css` | 663 | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ | — |
| `public/reset.css` | 129 | ★★★★★ | ★★★★★ | ★★★ | ★★ | — |
| `public/audio-processor.js` | 24 | ★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★★ |
| `functions/api/token.js` | 89 | ★★★★ | ★★★ | ★★★★ | ★★★★ | ★★★ |
| `functions/api/deepgram-key.js` | 23 | ★ | ★ | ★★★★ | ★★ | ★ |
| `functions/api/grammar.js` | 141 | ★★ | ★★ | ★★★★ | ★★★ | ★★ |
| `server.js` | 22 | ★★ | ★★★ | ★★★★★ | ★★ | ★★★ |
| `tokenGenerator.js` | 20 | ★★★★ | ★★★ | ★★★★★ | ★★ | ★★★★ |

**Project mean:** 3.1/5 — a clean, readable hobby-grade codebase with production-intent UI but hobby-grade lifecycle rigor. Every file is easy to read; the failures are all in *what happens between functions*, not inside them.

---

## 2. STRENGTHS (keep doing these)

1. **Naming** — `commitActiveTurn`, `scrollToBottomSmart`, `TokenManager.isValid` read like documentation. No abbreviations, no hungarian residue.
2. **Section comments** — `public/index.js` is sectioned and labeled; `styles.css` has functional headers.
3. **Consistent formatting** — 2-space, semicolons (except the worklet), uniform quote usage per file.
4. **Defensive DOM access** — `if (grammarBtn)`, `if (labelEl)`, optional-chaining `stream?.getTracks()`.
5. **Idiomatic provider branches** — the Deepgram/AAI `onmessage` parsers mirror each other's shape (the *contents* differ in safety, the structure matches).
6. **No dependency sprawl client-side** — one library (anime.js), zero build complexity.

## 3. WEAKNESSES (the pattern behind the findings)

1. **Silent failure idioms** — `catch (e) {}` / `catch (error) {}` empty blocks ×4 in `index.js` (74, 473, 607, 611); `if (!res.ok) return text` in grammar; fallback-literal masking. The codebase *systematically prefers silence over signaling* — this one habit explains H-09, M-06, C-01's survivability, and half the UX findings.
2. **Duplicated truth** — model names ×3 sites (M-01), teardown logic ×4 paths, token minting ×2 runtimes (server.js vs token.js), CSS resets ×2.
3. **Magic numbers** — `55`, `50000`, `600`, `300`, `100`, `120`, `2200`, `2000`, `1600` — none named, several mutually inconsistent (55 vs 600; 300 vs nothing).
4. **Global mutable state** — 7 module-level `let`s crossed by 5 async flows; no function owns a lifecycle.
5. **No contracts** — API responses consumed with blind trust (`data.token`, `data.key`, `data.correctedText` — no type/shape checks client-side).

---

## 4. QUICK-FIX CATALOG (mechanical, low-risk — NOT APPLIED)

| # | Change | File:line | Effort |
|---|---|---|---|
| 1 | Replace `catch (e) {}` with `console.warn('ctx', e)` | index.js ×4 | 5 min |
| 2 | `const MODELS = {...}` map; delete 3 name-derivation blocks | index.js | 20 min |
| 3 | Name the constants: `TOKEN_TTL_S=600`, `REFRESH_MS=50000`, `SWITCH_DELAY_MS=300`, `CHUNK_MS=100` | both | 15 min |
| 4 | Response guards: `if (!res.ok || !data.token) throw` | index.js ×3 fetches | 10 min |
| 5 | Add try/catch to AAI onmessage (mirror DG branch) | index.js:563 | 5 min |
| 6 | Delete dead `getAudioContext()` warm call or the null-mic guard in onopen | index.js:486-490/688 | 5 min |
| 7 | Prettier config + `format` script; run once (worklet semicolons) | repo | 15 min |

## 5. LONGER REFACTORS (structural — see architecture report §3)

- `Session` object owning ws+mic+model (kills C-03/C-04/H-01 class).
- `EditorState` module (kills H-06/H-07/P-03 class).
- ES-module split of index.js (716 → ~5 files of 100-200 lines).
- Inline onclick → addEventListener (unblocks CSP, removes 7 window exports).

---

## 6. STYLE CONSISTENCY NOTES

- Mixed quote styles: `index.js` uses `"` and `'` interchangeably (lines 3-11 vs 26) — prettier run resolves.
- `audio-processor.js` omits semicolons unlike every other file.
- Emoji console logs: fine for dev, noisy for prod — gate behind `const DEBUG`.
- JSDoc: zero usage; the public-facing functions (`startRecording`, `stopRecording`) deserve param/return docs given they orchestrate 4 async resources.

---

*Analysis only. Master index: `reports/README.md`.*
