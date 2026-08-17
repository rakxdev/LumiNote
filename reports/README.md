# LumiNote v02 — Full Audit Report Suite

- **Audit date:** 2026-08-16 · **Branch:** `cloudflare-v02` (commit `61bbfcb`)
- **Mandate:** read every file, verify externally via web research, report bugs / performance / design / best practices in a multi-folder report tree.
- **Constraint honored:** **zero source files were changed.** Everything below is new content under `reports/`.

---

## HOW TO READ THIS SUITE

```
reports/
├── README.md                       ← you are here (index)
├── 00-executive-summary/
│   ├── SUMMARY.md                  ← 5-minute overview: findings, numbers, themes, first actions
│   └── scorecard.md                ← letter grades per domain + weighted overall
├── 01-codebase-analysis/
│   ├── file-by-file/               ← 11 documents, one per source file/concern group
│   │   ├── 01-public-index-js.md
│   │   ├── 02-public-index-html.md
│   │   ├── 03-public-styles-css.md
│   │   ├── 04-public-reset-css.md
│   │   ├── 05-public-audio-processor-js.md
│   │   ├── 06-functions-api-token-js.md
│   │   ├── 07-functions-api-deepgram-key-js.md
│   │   ├── 08-functions-api-grammar-js.md
│   │   ├── 09-server-js.md
│   │   ├── 10-config-and-assets.md
│   │   └── 11-config-and-docs.md
│   └── architecture/
│       ├── system-architecture.md  ← component/data diagrams + the 5 seams bugs cluster at
│       └── data-flow-and-state-machine.md  ← formal state machines & protocol flows
├── 02-bugs/
│   ├── critical/CRITICAL-BUGS.md   ← C-01…C-07 (each: location, evidence, impact, fix)
│   ├── high/HIGH-BUGS.md           ← H-01…H-11
│   ├── medium/MEDIUM-BUGS.md       ← M-01…M-14
│   └── low/LOW-BUGS.md             ← L-01…L-20 + verified-positives list
├── 03-security/
│   ├── vulnerability-audit.md      ← risk register S-01…S-12 + remediation sequence
│   ├── secrets-exposure-analysis.md← the leaked key: inventory, surfaces, blast radius, playbook
│   └── hardening-plan.md           ← copy-ready _headers, CSP, grant-token endpoint, checklist
├── 04-performance/
│   ├── frontend-rendering-performance.md   ← P-01…P-10 (layout thrash, virtualization)
│   ├── audio-pipeline-performance.md       ← P-11…P-19 (worklet allocations, transfer)
│   ├── network-and-api-performance.md      ← N-01…N-10 (token churn, preconnects, fonts)
│   └── serverless-performance.md           ← F-01…F-08 (no timeouts, no cache, logging)
├── 05-frontend-design/
│   ├── ui-ux-heuristic-review.md   ← Nielsen 10 heuristics + 10 ranked UX fixes
│   ├── design-system-review.md     ← tokens, typography, contrast math, component audit
│   ├── accessibility-audit.md      ← WCAG 2.2, findings A-01…A-12
│   ├── responsive-mobile-review.md ← 100vh/dvh, pull-to-refresh, touch ergonomics
│   └── redesign-proposals.md       ← D-01…D-10 future designs (VU meter, timeline, palette…)
├── 06-code-quality/
│   ├── code-quality-review.md      ← per-file grades, strengths, weakest idioms, fix catalog
│   ├── maintainability-and-tooling.md ← what runs vs what exists; CI/ops maturity
│   └── testing-gap-analysis.md     ← 0 tests today; 4-tier ladder mapped to actual bugs
├── 07-research/
│   ├── web-research-findings.md    ← sources consulted + what each verified
│   ├── external-api-verification.md← every provider URL/param confirmed or flagged
│   └── best-practices-benchmarks.md← LumiNote vs industry baseline per domain
└── 08-recommendations/
    ├── prioritized-action-plan.md  ← Phase 0 (today) / 1 (week) / 2 (month) / 3 (v03)
    └── quick-wins.md               ← W-01…W-18, each <30 min; "one-hour bundle"

09-appendix/ is a sibling folder with copy-ready reference material:
    a1-grammar-rule-test-matrix.md       ← every grammar rule × edge case (acceptance spec for C-06)
    a2-provider-message-catalogs.md      ← full wire contracts + JSON test fixtures
    a3-endpoint-and-constant-registry.md ← every URL/id/constant with file:line
    a4-browser-support-matrix.md         ← API baselines + platform caveats
    a5-reference-test-suites.md          ← runnable vitest specs (grammar, PCM, parsers, tokens)
    a6-deployment-ops-runbook.md         ← deploy/rollback/logs/incident runbooks
    a7-css-component-recipe-book.md      ← token-consistent CSS with audit fixes folded in
    a8-master-severity-checklist.md      ← all 64 findings as one tracking sheet
```

---

## MOST IMPORTANT FINDINGS IN ONE SCREEN

1. **CRITICAL — rotate the Deepgram key now.** A live key literal sits in `functions/api/deepgram-key.js:13` and `public/index.js:136`, is served by an unauthenticated `Access-Control-Allow-Origin: *` endpoint, and is embedded in git history. Rotation is the only complete fix; endpoint redesign guidance in C-02/hardening §3.
2. **CRITICAL — live model switches leak mic pipelines** (double audio, mic pill stays lit): C-03/C-04.
3. **CRITICAL — "Fix Grammar" irreversibly corrupts text** (deletes "like", breaks "Node.js", collapses "had had") with no undo: C-06/H-07.
4. **Verbatim-with-docs checks passed** for `universal-3-5-pro` model id, all provider URL parameters, Deepgram/LanguageTool limit facts — see `07-research/external-api-verification.md`.
5. A **~10,000-line** suite across 40 reports, all findings traceable to file:line evidence.

---

## CROSS-REFERENCE (bug ID → all reports covering it)

| Bug ID | Primary | Also in |
|---|---|---|
| C-01/C-02 | `02-bugs/critical` | `03-security/*` (all 3), `file-by-file/07`, `04-performance/serverless F-02/F-03` |
| C-03 | `02-bugs/critical` | `04-performance/audio P-11`, `architecture/data-flow §1` |
| C-04 | `02-bugs/critical` | `02-bugs/high H-04`, `ux-heuristic H-1`, `quick-wins W-04` |
| C-05 | `02-bugs/critical` | `ux-heuristic H-3/H-5`, `responsive §4`, `quick-wins W-03` |
| C-06 | `02-bugs/critical` | `file-by-file/08`, `testing-gap §1`, `redesign D-07` |
| C-07 | `02-bugs/critical` | `04-performance/network N-01`, `serverless F-01`, `quick-wins W-05` |
| H-01…H-11 | `02-bugs/high` | mapped in `testing-gap §1` table |
| M-01…M-14 | `02-bugs/medium` | various (M-02→responsive, M-08→a11y…) |
| A-01…A-12 | `05-frontend-design/accessibility-audit` | `best-practices §E` |
| P/N/F series | `04-performance/*` | `best-practices §A-B-C-F` |

---

## GUARANTEES & LIMITS

- **Method:** 100% of tracked source files read in full; web verification against primary sources (AssemblyAI, Deepgram, LanguageTool, cdnjs/jsDelivr, W3C/WAI, MDN, Cloudflare docs) — all URLs cited in `07-research/web-research-findings.md`.
- **No tool executed against the live deployment or any provider with the discovered key** (audit ethics, see secrets report §7).
- **Two items remain externally unverifiable** (flagged, not asserted): model id `universal-streaming-english`; provider-plan latency/concurrency figures in the README matrix.
- Line counts and structure verified after generation (see final audit report message).

---

*Read-only audit. No source files, configuration, or infrastructure were modified.*