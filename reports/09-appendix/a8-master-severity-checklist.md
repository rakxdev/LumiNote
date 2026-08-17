# APPENDIX H — Master Severity Checklist (all findings, one sheet)

- Purpose: every finding from the audit in checklist form for tracking. Order by phase (see `08-recommendations/prioritized-action-plan.md`). Nothing is fixed — this is the to-do register.

---

## PHASE 0 — TODAY (critical/urgent)

| # | Check | ID | Status |
|---|---|---|---|
| 1 | Deepgram key rotated (old key dead in console) | S-01/C-01 | ☐ |
| 2 | Hardcoded key literal removed from `deepgram-key.js:13` | C-01 | ☐ |
| 3 | Hardcoded key literal removed from `index.js:136` | C-01 | ☐ |
| 4 | `git grep 2b2fe3bc` returns nothing | C-01 | ☐ |
| 5 | 50s token interval removed; mint-on-demand implemented | C-07/N-01/F-01 | ☐ |
| 6 | Mic stopped on remote WS close (both onclose paths) | C-04 | ☐ |
| 7 | Logo reload guarded or removed | C-05 | ☐ |

## PHASE 1 — THIS WEEK (high)

| # | Check | ID | Status |
|---|---|---|---|
| 8 | `/api/deepgram-key` → grant-token minter; rename `/api/deepgram-token` | C-02/S-02 | ☐ |
| 9 | Client uses grant token at session start; no key in heap | C-02/M-06 | ☐ |
| 10 | Wildcard CORS removed from all three functions; OPTIONS blocks deleted | S-03 | ☐ |
| 11 | `public/_headers` deployed (CSP, HSTS, nosniff, Permissions-Policy) | S-05 | ☐ |
| 12 | Function responses carry security headers (shared json helper) | S-05 | ☐ |
| 13 | Model switch stops old mic before restart | C-03 | ☐ |
| 14 | Switch timer cancellable; Stop during switch cancels restart | H-01 | ☐ |
| 15 | Grammar: destructive rules gated off by default | C-06 | ☐ |
| 16 | Grammar: post-punctuation spacing restricted to sentence boundaries | C-06 | ☐ |
| 17 | Grammar: degraded contract (honest "service busy" not fake success) | H-09 | ☐ |
| 18 | Grammar: 20KB cap + 8s timeout + overlap guard | H-09/F-03/F-04/S-07 | ☐ |
| 19 | Stop waits ≤1.5s for final/Termination before close | H-05 | ☐ |
| 20 | AAI onmessage try/catch | H-03 | ☐ |
| 21 | `Termination`/error frames handled (session-ended path) | H-04 | ☐ |
| 22 | WS connect timeout + cancel affordance | H-02 | ☐ |
| 23 | Worklet: clamp + transfer list | H-08/P-12/P-13 | ☐ |
| 24 | gitleaks pre-commit + GitHub secret scanning + CI lint | S-01-recurrence | ☐ |
| 25 | `Server.js` fixed or retired; README documents `wrangler pages dev` | H-10 | ☐ |

## PHASE 2 — THIS MONTH (medium/maintenance)

| # | Check | ID | Status |
|---|---|---|---|
| 26 | `Session` object owns ws+mic+model lifecycle | C-03/H-01 structural | ☐ |
| 27 | `EditorState` single text truth; live span protected | H-06 | ☐ |
| 28 | Autosave (localStorage, debounced) + restore banner + beforeunload guard | C-05/R-12 | ☐ |
| 29 | rAF-batched rendering; stats from state; scroll-pinned bool | P-01/P-02/P-07/P-08/M-02 | ☐ |
| 30 | Live regions for transcript + status | A-01 | ☐ |
| 31 | Dropdown listbox keyboard + ARIA | A-04 | ☐ |
| 32 | Reduced-motion CSS + anime gating | A-05 | ☐ |
| 33 | Focus-visible on switcher | A-03 | ☐ |
| 34 | Emoji aria-hidden | A-06 | ☐ |
| 35 | Contrast: option-desc + record-button gradient | A-11 | ☐ |
| 36 | `100dvh` + `@supports` fallback | responsive §1 | ☐ |
| 37 | `overscroll-behavior: contain` | responsive §4 | ☐ |
| 38 | Status truncation at narrow widths | responsive §2 | ☐ |
| 39 | `touch-action: manipulation` + 44px targets | responsive §4 | ☐ |
| 40 | visibilitychange handling (iOS background) | responsive §5 | ☐ |
| 41 | Grammar chunking + optional KV cache | F-02/F-05 | ☐ |
| 42 | alert() → toast with retry actions | M-09 | ☐ |
| 43 | Tier-1 tests (grammar rules + PCM) in CI | testing §2 | ☐ |
| 44 | anime.js self-hosted or SRI'd; CSP tightened | S-08/M-03/N-04 | ☐ |
| 45 | Google Fonts self-host or non-blocking load; trim weights | N-03/L-18 | ☐ |
| 46 | WSS preconnects for both providers | N-05 | ☐ |
| 47 | `bufferedAmount` backpressure + degraded status | M-05/N-09 | ☐ |
| 48 | Token error paths surfaced; `.env.example` adds DEEPGRAM_API_KEY | M-14 | ☐ |
| 49 | wrangler compat date bump + prune | F-06 | ☐ |
| 50 | Single lockfile; eslint/prettier devDeps; scripts wired | L-08/L-09 | ☐ |

## PHASE 3 — POLISH / v03 (low + roadmap)

| # | Check | ID | Status |
|---|---|---|---|
| 51 | Turn-paragraph editor + timeline rail | D-02/D-04 | ☐ |
| 52 | Status center (VU + link health) | D-01 | ☐ |
| 53 | Command palette + shortcuts | D-03 | ☐ |
| 54 | Grammar diff review UI | D-07 | ☐ |
| 55 | Settings popover + light theme | D-05/D-08 | ☐ |
| 56 | Empty-state onboarding cards | D-06 | ☐ |
| 57 | Placeholder `:has(> br)` fix | H-11 | ☐ |
| 58 | Spellcheck off while recording | L-17/P-05 | ☐ |
| 59 | Dead tokens/rules cleaned (`--warning`, ghost Connected, data-theme) | L-01/L-11 | ☐ |
| 60 | Reset consolidation | L-03 | ☐ |
| 61 | Docs: local-dev section, privacy notice, SECURITY.md, account-id scrub | S-06/S-09/M-11 | ☐ |
| 62 | SEO meta + favicon fallbacks | L-15/L-16 | ☐ |
| 63 | Relay feature security prerequisites (pairing auth etc.) | hardening §7 | ☐ |
| 64 | Client telemetry beacon + provider relay prerequisites | F-08 runbook | ☐ |

---

## TALLY

| Phase | Items | Blocking? |
|---|---|---|
| 0 | 7 | security + data loss |
| 1 | 18 | core correctness + security |
| 2 | 25 | production hardening |
| 3 | 14 | polish/roadmap |

**Done = every ☐ → ☑ with its acceptance check from the action plan.**

---

*Appendix to the LumiNote audit. No source files modified. Master index: `reports/README.md`.*