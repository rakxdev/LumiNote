# ADR-002: Ephemeral Grant Tokens for Secure WebSocket Authentication

## Status
Accepted

## Date
2026-08-17

## Context
LumiNote requires real-time, low-latency WebSocket connections to third-party transcription providers (Deepgram and AssemblyAI) directly from the client browser. 

Initially, the application served the master API keys (e.g. `DEEPGRAM_API_KEY`) to the client via an unauthenticated endpoint (`/api/deepgram-key`), exposing the master billing key to anyone inspecting the network tab.

Furthermore, when migrating to JWT tokens, passing the JWT via the WebSocket `Sec-WebSocket-Protocol` subprotocol header array (e.g. `new WebSocket(url, ['token', JWT])`) caused immediate `401 Unauthorized` and `Connection Closed` errors (ReadyState 3) from Deepgram. Browser WebSocket implementations frequently truncate or block excessively long subprotocol strings.

## Decision
1. **Never serve Master API Keys to the client.** The frontend has zero access to long-lived credentials.
2. **Use Server-Side Token Minting.** The Cloudflare Pages Functions (`/api/deepgram-token` and `/api/token`) hold the Master Keys in secure environment variables and use them to mint short-lived (~30s TTL) ephemeral JWT access tokens.
3. **Pass Tokens via URL Parameters for WebSockets.** Instead of the subprotocol array, the JWT is passed directly in the URL query string (`wss://api.deepgram.com/v1/listen?...&access_token=JWT`).

## Alternatives Considered

### Proxying WebSocket traffic through Cloudflare Workers
- **Pros:** Keeps all third-party URLs hidden from the client.
- **Cons:** Adds unnecessary mid-stream proxy latency to a pipeline where sub-150ms latency is the primary feature; dramatically increases Cloudflare Worker execution time and billing costs.

### Short-Lived Standard API Keys
- **Pros:** Keys are short enough to fit in the subprotocol header.
- **Cons:** Providers often hard-limit the number of API keys that can be generated per day (e.g., Deepgram limits to 250/day). JWT grant tokens are unlimited.

## Consequences
- **Security:** Complete elimination of key exposure.
- **Reliability:** Fixing the subprotocol token rejection guarantees seamless connection handshakes on all mobile and desktop browsers.
- **Maintenance:** Requires deploying to a true serverless environment (Cloudflare Pages) rather than running as a pure static HTML file, as backend token minting is strictly required.
