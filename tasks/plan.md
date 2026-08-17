# Implementation Plan: LumiNote v03

## Phase 0: Security & Secret Hardening (Immediate)
- Delete hardcoded Deepgram key fallback in `functions/api/deepgram-key.js` and `public/index.js`.
- Create `functions/api/deepgram-token.js` to mint temporary (~30s TTL) grant tokens via Deepgram's `POST /v1/auth/token`.
- Remove wildcard CORS headers from internal API routes (same-origin only).
- Add `public/_headers` with Content-Security-Policy, HSTS, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
- Stop the 50s continuous background token refresh interval.

## Phase 1: Test Suite & Core Algorithmic Fixes
- Set up unit testing in `tests/` using Node.js native test runner `node:test`.
- Test & rewrite `cleanSpokenEnglish` in `functions/api/grammar.js`:
  - Hesitation removal limited strictly to non-word fillers (`uh`, `um`, `ah`, `hmm`, `er`).
  - No blind deletion of "like", "you know", "i mean", "sort of", "kind of".
  - Duplicate collapsing whitelists valid English duplicates ("had had", "that that").
  - Letter-after-dot spacing preserved for domains, code filenames, and acronyms (`Node.js`, `e.g.`, `U.S.A.`).
  - LanguageTool API call given an explicit 8s timeout and safe fallback handling.
- Test & rewrite `public/audio-processor.js`:
  - Saturating clamp on Float32 to Int16 conversions to eliminate crackle on loud speech.
  - Zero-copy `postMessage` with `ArrayBuffer` transfer.

## Phase 2: Audio & WebSocket Lifecycle (Single Session Owner)
- Refactor `public/index.js` lifecycle management:
  - Create unified audio pipeline teardown (`stopAudioPipeline()`) stopping all MediaStream tracks and closing/suspending the AudioContext.
  - Fix model switching (`selectCustomModel`): properly terminate current active recording and mic before restarting on new model.
  - Fix remote WebSocket disconnection: on socket `close` or `error`, trigger full teardown and update UI.
  - Graceful stop: send termination signal, wait for final transcript/timeout before closing socket.
  - Remove destructive reload on logo click; replace with clean state reset.

## Phase 3: UI, Accessibility & Mobile Polish
- Update `public/styles.css`:
  - Replace `100vh` viewport locks with `100dvh` and fallback for mobile address bars.
  - Add `@media (prefers-reduced-motion: reduce)` rules.
  - Add `:focus-visible` outlines for keyboard navigation.
- Update `public/index.html`:
  - Replace inline `onclick` handlers with modern event listeners.
  - Add ARIA attributes (`aria-expanded`, `aria-haspopup`, `aria-live`, `role="listbox"`, `role="option"`).
  - Add `<noscript>` fallback banner.
- Remove obsolete/dead files (`server.js`, `tokenGenerator.js`, old design explorations in `svg_icons/` or prune unused scripts).

## Phase 4: Verification & Final Acceptance
- Run full automated test suite.
- Verify `git grep` for leaked secrets.
- Verify syntax and lint across all JS files.
- Document deployment steps and `.dev.vars` usage in `README.md` and `CLOUDFLARE_DEPLOYMENT.md`.
