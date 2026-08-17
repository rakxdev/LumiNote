# EXECUTIVE SUMMARY — LumiNote v02 Full Audit

- **Audit date:** 2026-08-16 · **Branch:** `cloudflare-v02` (`61bbfcb`) · **Method:** every file read line-by-line + external web verification of every API/standard the app touches. **No code was changed** — this `reports/` tree is the only addition.

---

## WHAT LUMINOTE IS

A no-framework, single-page real-time dictation app deployed on Cloudflare Pages: browser AudioWorklet → 16 kHz PCM → direct WebSocket streams to **AssemblyAI Streaming v3** (2 models) or **Deepgram Nova-3**, rendered into an editable live transcript, with a server-side grammar-correction endpoint (LanguageTool + rule-based cleanup). Visually polished dark-glassmorphism design; zero persistence; zero tests.

## HEADLINE FINDINGS

1. **🔴 A live-format Deepgram API key is embedded in the repo (server *and* client fallbacks) and is publicly served by `/api/deepgram-key` with `Access-Control-Allow-Origin: *`.** It must be treated as burned: rotate it today, then delete the literals, then convert the endpoint to Deepgram's 30-second grant tokens (the sanctioned browser flow). This is the only finding requiring same-day action.
2. **🔴 Live model-switching leaks microphone pipelines.** Switching models mid-recording never stops the old capture graph — the old and new pipelines both stream to the new session (garbled/duplicated transcripts) and the mic indicator stays lit afterward. Rapid switches and Stop-during-switch have follow-on races.
3. **🔴 "Fix Grammar" corrupts text irreversibly.** The rule engine deletes the word "like" from normal sentences, collapses valid repeats ("had had"), injects spaces into filenames/domains ("Node.js" → "Node. js"), and the result replaces the editor with no undo.
4. **🟠 The token system burns quota by design-flaw**: AssemblyAI temp tokens are one-time-use (verified against docs), yet the client mints a fresh one every 50 seconds per open tab — ~72 wasted mints/hour/tab plus Pages Function invocations.
5. **🟠 Stopping loses the final words**: the client closes the WebSocket immediately after `Terminate`/`CloseStream`, never awaiting the provider's final flush.
6. **🟠 Silent failures everywhere**: provider session-death, grammar-service overload, CDN blockage all surface as either nothing, a fake success toast, or a stuck UI — the mic can even keep recording (privacy) after the server hangs up.
7. **🟡 Mobile is compromised by `100vh`**: the record button sits below the fold on mobile Safari/Chrome until scroll-collapse; pull-to-refresh can wipe the unpersisted transcript.
8. **🟡 WCAG 2.2 AA not met**: no live regions (screen readers get nothing from the transcript), dropdown not keyboard-operable, no reduced-motion, one stripped focus outline, two borderline-contrast pairs.
9. **🟢 Genuine strengths**: XSS-safe transcript path, correct AssemblyAI token pattern, right-sized no-build frontend (~40 KB JS), strong visual design system, 16 kHz capture at source, correct provider URL parameters (all externally verified).

## NUMBERS

| Metric | Count |
|---|---|
| Critical bugs | **7** (C-01…C-07) |
| High bugs | 11 (H-01…H-11) |
| Medium bugs | 14 (M-01…M-14) |
| Low defects | 20 (L-01…L-20) |
| Security findings | 12 (2 critical, 2 high) |
| Performance findings | 19 (P-series) + 8 network (N) + 8 serverless (F) |
| Accessibility failures | 6 substantive (A-01…A-12) |
| Files read | 100% of tracked source (26 significant files) |
| Report files | 40 across 9 folders |

## THE THREE THEMES

1. **Lifecycle ownership is missing** — `ws` + `microphone` + state are torn down by four inconsistent paths; nearly every critical/high bug lives at that seam. Fix = one `Session` object.
2. **Silence over signaling** — empty catches, silent fallbacks (including the leaked key), fake-success responses. Fix = typed outcomes + one error channel.
3. **A v0.2 design layer on v0.1 reliability** — the UI outclasses the plumbing; Phase 0 of the action plan (2 hours) closes the worst of it, Phase 1 (a week) makes it production-credible.

## WHAT TO DO FIRST

**Today (Phase 0, <2 h):** rotate the Deepgram key → delete both hardcoded literals → stop the 50 s token interval → stop the mic on remote close → guard the logo-reload data loss.
**This week (Phase 1):** grant-token endpoint, CORS removal, `_headers` security set, switch-path teardown, grammar triage, graceful stop, worklet clamp+transfer, secret scanning + CI lint.
**This month (Phase 2):** `Session`/`EditorState` refactor, autosave, a11y + mobile packages, rAF rendering, Tier-1 tests.
Full detail: `08-recommendations/prioritized-action-plan.md` · one-hour bundle: `08-recommendations/quick-wins.md`.

---

## REPORT MAP

```
reports/
├── README.md                     ← start here (full index)
├── 00-executive-summary/         ← this file + scorecard
├── 01-codebase-analysis/         ← 11 file-by-file + 2 architecture reports
├── 02-bugs/{critical,high,medium,low}/
├── 03-security/                  ← audit + secrets deep-dive + hardening plan
├── 04-performance/               ← rendering / audio / network / serverless
├── 05-frontend-design/           ← UX heuristics / design system / a11y / responsive / redesigns
├── 06-code-quality/              ← review / tooling / testing gaps
├── 07-research/                  ← web findings / API verification / benchmarks
└── 08-recommendations/           ← action plan / quick wins
```

*No source files, configuration, or infrastructure were modified during this audit.*
