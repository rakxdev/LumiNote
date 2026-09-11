# 🎙️ LumiNote — Vāk & Nāda Edition

LumiNote is a production-hardened, browser-native real-time speech intelligence studio. Deployed on **Cloudflare Pages**, it streams live microphone audio directly to advanced AI transcription models (AssemblyAI & Deepgram) via WebSockets, featuring zero-latency interactive editing and a dual-world architectural design.

![LumiNote Studio](public/logo.svg)

---

## ⚡ Architecture & Features (v03)

- 🕉️ **Vāk & Nāda Fusion Design:** A highly distinctive UI fusing RodeX technical precision with ancient Sanskrit acoustic philosophy. Features a seamless **Dark Mode (Obsidian & Brass)** and **Light Mode (Silk & Red Lacquer)** toggle.
- 🌊 **Kinetic Acoustic Visualizers:** Dual real-time audio oscilloscopes (header spectrum bars and background time-domain waveforms) that respond dynamically to voice activity at 60fps.
- 🔒 **Zero-Trust Ephemeral Auth:** No master API keys are exposed to the client. Cloudflare Functions securely mint on-demand temporary JWT grant tokens (~30s TTL) for WebSocket handshakes.
- 🔗 **Link Mode (v04):** Cross-device pairing — dictate on your phone and watch the text appear instantly on your desktop (or vice versa), with a Remote Clipboard tray for one-tap push between devices. Powered by a `SyncRoom` Durable Object with hibernating WebSockets (see `docs/decisions/ADR-003-link-mode-cross-device-sync.md`).
- 🎙️ **Leak-Free Audio Lifecycle:** Complete AudioWorklet and `MediaStream` teardown on model switches, remote disconnects, and browser unloads to prevent memory leaks and ghost streams.
- ✨ **Safe Grammar Engine:** Custom LanguageTool proxy with bespoke regex rules that preserve legitimate English (`like`, `had had`, `Node.js`, `ER`) while intelligently collapsing stuttered speech.
- 💾 **Local Draft Resilience:** Real-time autosaving to `localStorage` ensures transcripts survive accidental tab closures and browser crashes.
- 📱 **Fluid 100dvh Ergonomics:** Adapts flawlessly from 4K desktop scaling down to mobile 2x2 touch grids, utilizing `viewport-fit=cover` for notch/home-bar safety.

---

## 🚀 Speech Models

| Model | Provider | Latency | Target Use Case |
|---|---|---|---|
| **AssemblyAI Universal-3.5 Pro** *(Default)* | AssemblyAI Streaming v3 | ~300ms | High-accuracy contextual voice intelligence |
| **Deepgram Nova-3** | Deepgram Realtime v1 | ~150ms | Ultra-fast conversational interactions |
| **AssemblyAI Fast Realtime** | AssemblyAI Streaming v3 | ~180ms | Low-latency lightweight stream processing |

---

## 🛠️ Local Development & Testing

Built with pure vanilla JavaScript, native Web Audio APIs, and Node native test runners. Zero heavy frameworks.

```bash
# Run the 12-suite native unit tests
npm test

# Run local development server with Cloudflare Pages Functions
npm run dev
```

Create a `.dev.vars` file for local development:
```ini
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
```

### Link Mode (cross-device sync) local development

The sync backend is a companion Worker (`worker/`) because Pages projects
cannot define Durable Objects. Run both processes locally:

```bash
# Terminal 1: SyncRoom Durable Object
npm run dev:sync

# Terminal 2: Pages app + Functions
npm run dev
```

Deploy order matters — the Worker must exist before the Pages binding resolves:
```bash
npm run deploy:sync   # SyncRoom Durable Object (luminote-sync)
npm run deploy        # Pages app
```

---

## 🚀 Deployment to Cloudflare Pages

1. Set environment secrets securely via Wrangler:
```bash
npx wrangler pages secret put ASSEMBLYAI_API_KEY
npx wrangler pages secret put DEEPGRAM_API_KEY
```

2. Deploy the application:
```bash
npm run deploy
```

---

## 📚 Documentation
See the `docs/decisions` directory for Architecture Decision Records (ADRs) regarding the synthetic oscilloscope overlay and ephemeral WebSocket grant tokens.

## 📄 License
MIT License.
