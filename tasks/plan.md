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

---

# Implementation Plan: LumiNote v04 — Link Mode (Cross-Device Sync)

*Appended 2026-09-12 on branch cloudflare-v04. The v03 plan above is complete-in-code
(server.js retired, noscript present, 100dvh in styles, tests exist) though its checklist
was never ticked; it is preserved as history.*

## Overview
Real-time cross-device relay: pair a desktop and a phone over the same site via a 6-char
room code (QR + manual entry). Dictation committed on one device appears live in the other
device's editor; a clipboard push button sends text to the paired device's Remote Clipboard
tray. Audio still streams device→ASR directly; only small JSON messages flow through a
Durable Object room.

## Architecture Decisions
- Cloudflare Durable Object `SyncRoom` in a companion Worker (`worker/`) — Pages cannot
  define DOs (official docs); Pages Function `/api/link/ws` proxies the WS upgrade.
- Hibernatable WebSockets + SQLite snapshot so idle rooms are free and late joiners catch up.
- Room code generated client-side (the code IS the credential); 12h sliding TTL via DO alarm.
- Clipboard: push-based; auto-copy attempted when document has focus, tray with one-click
  copy is the guaranteed fallback (Safari gesture requirement).
- QR via vendored MIT `qrcode-generator` (CSP allows 'self' scripts only).

## Task List
- [ ] Task 0: Local JS runtime for verification (Node 22) — `npm test` baseline passes.
- [ ] Task 1 (TDD): Fix PCM batch duplication — extract `appendPcmChunk` into
      audio-processor.js, test proves no double-sent tail, index.js uses it.
- [ ] Task 2: SyncRoom DO worker (protocol validation, presence, snapshot, TTL alarm,
      hibernatable WS) + protocol unit tests + `wrangler deploy --dry-run` check.
- [ ] Task 3: `/api/link/ws` Pages Function proxy (upgrade guard, room-code validation,
      stub passthrough) + DO binding in wrangler.toml.
- [ ] Task 4: Client pairing UI (header LINK button, modal with QR + code, join input,
      status pill, reconnect/backoff) + vendored QR lib.
- [ ] Task 5: Live relay + Remote Clipboard tray (turn append via commit path, throttled
      interim preview, clipboard push both directions, auto-copy attempt).
- [ ] Task 6: Local end-to-end runtime verification (two-client fan-out through DO).
- [ ] Task 7: ADR-003 + README/DESIGN + tasks docs update.
- [ ] Task 8: Deploy (worker + Pages) + live verification (two-client fan-out against prod).

## Checkpoints
- After Task 1: full suite green, no regression in audio path.
- After Tasks 2-3: DO + Function dry-runs pass, protocol tests green.
- After Tasks 4-5: `node --check` on all client JS, suite green.
- After Task 6: end-to-end local proof before any deploy.
- After Task 8: live two-client fan-out proof.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| No JS runtime in env | Blocks all verification | Install Node 22 locally to ~/tools (no sudo) |
| No Cloudflare credentials | Blocks deploy/live-verify | Document blocker; deliver local-verified state |
| DO binding cross-script on Pages | Feature broken in prod | Use script_name binding; verify via dry-run + docs |
| QR lib vendoring fails | Pairing UX degraded | Manual code entry always available as fallback |
