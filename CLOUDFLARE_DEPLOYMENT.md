# Cloudflare Pages Deployment Guide (LumiNote v02)

This guide explains how to deploy LumiNote v02 to Cloudflare Pages with Functions.

---

## 🎯 Project & Deployment Info

* **Live Deployment URL**: [https://luminote-v2.pages.dev](https://luminote-v2.pages.dev)
* **Cloudflare Pages Project Name**: `luminote-v2`
* **Production Git Branch**: `cloudflare-v02`
* **Cloudflare Functions**:
  * `/api/token` — AssemblyAI WSS token generator
  * `/api/deepgram-key` — Deepgram API key gateway
  * `/api/grammar` — AI & Rule-based spoken English grammar engine

---

## 🚀 Deployment via Wrangler CLI

### 1. Set Secrets (Environment Variables)
Set your secret keys on Cloudflare Pages using Wrangler CLI:
```bash
# Set AssemblyAI API Key
CLOUDFLARE_ACCOUNT_ID="25bff71e7781196feac6d6e48b84e54c" CLOUDFLARE_API_TOKEN="[YOUR_TOKEN]" npx wrangler pages secret put ASSEMBLYAI_API_KEY --project-name=luminote-v2

# Set Deepgram API Key
CLOUDFLARE_ACCOUNT_ID="25bff71e7781196feac6d6e48b84e54c" CLOUDFLARE_API_TOKEN="[YOUR_TOKEN]" npx wrangler pages secret put DEEPGRAM_API_KEY --project-name=luminote-v2
```

### 2. Deploy Direct Build
```bash
CLOUDFLARE_ACCOUNT_ID="25bff71e7781196feac6d6e48b84e54c" CLOUDFLARE_API_TOKEN="[YOUR_TOKEN]" npx wrangler pages deploy public --project-name=luminote-v2 --branch=cloudflare-v02
```

---

## 📂 Project Directory Architecture

```
LumiNote/
├── public/                 # Static web asset directory
│   ├── index.html         # Main SPA UI
│   ├── index.js           # Multi-model client engine & audio processor
│   ├── audio-processor.js # 16kHz PCM AudioWorklet
│   ├── styles.css         # Glassmorphism CSS & 100vh Viewport Lock
│   ├── logo.svg           # Combined Monogram L & Constellation Logo
│   └── reset.css          # Global Reset
├── functions/             # Cloudflare Pages Serverless Functions
│   └── api/
│       ├── token.js       # AssemblyAI Token Gateway
│       ├── deepgram-key.js # Deepgram Key Gateway
│       └── grammar.js     # Serverless Grammar Correction API
├── svg_icons/             # SVG Icon Assets (Option 01 - 15)
├── wrangler.toml          # Cloudflare Pages Manifest
└── README.md              # Main Documentation
```

---

## ✅ Deployment Checklist

- [x] HTTPS enforced automatically on `*.pages.dev`
- [x] Serverless Functions responding at `/api/token`, `/api/deepgram-key`, `/api/grammar`
- [x] WebSockets connected over `wss://`
- [x] Multi-model support: Deepgram Nova-3, AssemblyAI Fast, AssemblyAI Universal-3.5 Pro
- [x] Single-window 100vh layout lock