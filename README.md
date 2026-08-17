# 🎙️ LumiNote v03 — Real-Time Speech Intelligence

LumiNote is a production-hardened, browser-native real-time voice dictation app deployed on **Cloudflare Pages**. It streams live microphone audio via WebSockets to AI transcription models and features zero-latency interactive transcript editing.

![LumiNote Banner](public/logo.svg)

---

## ⚡ What's New in v03 (Production Hardening)

- 🔒 **Ephemeral Grant Auth:** Replaced static exposed keys with on-demand temporary session tokens (~30s TTL for Deepgram, 10m TTL for AssemblyAI).
- 🎙️ **Leak-Free Audio Lifecycle:** Complete audio pipeline teardown on model switches, remote disconnects, and unloads.
- ✨ **Safe Grammar Cleanup:** Fixed grammar rules to preserve legitimate English words (`like`, `had had`, `Node.js`, `ER`).
- 🛡️ **Edge Security Headers:** Strict Content-Security-Policy (CSP), HSTS, and X-Content-Type-Options via `_headers`.
- 📱 **Mobile Responsive 100dvh:** Full viewport containment eliminating mobile address bar clipping.
- ♿ **Full WCAG Accessibility:** Proper ARIA live regions, semantic elements, and keyboard navigability.
- 🧪 **Native Test Suite:** Automated unit tests covering grammar rules, audio conversions, and state management.

---

## 🚀 Speech Models

| Model | Provider | Latency | Target Use Case |
|---|---|---|---|
| **AssemblyAI Universal-3.5 Pro** *(Default)* | AssemblyAI Streaming v3 | ~300ms | High-accuracy voice agents & dictation |
| **Deepgram Nova-3** | Deepgram Realtime v1 | ~150ms | Ultra-fast conversational interactions |
| **AssemblyAI Fast Realtime** | AssemblyAI Streaming v3 | ~180ms | Low-latency stream processing |

---

## 🛠️ Local Development & Testing

```bash
# Run unit tests
npm test

# Run local development server with Cloudflare Pages Functions
npm run dev
```

Create a `.dev.vars` file for local development:
```ini
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
```

---

## 🚀 Deployment to Cloudflare Pages

1. Set environment secrets in your Cloudflare Pages project:
```bash
npx wrangler pages secret put ASSEMBLYAI_API_KEY
npx wrangler pages secret put DEEPGRAM_API_KEY
```

2. Deploy the application:
```bash
npm run deploy
```

---

## 📄 License
MIT License.
