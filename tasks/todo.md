# Task List: LumiNote v03 Implementation

## Phase 0: Security & Credentials
- [ ] Task 0.1: Remove exposed Deepgram master key and replace with ephemeral grant token minter
  - Acceptance: `git grep "2b2fe3bc"` is empty; `functions/api/deepgram-token.js` calls `POST /v1/auth/token`; `functions/api/deepgram-key.js` deleted.
  - Verify: Run grep & test endpoint logic.
  - Files: `functions/api/deepgram-key.js`, `functions/api/deepgram-token.js`, `public/index.js`
- [ ] Task 0.2: Remove wildcard CORS from all Functions & add `public/_headers`
  - Acceptance: `functions/api/*.js` do not send `Access-Control-Allow-Origin: *`; `public/_headers` contains CSP, HSTS, X-Content-Type-Options.
  - Verify: Inspect `_headers` and function responses.
  - Files: `functions/api/token.js`, `functions/api/grammar.js`, `public/_headers`
- [ ] Task 0.3: Kill the 50s continuous background token poll
  - Acceptance: `startBackgroundRefresh` removed; token is minted on demand when recording starts.
  - Verify: Check `public/index.js` timer logic.
  - Files: `public/index.js`

## Phase 1: Algorithmic Correctness & Tests
- [ ] Task 1.1: Build test suite and rewrite `cleanSpokenEnglish` in `functions/api/grammar.js`
  - Acceptance: Passes all Appendix A test cases ("I like pizza", "had had", "Node.js", "ER").
  - Verify: `node --test tests/grammar.test.js`
  - Files: `functions/api/grammar.js`, `tests/grammar.test.js`
- [ ] Task 1.2: Rewrite `public/audio-processor.js` with sample clamping & buffer transfer
  - Acceptance: Saturating clamp prevents wrapping modulo 2^16; zero-copy message transfer used.
  - Verify: `node --test tests/audio-processor.test.js`
  - Files: `public/audio-processor.js`, `tests/audio-processor.test.js`

## Phase 2: Audio & WebSocket Lifecycle
- [ ] Task 2.1: Unified Audio pipeline and model switcher teardown
  - Acceptance: Switching models stops existing MediaStream and AudioContext cleanly; no orphaned listeners.
  - Verify: Code review and state machine unit test.
  - Files: `public/index.js`, `tests/session-state.test.js`
- [ ] Task 2.2: Remote disconnect handling & graceful stream completion
  - Acceptance: WebSockets stop mic on close/error; graceful terminate allows final turn commit.
  - Verify: Code review & session state test.
  - Files: `public/index.js`
- [ ] Task 2.3: Safe logo click and confirmation guards
  - Acceptance: Clicking logo doesn't destroy unsaved transcript without confirmation.
  - Verify: Manual trigger logic check.
  - Files: `public/index.js`, `public/index.html`

## Phase 3: UI, Accessibility & Mobile
- [ ] Task 3.1: CSS mobile viewport `100dvh` fix, focus-visible & reduced motion
  - Acceptance: CSS uses `100dvh`, provides visible focus rings on tab, and respects reduced motion.
  - Verify: Check CSS rules.
  - Files: `public/styles.css`
- [ ] Task 3.2: HTML accessibility (ARIA, semantic controls, noscript) & remove inline onclicks
  - Acceptance: All button interactions use `addEventListener`; ARIA attributes present on dropdown & status; noscript banner present.
  - Verify: Validate HTML and JS event binding.
  - Files: `public/index.html`, `public/index.js`
- [ ] Task 3.3: Prune deprecated local server files and update docs
  - Acceptance: `server.js` and `tokenGenerator.js` retired; `package.json` scripts updated for wrangler dev & tests; docs updated.
  - Verify: `npm test` runs cleanly.
  - Files: `package.json`, `README.md`, `CLOUDFLARE_DEPLOYMENT.md`, `server.js`, `tokenGenerator.js`

## Phase 4: Final Verification
- [ ] Task 4.1: Run complete test suite and syntax verification
  - Acceptance: 100% tests passing, zero lint/syntax errors, clean git status.
  - Verify: `npm test && npx eslint .`

---

# LumiNote v04 — Link Mode (2026-09-12, branch cloudflare-v04)

## Phase A: Foundation
- [ ] Task 0: Local Node runtime available; baseline `npm test` green.
- [ ] Task 1: PCM batch duplication fixed with test (appendPcmChunk in audio-processor.js).
  - Acceptance: batching never sends bytes beyond the consumed slice; suite green.
  - Files: public/audio-processor.js, public/index.js, tests/audio-processor.test.js

## Phase B: Realtime Backend
- [ ] Task 2: SyncRoom Durable Object worker + protocol tests + dry-run deploy check.
  - Acceptance: protocol unit tests pass; `wrangler deploy --dry-run` OK for worker.
  - Files: worker/src/index.js, worker/wrangler.toml, worker/package.json, tests/link-protocol.test.js
- [ ] Task 3: /api/link/ws Pages Function proxy + DO binding in wrangler.toml.
  - Acceptance: validation tests pass; dry-run OK.
  - Files: functions/api/link/ws.js, wrangler.toml

## Checkpoint: Backend
- [ ] Suite green; both deploy dry-runs pass.

## Phase C: Client
- [ ] Task 4: Pairing UI (LINK button, modal, QR, join, status, reconnect) + vendored QR lib.
  - Acceptance: node --check passes on all client JS; suite green.
  - Files: public/index.html, public/index.js, public/styles.css, public/vendor/
- [ ] Task 5: Live relay + Remote Clipboard tray (turn/interim/clipboard handling, auto-copy).
  - Acceptance: node --check passes; suite green.

## Checkpoint: Client
- [ ] Suite green; all client JS parses.

## Phase D: Proof & Ship
- [ ] Task 6: Local end-to-end two-client fan-out verification.
- [ ] Task 7: ADR-003 + README/DESIGN docs.
- [ ] Task 8: Deploy worker + Pages; live verification; final commit.
