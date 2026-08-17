# SYSTEM ARCHITECTURE — LumiNote v02

- **Audit date:** 2026-08-16
- **Deployment:** Cloudflare Pages (static `public/`) + Pages Functions (`functions/api/*`) + two third-party streaming ASR providers.

---

## 1. COMPONENT DIAGRAM

```
┌──────────────────────────── BROWSER (single tab, all state) ────────────────────────────┐
│                                                                                          │
│  public/index.html ── inline onclick ──▶ window.* exports (index.js:709-717)             │
│        │                                        │                                        │
│        ├── reset.css + styles.css               ▼                                        │
│        ├── anime.js (cdnjs)           public/index.js                                    │
│        │                               ├── UI state (updateRecordingState)               │
│        │                               ├── TokenManager ───────────┐                     │
│        │                               ├── Model switcher logic    │                     │
│        │                               ├── createMicrophone() ────┼──▶ AudioWorklet      │
│        │                               ├── editor reconciliation  │   (audio-processor   │
│        │                               │   (baseText/live span)   │    .js, 16kHz→PCM16)│
│        │                               └── dual WS clients ───────┼─────────┐           │
│        │                                                             │         │           │
└────────┼────────────────────────────────────────────────────────────┼─────────┼───────────┘
         │ same-origin HTTPS                                           │         │ WSS + PCM
         ▼                                                             │         ▼
┌── CLOUDFLARE EDGE ──────────────────────────────────────────────────┘   ┌── PROVIDERS ──┐
│  Pages static assets (public/*)                                        │  │ AssemblyAI    │
│  Pages Functions (V8 isolates):                                        │  │  v3/ws        │
│   /api/token ──── mint ────────────────────────────────────────────────┼─▶ streaming    │
│   /api/deepgram-key ── returns MASTER KEY (C-02) ◀─── env var          │  │ universal-3.5 │
│   /api/grammar ──▶ LanguageTool public API (third hop)                 │  │ universal-…   │
│                                                                        │  ├───────────────┤
│  env secrets: ASSEMBLYAI_API_KEY, DEEPGRAM_API_KEY                     │  │ Deepgram      │
└────────────────────────────────────────────────────────────────────────┘  │  nova-3 /v1/  │
                                                                           │  listen       │
                                                                           └───────────────┘
```

Also present, off the deployed path: `server.js` + `tokenGenerator.js` (Node/Express local server — broken parity, H-10).

---

## 2. ARCHITECTURAL STYLE & ASSESSMENT

| Property | Choice | Verdict |
|---|---|---|
| Frontend | No-framework vanilla JS, one file | ✅ right-sized (716 lines, no build). Refactor to ES modules when it crosses ~1200 lines or the session object lands |
| State | Module globals + DOM-as-truth | ⚠️ the source of the C-03/H-01 class — no single owner of "a recording session" |
| Backend | File-routed Pages Functions | ✅ idiomatic; each function stateless |
| Secrets | Env secrets server-side | ✅ for AAI / ❌ for Deepgram (served onward) |
| Realtime | Direct browser→provider WSS | ✅ lowest latency path (no relay hop); ❌ requires per-provider auth handling in the browser (the root of S-02) |
| Third-party grammar | Server-side proxy to public LanguageTool | ⚠️ shared-IP rate limits (H-09) + privacy (S-09); fine at hobby scale |
| Persistence | **None** — transcript lives only in the DOM | ⚠️ deliberate? every data-loss bug is total (C-05, H-05, tab close) |
| Observability | console.* in functions; nothing client-side | ❌ no error telemetry; production debugging is `wrangler tail` only |

---

## 3. THE FIVE ARCHITECTURAL SEAMS WHERE BUGS CONCENTRATE

Every critical/high bug in this audit clusters at one of these seams — the map for any refactor:

1. **Session lifecycle ownership** (C-03, C-04, H-01, H-04, H-05, M-13): `{ws, microphone, model, turnState}` are three module globals torn down by *four different code paths* (user stop, live switch, remote close, page unload) with inconsistent completeness. **Fix shape:** one `Session` object with `start()`, `stop(reason)`, `switchModel()`, all teardown funneled through `stop()`.
2. **Editor truth reconciliation** (H-06, H-07, P-03, M-07): three writers of `baseText`/DOM with three derivation strategies. **Fix shape:** single `EditorState` module exposing `applyInterim()`, `commitTurn()`, `replaceAll(text, {undoable})`, owning stats+scroll as derived views.
3. **Credential provisioning** (C-01, C-02, C-07, M-06, S-10): two providers, two *different* (one right, one wrong) patterns. **Fix shape:** every provider auth flows through a server-minted ephemeral token, fetched at session start.
4. **External-failure signaling** (H-04, H-09, M-09, M-14): provider/endpoint failures surface as silence, fake success, or alerts. **Fix shape:** typed outcome objects (`{ok, degraded, reason}`) end-to-end + one toast/error channel.
5. **Stream-pacing vs render-pacing** (P-01, P-02, P-07, M-02): WS message cadence drives layout work directly. **Fix shape:** rAF-batched render from state (the state being seam #2's).

---

## 4. DATA FLOW — RECORDING PATH (annotated)

```
[User click] toggleRecording
   └─▶ startRecording
        ├─ getUserMedia ────────────────────────── mic permission (prompt once)
        ├─ [AAI] TokenManager.getToken ─▶ GET /api/token ─▶ CF fn ─▶ GET streaming.assemblyai.com/v3/token
        ├─ [DG ] getDeepgramKey ────────▶ GET /api/deepgram-key ─▶ CF fn ─▶ env/literal (C-02)
        ├─ new WebSocket(wss://provider?…&token=…)          ← 1-3 RTT, no preconnect (N-05)
        │     onopen ─▶ microphone.startRecording(cb)
        │                  └─ AudioWorklet: 128-sample quanta → (bugs: P-12/P-13/H-08)
        │                        → main-thread queue → 100ms chunks → ws.send(Uint8Array)
        │     onmessage ─▶ Turn/Results → activeTurnText → renderTranscript()
        │                        └─ liveSpan.textContent = … (interim)  ──▶ scroll+stats (P-01/02)
        │                     turn_order change / is_final ─▶ commitActiveTurn() ─▶ text node
        └─ UI: status pill / button state / clear-disabled
[User click stop] stopRecording
   └─ Terminate/CloseStream → ws.close()  (immediately — H-05 loses finals)
      mic.stopRecording() ✅ → commitActiveTurn() ✅ → state reset
```

---

## 5. DEPLOYMENT TOPOLOGY

- **Branch → environment:** `cloudflare-v02` → production (`luminote-v2.pages.dev`); direct-upload deploys via wrangler (no CI integration evidenced — no GitHub Actions files in repo).
- **Rollback:** manual redeploy only (no documented procedure).
- **Environments:** single production; no preview/staging (preview deployments exist by Pages default for git-connected projects — this repo uses direct upload per docs, so no).
- **Locality:** static assets at edge; functions at edge (region-agnostic); providers in their own regions (US for both, presumably — latency budget in network report).

---

## 6. CAPACITY & SCALE CHARACTERISTICS

| Dimension | Current ceiling | Binding constraint |
|---|---|---|
| Concurrent users (recording) | AAI free tier: ~1 stream (per README); Deepgram: ~100 | Provider plans |
| Concurrent users (idle tabs) | ~unlimited static; 50s/token/tab → Pages fn allowance | C-07's waste (fix first) |
| Grammar throughput | ~20 req/min shared (LanguageTool per-IP) | H-09 |
| Transcript length per session | DOM growth (P-09) + LanguageTool 20 KB (H-09) | both fixable |

---

## 7. TARGET ARCHITECTURE (post-fix, proposal)

Minimal-change target preserving the no-build frontend:

```
Browser:
  index.js → { Session } + { EditorState } + { providers/aai.js, providers/dg.js } + ui.js
  Session owns: mic pipeline, ws, model id, reconnect/backoff, teardown (single path)
  Auth: token minted at session start for both providers (uniform)

Edge:
  /api/token        (unchanged shape, + rate rule)
  /api/dg-token     (new: grant-token mint)
  /api/grammar      (+ size cap, timeout, degraded contract, optional KV)
  _headers          (security headers)
```

This is deliberately *not* a rewrite: it re-homes the same logic into objects with single-ownership seams, which by construction eliminates bug classes C-03/C-04/H-01/H-06 rather than patching their symptoms.

---

*Analysis only — no source files modified. Companion: `data-flow-and-state-machine.md`. Master index: `reports/README.md`.*
