# ADR-005: Authenticator Login (TOTP) Gating Device Linking

## Status
Accepted

## Date
2026-09-13

## Context
Link Mode's room code (ADR-003) is a bearer credential anyone can type if
learned, and the product increasingly moves personal text between devices and
now persists it (ADR-004). The user wanted account-style protection without
accounts: enroll once by scanning a QR with an authenticator app (Google /
Microsoft Authenticator), then present a 6-digit code when connecting
devices. Constraints:

- No user database, no passwords, no sessions tables to manage.
- Must work on the existing Cloudflare Pages + Functions stack with zero
  third-party identity providers.
- The phone (host) and desktop (joiner) are different browsers; typing the
  code on every connect would be hostile.
- If the authenticator is lost, the user must not be locked out.

## Decision
1. **TOTP (RFC 6238, 6 digits / 30s, SHA-1) via the `otpauth` package.**
   Enrollment generates a 20-byte secret (base32) stored in the D1
   `app_settings` table (ADR-004); the otpauth URI is rendered as a QR by the
   already-vendored QR renderer. Confirmation requires one valid token, at
   which point login is active and 8 one-time recovery codes are returned
   exactly once — only their SHA-256 hashes are stored, and each successful
   use burns its hash.
2. **Signed cookie instead of per-request codes.** A successful code check
   (`/api/auth/challenge`) sets an `HttpOnly; Secure; SameSite=Strict` cookie
   valid for 12 hours — deliberately matching the room TTL, so a linked pair
   never has to re-verify mid-session. The signature is HMAC-SHA256 **keyed
   with the TOTP secret itself**, so forging the cookie requires the same
   secret the authenticator holds and no second server-side secret needs
   provisioning or rotation.
3. **The gate lives in the Pages Function proxy** (`/api/link/ws`): once
   login is confirmed, WebSocket upgrades without a valid cookie get a 401
   JSON response. While login is not set up, the socket behaves exactly as
   before — opting in is a user action, not a deploy flag. While unconfirmed,
   re-enrollment is allowed; once confirmed it is refused (resetting requires
   a deliberate `wrangler d1 execute` DELETE, so a thief cannot silently
   replace the secret).
4. **The client treats the gate as UX, not security.** Before connecting,
   `connect()` awaits a status check; if the cookie is missing the Link
   dialog prompts for a fresh code, and a successful verify either unblocks
   the waiting connect or resumes a paused session (e.g. after a reload).
   The prompt accepts exactly 6 digits and also accepts a recovery code
   (burned server-side).

## Alternatives Considered

### Passkeys / WebAuthn
- Pros: Phishing-resistant, no shared secret, modern UX.
- Cons: Platform authenticators are per-device; syncing a passkey to the
  *second* device reliably requires a password-manager ecosystem the user
  may not have, and the described mental model was explicitly the
  authenticator-app code. Rejected for now; the cookie gate is independent
  of the factor and a passkey factor could be added later.

### Long-lived pairing tokens per device
- Pros: Type nothing after first pairing.
- Cons: A stored token on each device is exactly the "one more password
  file" problem; TOTP covers untrusted devices with zero storage. Rejected.

### Cloudflare Access / Zero Trust
- Pros: Managed identity in front of the whole app.
- Cons: Requires an identity provider and seats management for a personal,
  free deployment; also gates reading the studio, not just linking. Rejected.

## Consequences
- **Positive:** Linking (and the text path it carries) is protected by
  something in the user's pocket, with recovery codes as the break-glass;
  verified browsers stay friction-free for 12 hours.
- **Positive:** The entire security core (token window ±1, code normalization,
  hash burn-once, cookie sign/verify/expiry, constant-time compares) is pure
  code with unit tests; the Functions stay thin key/value + cookie glue.
- **Negative:** A lost authenticator *and* lost recovery codes require a
  manual server-side reset (documented: `DELETE FROM app_settings`).
- **Neutral:** The cookie TTL equals the room TTL by design; expiry and room
  death therefore coincide, and one re-verify covers both.
