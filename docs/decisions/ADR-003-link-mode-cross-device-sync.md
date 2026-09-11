# ADR-003: Link Mode Cross-Device Sync via Companion-Worker Durable Object

## Status
Accepted

## Date
2026-09-12

## Context
LumiNote needed a cross-device flow: dictate on the phone, watch the transcript
appear instantly on the desktop editor (and vice versa), plus a clipboard push
between devices. Constraints:

- The app is deployed on **Cloudflare Pages**; Pages Functions are stateless, so
  two devices hitting two Function invocations cannot see each other.
- **Pages projects cannot define Durable Objects** — official docs require a
  separate Worker that exports the class, bound to the Pages project.
  Source: https://developers.cloudflare.com/pages/functions/bindings/
- The v03 security posture (no accounts, no master keys client-side, ephemeral
  credentials) must carry over.
- Idle cost must stay at zero for a free, no-account product.

## Decision
1. **SyncRoom Durable Object in a companion Worker** (`worker/`, deployed as
   `luminote-sync`). One DO instance per room via `idFromName(roomCode)`. The
   Pages Function `/api/link/ws` validates the room code and passes the
   WebSocket upgrade straight through (`stub.fetch(request)`).
2. **Hibernation WebSocket API** (`state.acceptWebSocket` + `webSocketMessage` /
   `webSocketClose` handlers + per-socket `serializeAttachment`). Idle rooms
   hibernate — connections stay open at Cloudflare's edge without billing
   duration.
   Source: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
3. **SQLite snapshot per room** (last committed text + last clipboard push) so
   devices joining late catch up. Clients only apply snapshot text onto an
   empty local editor, so local drafts are never clobbered.
4. **The room code is the credential**: 6 characters from an unambiguous
   32-letter alphabet (~1e9 space), generated client-side (no room-creation
   endpoint to abuse), QR deep link (`/?join=CODE`) or typed entry. Rooms cap
   at 4 devices and expire via a sliding 12h DO alarm that reaps sockets and
   storage. Nothing persists after expiry.
5. **Push-based clipboard**: senders push explicitly (Push button); receivers
   attempt `navigator.clipboard.writeText` only when the document has focus,
   and always surface a Remote Clipboard tray with a one-click Copy button —
   Safari requires a user gesture, so guaranteed silent auto-copy from a
   socket event is impossible on the web.

## Alternatives Considered

### PartyKit
- Pros: Wraps Durable Objects with nicer DX (`partykit deploy`, `partysocket`).
- Cons: Adds a CLI, dependency, and a second deploy target for a primitive the
  raw DO already provides; Cloudflare itself acquired PartyKit, confirming DOs
  are the underlying platform primitive.
- Rejected: Raw DO is ~200 lines and dependency-free.

### Ably / Pusher / Supabase Realtime / Firebase
- Pros: Fastest to build, managed fan-out.
- Cons: Free-tier connection caps, external API keys, third party in the text
  path; conflicts with the zero-account, self-hosted-on-Cloudflare ethos.
- Rejected.

### KV/D1 polling
- Pros: No WebSockets needed.
- Cons: 1–5s lag and constant request burn; not "instant".
- Rejected.

### WebRTC peer-to-peer
- Pros: No relay cost after signaling.
- Cons: Needs a signaling channel (a server anyway) plus STUN/TURN handling;
  complexity unjustified for 2 devices.
- Rejected.

## Consequences
- **Positive:** Instant (~50–100ms) text relay; zero idle cost via hibernation;
  no accounts; audio never transits our infra (it still streams
  device→ASR directly); snapshot gives late joiners full context.
- **Positive:** The sync worker also routes `/join` directly, enabling
  standalone dev (`npm run dev:sync`) and miniflare end-to-end tests
  (`tests/e2e-link.test.js`).
- **Negative:** A second deployable (`npm run deploy:sync` before
  `npm run deploy`) — the DO binding is cross-script and must exist first.
- **Negative:** The room code is brute-forceable in principle; acceptable for a
  free personal tool (guessing requires a WebSocket per attempt and yields
  only live transcript text). If abuse appears, add Cloudflare rate limiting
  or a Turnstile check on the proxy Function.
- **Neutral:** Relay is append-only text; each device remains the authority
  over its own editor (no CRDT/OT in v04).
