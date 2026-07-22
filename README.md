# 🎙️ LumiNote v02 — Real-Time Voice Intelligence Engine

A state-of-the-art, multi-model real-time voice transcription web application built with **AssemblyAI Universal-3.5 Pro**, **Deepgram Nova-3**, Cloudflare Serverless Functions, interactive live text editing, and an AI-powered grammar correction engine.

![LumiNote Banner](public/logo.svg)

---

## ⚡ Key Highlights in v2

- 🚀 **Multi-Model Speech Engine**: Seamlessly switch between **Deepgram Nova-3 (150ms latency)**, **AssemblyAI Fast Realtime**, and **AssemblyAI Universal-3.5 Pro**.
- ✨ **AI & Rule-Based Grammar Corrector (`/api/grammar`)**: 1-Click **"✨ Fix Grammar"** button converts broken spoken English into clean, professional, grammatically correct text.
- ✏️ **Interactive Live Editing**: Edit any previous word or sentence while live speech recording continues in real time without moving your cursor.
- 🔒 **English Language Enforcement**: Pinned `language_code=en` parameters prevent accidental auto-switching to foreign scripts or Hindi.
- 📐 **Single-Window Viewport Lock**: 100vh fixed desktop/mobile viewport with zero outer page scrollbars. Only the text editor container scrolls.
- 🎨 **Glassmorphism Dark UI**: Built with `Outfit` & `Inter` typography, neon status indicators, and centered glowing toast notifications.
- ⚡ **Cloudflare Pages Serverless Backend**: Powered by zero-latency Cloudflare Pages Functions (`/api/token`, `/api/deepgram-key`, `/api/grammar`).

---

## 📊 Speech Model Matrix

| Model Name | Provider | Real-Time Latency | Primary Use Case | Free Tier Concurrency |
| :--- | :--- | :--- | :--- | :--- |
| **Deepgram Nova-3** *(Default)* | Deepgram | ⚡ **150ms - 200ms** | Ultra-fast real-time streaming ($200 credit) | 🚀 **100 Concurrent Streams** |
| **AssemblyAI Fast Realtime** | AssemblyAI | ⚡ **180ms - 250ms** | Fast verbatim transcription (v01 speed) | ⚠️ 1 Concurrent Stream |
| **AssemblyAI Universal-3.5 Pro** | AssemblyAI | 🧠 **450ms - 800ms** | Deep voice agent & complex terminology | ⚠️ 1 Concurrent Stream |

---

## 🛠️ Architecture & Serverless Stack

```
LumiNote/
├── functions/
│   └── api/
│       ├── token.js        # AssemblyAI WSS Token Generator
│       ├── deepgram-key.js # Deepgram Credentials Gateway
│       └── grammar.js     # AI & Rule-based Spoken Grammar Engine
├── public/
│   ├── index.html          # Single-Page App HTML
│   ├── index.js            # Client-side Real-time Engine & AudioWorklet Manager
│   ├── audio-processor.js  # AudioWorklet 16kHz PCM Streamer
│   ├── styles.css          # Glassmorphism Design System & Viewport Lock
│   ├── logo.svg            # Combined Monogram L & Constellation Logo
│   └── reset.css           # CSS Reset
├── svg_icons/              # Raw SVG icon library (Options 01 - 15)
├── wrangler.toml           # Cloudflare Pages deployment manifest
└── README.md              # Project Documentation
```

---

## 🚀 Getting Started

### 1. **Clone the Repository**
```bash
git clone -b cloudflare-v02 https://github.com/rakxdev/LumiNote.git
cd LumiNote
```

### 2. **Set Up Secrets / Environment Variables**
For Cloudflare Pages deployment, set the following secrets in your Cloudflare dashboard or via Wrangler:
```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
```

### 3. **Deploy to Cloudflare Pages via Wrangler CLI**
```bash
npx wrangler pages deploy public --project-name=luminote-v2 --branch=cloudflare-v02
```

---

## 🎯 Features Deep-Dive

### 1. **Interactive Live Text Editing Engine**
* Completed turns are converted into standard DOM text nodes.
* Active interim turns stream strictly into a dedicated `#liveTurnSpan` pinned to the bottom of the container.
* Editing earlier sentences while talking leaves your selection and cursor untouched.

### 2. **AI Grammar Engine (`POST /api/grammar`)**
* Combines LanguageTool API checking with rule-based broken English cleanup rules.
* Filters out spoken filler words (*"uh"*, *"um"*, *"like"*), fixes subject-verb agreement (*"me and him is"* $\rightarrow$ *"He and I are"*), and formats sentence punctuation.

### 3. **Zero-Lag Audio Buffer Management**
* Pre-created 16kHz `AudioContext` with background token pre-fetching.
* `microphone.resetBuffer()` flushes residual AudioWorklet ring buffers during live model switches, eliminating initial latency bursts.

---

## 📄 License & Attribution

* **License**: MIT License
* **Author**: Rakesh Kumar ([@rakxdev](https://github.com/rakxdev))
* **Live App**: [https://luminote-v2.pages.dev](https://luminote-v2.pages.dev)
