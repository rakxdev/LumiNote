# 🎙️ LumiNote — Vāk & Nāda Edition

LumiNote is a production-hardened, browser-native real-time speech intelligence studio. Deployed on **Cloudflare Pages**, it streams live microphone audio directly to advanced AI transcription models (AssemblyAI & Deepgram) via WebSockets, with zero-latency interactive editing, a durable saved library, cross-device Link Mode, and optional authenticator login. Single-user by design: built for founders, creators, and writers who dictate notes, essays, drafts, or prompts and keep them.

![LumiNote Studio](public/logo.svg)

---

## ⚡ Architecture & Features (v4.4)

- 🕉️ **Vāk & Nāda Fusion Design:** A highly distinctive UI fusing RodeX technical precision with ancient Sanskrit acoustic philosophy. Seamless **Dark Mode (Obsidian & Brass)** and **Light Mode (Silk & Red Lacquer)** toggle.
- 🌊 **Voice Meters That Tell the Truth:** A 12-bar header pill driven by dB-mapped, log-spaced FFT bands with fast-attack/slow-release response — and the *second* device's pill follows the recording device's voice via tiny loudness frames relayed over the link. Silence shows a faint breathing floor, never a fake wave (see `docs/decisions/ADR-001`).
- 🔗 **Link Mode:** Cross-device pairing — dictate on your phone and watch the text appear instantly on your desktop (or vice versa). `SyncRoom` Durable Object with hibernating WebSockets, snapshot catch-up for late joiners, and a sliding 12h room lifetime (see `docs/decisions/ADR-003`). The session survives page refreshes, stays alive through a 25s heartbeat, and recovers with jittered backoff plus tap-to-retry.
- 📋 **Push, Both Places:** The clipboard Push button lands the payload in the receiving device's transcript editor *and* its Remote Clipboard tray, instantly; fresh pushes are captured as clips.
- 💾 **Durable Saved Library (D1):** Notes, clipboard clips, and transcript sessions stored in Cloudflare D1 and browsable in hash-routed `#/notes`, `#/clips`, `#/transcripts` views — navigation happens inside the page, so an active recording survives it. Pin (pinned sort first), copy, and delete on every entry; finishing a dictation auto-saves its transcript (see `docs/decisions/ADR-004`).
- 🔐 **Authenticator Login (optional):** Protect device linking with a 6-digit TOTP code from Google/Microsoft Authenticator: scan a QR in the Link dialog, confirm, keep 8 one-time recovery codes. The link socket refuses unauthenticated upgrades; a verified browser is remembered for 12h (see `docs/decisions/ADR-005`).
- 📜 **One Version Source:** `public/changelog.json` drives the `/changelog` page and the header version seal, and must match `package.json` (enforced by tests).
- 📦 **Self-Contained Frontend:** All fonts (4 families, latin/latin-ext/devanagari subsets) and the animation library are served from the app — zero third-party requests — and every asset sends `Cache-Control: no-cache`, so browsers can never serve stale files.
- 🔒 **Zero-Trust Ephemeral Auth:** No master API keys are exposed to the client. Cloudflare Functions mint on-demand temporary grant tokens for the STT WebSocket handshakes; a second AssemblyAI key can be routed per speech model server-side.
- 🎙️ **Leak-Free Audio Lifecycle:** Complete AudioWorklet and `MediaStream` teardown on model switches, remote disconnects, and browser unloads, plus a tail flush so the last word is never clipped.
- ✨ **Safe Grammar Engine:** Custom LanguageTool proxy (server-side) with bespoke regex rules that preserve legitimate English (`like`, `had had`, `Node.js`, `ER`) while intelligently collapsing stuttered speech.
- 🎚️ **Quiet-Voice Accuracy:** Sessions pinned to English (`language_codes`), VAD threshold lowered for soft speech, Voice Focus (near-field) suppressing background audio, and browser mic auto-gain.
- 💾 **Local Draft Resilience:** Real-time autosaving to `localStorage` ensures transcripts survive accidental tab closures and browser crashes.
- 📱 **Fluid 100dvh Ergonomics:** Adapts flawlessly from 4K desktop scaling down to mobile, utilizing `viewport-fit=cover` for notch/home-bar safety.

---

## 🚀 Speech Models

| Model | Provider | Latency | Target Use Case |
|---|---|---|---|
| **AssemblyAI Universal-3.5 Pro** *(Default)* | AssemblyAI Streaming v3 | ~300ms | High-accuracy contextual voice intelligence |
| **Deepgram Nova-3** | Deepgram Realtime v1 | ~150ms | Ultra-fast conversational interactions |
| **AssemblyAI Fast Realtime** | AssemblyAI Streaming v3 | ~180ms | Low-latency lightweight stream processing |

---

## 🛠️ Local Development & Testing

Built with pure vanilla JavaScript, native Web Audio APIs, and the Node native test runner. Zero heavy frameworks.

```bash
# Run the test suite (11 files, 86 tests)
npm test

# Lint
npm run lint

# Local dev server with Cloudflare Pages Functions
npm run dev
```

Create a `.dev.vars` file (never commit it — it is gitignored; see `.dev.vars.example`):
```ini
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
ASSEMBLYAI_API_KEY_2=optional_second_key_for_alt_models
DEEPGRAM_API_KEY=your_deepgram_api_key
```

The D1 binding works locally out of the box; apply the schema once:
```bash
npx wrangler d1 execute luminote-db --local --file db/schema.sql
```

### Link Mode local development

The sync backend is a companion Worker (`worker/`) because Pages projects
cannot define Durable Objects. Run both processes locally:

```bash
# Terminal 1: SyncRoom Durable Object
npm run dev:sync

# Terminal 2: Pages app + Functions
npm run dev
```

---

## 🚀 Deployment to Cloudflare Pages

1. Set environment secrets securely via Wrangler:
```bash
npx wrangler pages secret put ASSEMBLYAI_API_KEY
npx wrangler pages secret put ASSEMBLYAI_API_KEY_2   # optional
npx wrangler pages secret put DEEPGRAM_API_KEY
```

2. Create the D1 database once and put its id in `wrangler.toml`, then apply the schema:
```bash
npx wrangler d1 create luminote-db
npx wrangler d1 execute luminote-db --remote --file db/schema.sql
```

3. Deploy — the Worker must exist before the Pages DO binding resolves:
```bash
npm run deploy:sync   # SyncRoom Durable Object (luminote-sync)
npm run deploy        # Pages app
```

Releases: bump `public/changelog.json` (new entry) and `package.json` together — the test suite enforces that they agree, and the header seal derives its label from the changelog.

---

## 📚 Documentation
See `docs/decisions/` for the Architecture Decision Records: the voice-meter design (ADR-001), ephemeral STT grant tokens (ADR-002), Link Mode's Durable Object architecture (ADR-003), the D1-backed library (ADR-004), and authenticator login (ADR-005).

## 📄 License
MIT License.
