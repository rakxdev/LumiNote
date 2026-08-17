# Spec: LumiNote v03 Hardening and Stability Overhaul

## Objective
Upgrade LumiNote from branch `cloudflare-v02` to `cloudflare-v03` by resolving all audit findings (Security, Bugs, Performance, Accessibility, Architecture). Success means:
1. Zero secrets/keys in client code or public endpoint responses (mint ephemeral grant tokens instead).
2. Clean audio pipeline and WebSocket lifecycles (no orphaned mic streams on switch, disconnect, or unmount).
3. Grammar correction preserves legitimate words (e.g. "like", "had had", "Node.js", "ER").
4. Reliable token management with zero wasteful continuous background polling.
5. High accessibility (ARIA, keyboard navigation, focus indicators) and responsive mobile viewport support (`100dvh`).
6. Automated unit tests proving fixes for grammar rules, audio processing, and session state.

## Tech Stack
- Frontend: Vanilla JavaScript (ES2022+), HTML5 AudioWorklet, CSS3 (Custom properties, `dvh`), Anime.js
- Backend/Edge: Cloudflare Pages Functions (V8 runtime, standard Web APIs `fetch`, `Response`, `Request`)
- Testing: Node.js native test runner (`node:test`, `node:assert`)
- Providers: AssemblyAI Streaming v3, Deepgram Nova-3 API, LanguageTool v2 API

## Commands
- Build/Dev: `npx wrangler pages dev public`
- Test: `node --test tests/**/*.test.js`
- Lint: `npx eslint .`
- Deploy: `npx wrangler pages deploy public`

## Project Structure
```
functions/
  api/
    token.js              → Mint AssemblyAI ephemeral streaming token
    deepgram-token.js     → Mint Deepgram ephemeral grant token (~30s TTL)
    grammar.js            → LanguageTool proxy with safe, non-destructive cleanup rules
public/
  index.html              → Semantic HTML, ARIA attributes, noscript banner, CSP-ready
  index.js                → Session-managed client architecture (Audio, WebSockets, EditorState)
  audio-processor.js      → AudioWorklet with sample clamping & ArrayBuffer transfer
  styles.css              → Responsive design with dvh fallback, focus-visible, reduced motion
  _headers                → Strict Cloudflare security headers (CSP, HSTS, X-Content-Type-Options)
tests/
  grammar.test.js         → Verification of cleanSpokenEnglish rules matrix
  audio-processor.test.js → Verification of PCM conversion & clamping logic
  session-state.test.js   → Session state machine transitions and cleanup
tasks/
  plan.md                 → Implementation roadmap & vertical slices
  todo.md                 → Discrete tracking checklist
```

## Code Style
- Vanilla ESM for Cloudflare functions; modular vanilla JS for frontend.
- Strict input validation before processing.
- Explicit try/catch error handling with graceful degraded fallbacks.
- Example:
```javascript
export async function onRequest(context) {
  const key = context.env.DEEPGRAM_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "Deepgram API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/token", {
      method: "POST",
      headers: { Authorization: `Token ${key}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`Deepgram auth failed with status ${res.status}`);
    const data = await res.json();
    return new Response(JSON.stringify({ token: data.token }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to mint token" }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
}
```

## Testing Strategy
- Framework: `node:test` (zero external dependencies).
- Coverage targets:
  - `cleanSpokenEnglish` matrix: all 25+ cases in Appendix A.
  - AudioWorklet math: float32 -> Int16 clamping (-1.0 to 1.0 limits).
  - Endpoint contracts: proper error responses when env vars missing or bad payloads sent.

## Boundaries
- **Always do:**
  - Run all unit tests before committing each slice.
  - Write entire, complete files (no snippets, no placeholders).
  - Verify changes via test execution output.
  - Commit after every verified phase with clear git messages.
- **Ask first:**
  - Changing cloud provider accounts or external architectures.
- **Never do:**
  - Hardcode any secret key, token, or fallback credential.
  - Leave background timers polling without active usage.
  - Use alert() popups for error messaging.

## Success Criteria
1. `git grep "2b2fe3bc"` returns 0 results.
2. Unit test suite passes 100% cleanly (`node --test tests/**/*.test.js`).
3. Switching models mid-recording stops the previous audio context and tracks properly.
4. "Fix Grammar" preserves "I like pizza", "had had", "Node.js", and "ER".
5. Cloudflare Pages headers include CSP, HSTS, and X-Frame-Options.
6. Mobile layout avoids address bar clipping using `100dvh`.
