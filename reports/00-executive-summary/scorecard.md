# PROJECT SCORECARD — LumiNote v02

- **Audit date:** 2026-08-16 · Grades synthesize every finding in `reports/`.

---

## CATEGORY GRADES

| Category | Grade | Basis |
|---|---|---|
| **Security** | **F** | Live key exposed 3 ways (source/bundle/endpoint+history); wildcard CORS; zero security headers; no SRI; open grammar proxy (S-01..S-11) |
| **Correctness — core flow** | **C-** | Happy-path dictation works; switch/stop/remote-close/final-flush all defective (C-03/04, H-01/05) |
| **Data integrity** | **D+** | Grammar corrupts text w/o undo (C-06, H-07); logo reload wipes transcript (C-05); zero persistence |
| **Privacy** | **D** | Mic continues after remote close (C-04); transcripts to 3rd party undisclosed (S-09); keys client-side (C-02) |
| **Performance — frontend** | **C** | Layout thrash in hot path (P-01/02), clone-per-keystroke (P-03); rAF batching absent; payload itself tiny ✅ |
| **Performance — audio** | **C+** | Correct modern stack; triple alloc/quantum, clone-per-message, no clamp; leak multiplies cost (P-11..15, H-08) |
| **Performance — network/serverless** | **C-** | Token churn 72×/h/tab; render-blocking fonts; no WSS preconnect; no timeouts/cache in functions (N/F series) |
| **Accessibility (WCAG 2.2)** | **D+** | Live regions, keyboard dropdown, reduced-motion, focus-visible, 2 contrast pairs (A-01..A-11) |
| **Responsive/mobile** | **C-** | Solid breakpoints ✅; 100vh blocker, no overscroll containment, landscape/status clipping, no visibilitychange |
| **Visual design** | **A-** | Coherent tokens, restrained glassmorphism, exemplary dropdown/toast/pill components; scale gaps minor |
| **Code quality** | **B-** | Readable, well-named, commented; silent-failure idioms, duplicated truth, magic constants |
| **Architecture** | **B-** | Right-sized no-build SPA; stateless functions; missing lifecycle owner + single text-truth |
| **Tooling/CI/testing** | **F** | Nothing automated; lint never runs; zero tests; dual lockfiles; no secret scanning |
| **Documentation** | **B-** | Honest, current, developer-friendly; 2 inaccurate claims, no local-dev/privacy/troubleshooting sections |

## WEIGHTED OVERALL

| Weighting | Score |
|---|---|
| As a public production product | **D+** (security + data-integrity floor not met) |
| As a v0.2 hobby/preview release | **B** (design + scope impressive; expected roughness present) |
| Post-Phase-0 projection (2 h of fixes) | **C+** (exposures dead, worst UX bugs closed) |
| Post-Phase-1 projection (1 week) | **B+** (production-credible single-user tool) |

## BUG INVENTORY BY SEVERITY

| Severity | Count | IDs |
|---|---|---|
| Critical | 7 | C-01 key in source · C-02 key endpoint · C-03 switch leak · C-04 mic privacy · C-05 reload loss · C-06 grammar corruption · C-07 token churn |
| High | 11 | H-01 switch races · H-02 stuck button · H-03 parse crash · H-04 ignored events · H-05 lost finals · H-06 live-span edits · H-07 undo destroyed · H-08 PCM wrap · H-09 LT limits · H-10 local dev · H-11 placeholder |
| Medium | 14 | M-01…M-14 |
| Low | 20 | L-01…L-20 |
| Security-specific | 12 | S-01…S-12 (2 critical) |
| Performance-specific | 35 | P-01…P-19, N-01…N-10, F-01…F-08 |

## TOP 5 ACTIONS BY RISK REDUCED PER HOUR

1. Rotate Deepgram key + delete literals (S-01/C-01) — *minutes, eliminates the only existential risk*
2. Grant-token endpoint (C-02) — *a day, permanently closes the credential class*
3. Mic teardown on remote close (C-04) + graceful stop (H-05) — *hours, privacy + data*
4. Switch-path teardown (C-03/H-01) — *hours, makes the flagship feature safe*
5. Grammar rule gating (C-06) — *hours, stops silent corruption of user content*

## POSITIVE-INVENTORY (what to preserve through any refactor)

XSS-safe transcript rendering · AssemblyAI temp-token pattern · AudioWorklet architecture · 16 kHz source capture · no-build frontend discipline · design token system · model-switcher component UX · honest MIT-licensed open sourcing.

---

*No source files were modified. Master index: `reports/README.md`.*
