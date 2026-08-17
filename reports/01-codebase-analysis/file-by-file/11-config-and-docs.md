# FILE ANALYSIS — documentation set

**Files covered:** `README.md` (97 lines), `CLOUDFLARE_DEPLOYMENT.md` (66 lines), `future_enhancement.txt` (42 lines).

---

## `README.md` — accuracy audit

| README claim | Verified? | Notes |
|---|---|---|
| "Multi-Model Speech Engine: Deepgram Nova-3 (150ms), AssemblyAI Fast Realtime, AssemblyAI Universal-3.5 Pro" | ✅ code | All three wired in `index.js`/HTML; `universal-3-5-pro` verified against AssemblyAI docs |
| "AI & Rule-Based Grammar Corrector (`/api/grammar`)" | ⚠️ partially | Exists; the *quality* claims are contradicted by the code (C-06d: "me and him is → He and I are" — code produces "him and I is") |
| "Edit any previous word or sentence while live recording continues … without moving your cursor" | ⚠️ | True for committed text; false inside the live span (H-06) |
| "Pinned `language_code=en` … prevent accidental … Hindi" | ✅ | Both provider URLs pinned (commit `bdf7b9c`) |
| "Single-Window Viewport Lock: 100vh … desktop/mobile" | ⚠️ | Implemented; broken on mobile by the 100vh/dvh issue (responsive §1) |
| "Glassmorphism Dark UI … Outfit & Inter" | ✅ | Accurate |
| "Cloudflare Pages Serverless … /api/token, /api/deepgram-key, /api/grammar" | ✅ | All three exist |
| Model matrix: latencies & "1 Concurrent Stream" (AAI) / "100 Concurrent" (Deepgram) | ℹ️ | Provider-plan figures — not independently verifiable in this audit; consistent with AAI free-tier reputation |
| "Zero-Lag Audio Buffer Management … resetBuffer() flushes residual … eliminating initial latency bursts" | ⚠️ oversells | `resetBuffer()` clears a queue that would carry ≤100 ms of stale audio; "zero-lag" is marketing; the switch path it serves leaks pipelines (C-03) |
| Architecture tree (33-50) | ⚠️ drift | Omits `server.js`, `tokenGenerator.js`, `package.json`, `.eslintrc.js`, `svg_icons/` mention exists ✓, no `reports/` (this audit) — M-11 |
| Getting Started: clone → set secrets → `wrangler pages deploy` | ✅ | Works as documented (verified against file structure + wrangler.toml) |

**README gaps:** no local-development section (the H-10 trap — `yarn serve` isn't even mentioned, `wrangler pages dev` neither); no privacy statement (S-09); no troubleshooting (mic permission, session-conflict 1008 alert); no branch/PR workflow notes.

---

## `CLOUDFLARE_DEPLOYMENT.md` — accuracy audit

| Item | Verdict |
|---|---|
| Live URL `luminote-v2.pages.dev`, project `luminote-v2`, branch `cloudflare-v02` | ✅ internally consistent with wrangler.toml + git |
| `wrangler pages secret put` invocations | ✅ correct mechanism; ❌ embeds the real **account ID** (S-06) |
| Direct deploy command | ✅ matches README |
| Functions list | ✅ |
| Directory tree | ⚠️ same drift as README (M-11) |
| Deployment checklist | ✅-ish — all boxes checked are accurate but low-bar (no security/stability items; a "checklist" that can't fail is decoration) |

**Gaps:** no rollback story (`wrangler pages deployment list/rollback`), no custom-domain steps, no `_headers`/`_redirects` mention (they don't exist yet — S-05), no observability (where do `console.error`s go: `wrangler pages deployment tail`).

---

## `future_enhancement.txt` — Cross-Device Real-Time Relay (PIN & QR pairing)

A well-written concept doc (dated 2026-07-22): desktop display + phone mic, PIN/QR pairing, `<50ms` relay, Durable Objects/WebRTC options. Audit observations:

1. **Security requirements absent** from the proposal — pairing codes, room authorization, relay payload validation. These are retrofits if skipped (hardening plan §7 enumerates them).
2. **The `<50ms` latency budget** is optimistic for a relayed WS chain (phone→CF DO→desktop adds two hops to the ASR round trip); WebRTC P2P datachannels for audio + WS for control is the architecture that can actually hit it.
3. **Data model implication**: relayed transcripts cross devices → the zero-persistence posture (S-12) needs an explicit decision (device-scoped ephemerality vs relay retention).
4. **Build-order dependency**: most of this audit's critical/high fixes (session lifecycle, teardown correctness, reconnect UX) are prerequisites — the relay multiplies every lifecycle bug by two devices.

---

## DOCUMENTATION SCORECARD

| Doc | Accuracy | Completeness | Freshness |
|---|---|---|---|
| README.md | ★★★☆☆ (2 false claims, 1 oversell) | ★★★☆☆ | ✅ current with v02 |
| CLOUDFLARE_DEPLOYMENT.md | ★★★★☆ | ★★☆☆☆ | ✅ |
| future_enhancement.txt | n/a (proposal) | ★★★☆☆ (no security section) | ✅ |
| (missing) CONTRIBUTING / SECURITY.md / privacy notice | — | gaps | — |

**Highest-value doc fixes:** README local-dev section (wrangler pages dev + .dev.vars); correct the grammar-example claim; add SECURITY.md with the rotation incident note; privacy notice for LanguageTool; deployment doc account-ID scrub + rollback section.

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
