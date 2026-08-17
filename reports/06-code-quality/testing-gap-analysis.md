# TESTING GAP ANALYSIS — LumiNote v02

- **Audit date:** 2026-08-16 · Read-only analysis.

---

## 1. CURRENT STATE

**Zero tests. Zero test tooling. Zero CI.** No test runner in `package.json`, no `*.test.js`/`*.spec.js` anywhere, no `__tests__/`, no test script. The `browserslist` block is the only "quality config" that touches nothing.

Consequence mapping — every shipped bug in this audit reached production because nothing existed to catch it:

| Bug | Test that would have caught it | Level |
|---|---|---|
| C-03 double-stream on switch | Integration: switch model mid-recording → assert exactly 1 mic stream + 1 ws | E2E |
| C-04 mic stays on remote close | E2E: force ws close → assert `stream.getTracks()[0].readyState === 'ended'` | E2E/unit |
| C-06 grammar corruption | **Unit: pure function, table-driven** — `"Node.js"` → `"Node.js"`, `"I like pizza"` → unchanged | Unit |
| C-07 token churn | Unit: `TokenManager` with mocked clock — assert fetch count over 10 min | Unit |
| H-01 switch races | Unit: `selectCustomModel` ×2 fast → assert 1 pending timer | Unit |
| H-05 lost finals | Integration: stop → assert final message consumed before close | E2E |
| H-08 Int16 wrap | **Unit: pure worklet conversion** — input `[1.5]` → `[32767]` | Unit |
| H-09 grammar silent no-op | Unit: 429 response → assert degraded flag | Unit |
| M-02 scroll hijack | Unit: unfocused + scrolled-up → assert scrollTop unchanged | Unit |

**Priority insight:** the two worst data-corruption bugs (C-06, H-08) are in *pure functions* — the cheapest possible tests. The test gap is not a tooling problem first; it's that the riskiest logic was never isolated into testable units.

---

## 2. RECOMMENDED LADDER (pragmatic, no-framework constraints respected)

### Tier 1 — pure-function unit tests (start here, ~2 hours)
```
devDeps: vitest
functions/grammar.rules.test.js     ← table-driven cases for cleanSpokenEnglish (C-06 catalog)
functions/grammar.languagetool.test.js  ← mocked fetch: overlaps, 429, 20KB, timeout
public/audio-convert.test.js        ← extract conversion loop → test clamp (H-08), boundary values
```
These need zero DOM/WS mocking and cover the two critical data-integrity bugs forever.

### Tier 2 — state-machine unit tests (after Session refactor)
```
session.test.js   ← start→stop idempotent; remote-close stops mic; switch cancels timer (H-01/C-03/C-04 regression armor)
tokenmanager.test.js  ← fake timers: no interval churn; mint-on-demand
```
Requires the architecture report's `Session` object — tests and refactor reinforce each other.

### Tier 3 — E2E smoke (Playwright, ~1 day)
```
e2e/record.spec.js
  - mock wss:// via page.routeWebSocket (Playwright ≥1.48)
  - happy path: start → scripted Turn messages → assert interim + commit text
  - stop: assert Terminate sent + final applied (H-05)
  - switch: assert single capture pipeline (count getUserMedia calls)
e2e/grammar.spec.js  - route /api/grammar; degraded → toast honest
e2e/a11y.spec.js     - axe-core scan: zero serious violations (A-01..A-05 guard)
```
`routeWebSocket` exists precisely for apps like this — no real provider account needed in CI.

### Tier 4 — contract tests (optional)
Pinned JSON fixtures of provider messages (`Begin`, `Turn`, `Termination`, `Results`) → parser tests. Guards against provider protocol drift being discovered in production.

---

## 3. CI WIRING (see maintainability report §2)

lint → unit → e2e (Playwright browsers cached) on PR; deploy job manual-gated. Gitleaks step = the S-01 recurrence guard.

---

## 4. COVERAGE TARGETS (proposed, honest)

| Suite | Target | Rationale |
|---|---|---|
| Pure functions (grammar rules, PCM convert) | 100% branch | trivial, highest bug density found |
| Session/token state | all transitions in the state-machine doc | the critical/severe bug family |
| E2E | 5 scenarios (happy/stop/switch/remote-close/grammar-degraded) | one per production incident class |
| Coverage %, general | don't chase | the app is 900 lines; scenario coverage > line coverage |

---

*Analysis only. Master index: `reports/README.md`.*
