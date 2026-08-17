# PRIORITIZED ACTION PLAN — LumiNote v02

- **Audit date:** 2026-08-16 · Read-only audit; this plan proposes, nothing was applied.
- Ordering rule: security first, then user-data safety, then correctness of the core flow, then performance/polish. Effort: S (<1h) · M (half day) · L (multi-day).

---

## PHASE 0 — TODAY (all S effort, do before anything else)

| # | Action | Fixes | How |
|---|---|---|---|
| 0.1 | **Rotate the Deepgram key** | S-01/S-02 | Deepgram console → delete old key → create scoped key → `wrangler pages secret put DEEPGRAM_API_KEY` → redeploy |
| 0.2 | Delete both hardcoded fallback literals | C-01 | `deepgram-key.js:13`, `index.js:136` → error paths instead |
| 0.3 | Kill the 50 s token interval | C-07/F-01/N-01 | delete `startBackgroundRefresh` call + method; mint at session start |
| 0.4 | Stop the mic on remote close | C-04 | single `handleStreamEnded()` used by both `onclose` handlers |
| 0.5 | Guard logo reload | C-05 | confirm-on-content or remove handler |

**Phase 0 result:** the two credential exposures dead, three worst UX/privacy bugs closed — under 2 hours of work.

## PHASE 1 — THIS WEEK (S/M)

| # | Action | Fixes |
|---|---|---|
| 1.1 | `/api/deepgram-key` → grant-token minter (`POST /v1/auth/token`), rename `/api/deepgram-token`; client mints on demand | C-02, M-06, N-02 |
| 1.2 | Remove wildcard CORS + OPTIONS blocks from all functions | S-03 |
| 1.3 | `public/_headers` + function-level security headers (CSP, HSTS, Permissions-Policy, nosniff…) | S-05 |
| 1.4 | `Session` teardown: `selectCustomModel` stops old mic; cancellable switch timer | C-03, H-01 |
| 1.5 | Grammar engine triage: gate destructive rules off by default; fix letter-after-dot spacing; honest degraded responses | C-06, H-09 |
| 1.6 | Graceful stop: await final/Termination (≤1.5 s cap) before close | H-05 |
| 1.7 | AAI onmessage try/catch; handle `Termination`/errors; connection timeout + cancel affordance | H-03, H-04, H-02 |
| 1.8 | Worklet: clamp + transfer + (optionally) 100 ms worklet-side buffering | H-08, P-12, P-13 |
| 1.9 | gitleaks pre-commit + GitHub secret scanning + CI (lint) | recurrence guards |

## PHASE 2 — THIS MONTH (M/L)

| # | Action | Fixes |
|---|---|---|
| 2.1 | `Session` object refactor (single lifecycle owner) + `EditorState` (single text truth) | eliminates C-03/H-01/H-06 classes structurally |
| 2.2 | Autosave to localStorage (debounced) + restore banner + `beforeunload` guard when content exists | converts all data-loss bugs to annoyances (R-12) |
| 2.3 | rAF-batched rendering; stats from state; scroll-pinned boolean | P-01, P-02, P-07, P-08, M-02 |
| 2.4 | Accessibility package: live regions, listbox keyboard, focus-visible, reduced-motion, emoji aria-hidden, contrast pair | A-01..A-06, A-11 |
| 2.5 | Mobile package: `100dvh` fallback, `overscroll-behavior: contain`, status truncation, `touch-action`, visibilitychange handling | responsive §1,2,4,5 |
| 2.6 | Grammar v2: chunking ≤20 KB, timeout, KV cache, optional diff-review UI (D-07) | H-09, F-02..F-05, S-07 |
| 2.7 | Tier-1 unit tests (grammar rules + PCM conversion) wired to CI | testing report |
| 2.8 | Toast-first errors with retry actions; kill alert() | M-09, UX H-9 |

## PHASE 3 — v03 BACKLOG (L, pairs with `future_enhancement.txt` relay work)

- Prerequisites from this audit closed (Phases 0-2) before relay coding starts.
- D-01 status center (VU + link health) · D-02 turn paragraphs · D-04 timeline rail · D-05 settings (DSP toggles, language, autosave, motion) · D-07 grammar diff · D-08 light theme.
- Self-host LanguageTool if grammar becomes headline (R-09); observability (client error beacon — Sentry/Cloudflare workers-logs).

---

## DEPENDENCY NOTES

- 2.1 unblocks 2.3 and simplifies 1.4/1.7 — if the team can start 2.1 immediately, fold 1.4/1.7 into it.
- 1.5's rule-gating is safe standalone; the full diff-review UI (D-07) waits for 2.1.
- 0.3 changes the `/api/token` traffic profile — pair with the WAF rate rule from hardening §5.

## ACCEPTANCE CHECKLIST PER FIX (definition of done)

- [ ] Reproduction case from the bug report no longer reproduces
- [ ] No new console errors during a 10-min record/switch/stop session
- [ ] Mic indicator clears after every teardown path (user stop, switch, remote close, unload)
- [ ] `git grep 2b2fe3bc` empty; `curl /api/deepgram-key` (or renamed) never returns a raw key
- [ ] Lint clean; tier-1 tests green
