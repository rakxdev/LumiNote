# LumiNote: Design System & Visual Authority (v4.4)

## Mode
**Operate Mode:** High-precision speech intelligence studio fusing RodeX technical specimen architecture, Neo-Mirai Wabi-Sabi grid balance, and ancient Sanskrit acoustic philosophy (*Vāk & Nāda*).

## Visual Identity & Sacred Principles

### 1. Dual-World Chromatic Strategy
- **🌙 Dark Mode ("RodeX Obsidian & Brushed Brass"):**
  - Base: `#0a0c0f` deep carbon with subtle structural gridlines.
  - Chassis & Panels: `#0f1217` and `#080a0e` with milled borders (`#1f242d`).
  - Accents: Technical brushed brass gold (`#d9b64a`), signal vermilion red (`#e8452c`), and sacred emerald (`#10b981`).
- **☀️ Light Mode ("Wabi-Sabi Silk & Red Lacquer Seal"):**
  - Base: `#f4efe6` warm textured washi paper.
  - Ink & Text: `#1c1814` rich sumi ink.
  - Accents: Red lacquer seals (`#b91c1c`) with solid tactile drop shadows (`6px 6px #2b2621`).

### 2. Typographic Hierarchy (fully self-hosted, latin/latin-ext/devanagari)
- **Technical Display & Numerals:** `JetBrains Mono` & `Chakra Petch` for telemetry, status stamps, and model selectors.
- **Classical Speech Inscription:** `Martel` for the central live drafting canvas.
- **Sacred Inscriptions:** `Yatra One` for Sanskrit glyphs (*ॐ*, *नादब्रह्म*).

### 3. Iconic Visual Artifacts
- **Acoustic Yantra Logo:** Custom SVG monogram combining technical calipers, diamond Yantra geometry, and the soundwave origin Bindu.
- **Devanagari Telemetry Pillar:** Vertical side rail reading *नादब्रह्म* (Sound is the Divine Vibration).
- **RodeX Packet Seal:** Top corner version stamp, derived from `changelog.json` (e.g. `SPEC v04.4 • VERIFIED`).
- **Voice Meter Pill:** 12 dB-mapped bars in the top bar — fast attack, slow release, breathing floor in silence; follows the *remote* device's voice while linked.
- **Link Pairing Chassis (v04):** Modal dialog with QR seal on white quiet-zone (scannable in both worlds), mono room code in brushed brass, sliding TTL status dot (amber linking → emerald linked → vermilion error), and the authenticator setup/gate panels.
- **Remote Clipboard Tray (v04):** Fixed chassis card with emerald `REMOTE CLIPBOARD` stamp; incoming pushes surface here *and* flow into the editor, with one-tactile-copy.
- **Saved Library Views (v4.3):** Hash-routed `#/notes`, `#/clips`, `#/transcripts` panels with pin/copy/delete rows — the studio view and library swap by opacity-safe `hidden` toggling while the audio graph keeps running.
- **Changelog Page (/changelog):** Standalone obsidian page rendering `changelog.json` in Keep a Changelog style; the same file feeds the packet seal.

### 4. Zero-Slop Execution
- Zero third-party requests on load (fonts and anime.js self-hosted); CSP allows no external origins.
- Always-revalidate cache headers — a stale client is a solved problem.
- Seamless, persistent Theme Toggle between Dark and Light mode (`localStorage`).
- Fully responsive on mobile with `100dvh` viewport lock.
