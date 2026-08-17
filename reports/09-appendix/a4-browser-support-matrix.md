# APPENDIX D — Browser & Platform Support Matrix

- Purpose: the app's de-facto support window derived from the APIs it uses, with per-API baseline versions. Source: platform baseline data verified during the audit (MDN compat + engine release notes). No dynamic testing was performed.

---

## D.1 REQUIRED APIS — BASELINES

| API | Chrome | Edge | Firefox | Safari | Baseline (approx) | Notes |
|---|---|---|---|---|---|---|
| `AudioContext(sampleRate, latencyHint)` | 35+ | 79+ | 25+ | 14.1 (iOS 14.5+) | 2021 | sampleRate override honored; iOS resamples internally on older versions |
| `AudioWorklet`/`AudioWorkletNode` | 66+ | 79+ | 76+ | 14.1+ | 2021 | **hard requirement** — no fallback in app (M-08) |
| `registerProcessor` | 66+ | 79+ | 76+ | 14.1+ | 2021 | |
| `navigator.mediaDevices.getUserMedia` (promise) | 53+ | 79+ | 36+ | 11+ (11.1 iOS) | 2018 | needs secure context ✅ pages.dev |
| WebSocket (binary) | forever | | | | 2011 | ✅ |
| `navigator.clipboard.writeText` | 66+ | 79+ | 63+ | 13.1+ | 2020 | secure context + focus; fallback absent (catch → toast) |
| `URL.createObjectURL`/Blob | forever | | | | 2011 | ✅ download path |
| `AbortSignal.timeout` (proposed fixes) | 103+ | 103+ | 100+ | 15.4+ | 2022 | ✅ viable (F-03/kits) |
| `Intl.Segmenter` (proposed M-12) | 87+ | 87+ | 125+ | 14.1+ | 2022 | Firefox late — keep split fallback |
| `100dvh` (proposed responsive fix) | 108+ | 108+ | 101+ | 15.4+ | 2023 | @supports fallback covers older |
| `:has()` (proposed H-11 fix) | 105+ | 105+ | 121+ | 15.4+ | 2023 | prefer `br:only-child` variant at floor |
| `prefers-reduced-motion` | 74+ | 79+ | 63+ | 10.1+ | 2021 | ✅ |
| `overscroll-behavior` | 63+ | 79+ | 59+ | 16+ | 2022 | Safari late (16.0) — graceful degradation (iOS 16+ only) |

**De-facto support floor of current code: Chrome 66 / Safari 14.1 / Firefox 76 (mid-2021 engines).** Everything the app uses is available there; the *proposed* fixes all fall within a 2022-2023 floor with fallbacks written.

## D.2 PLATFORM BEHAVIOR CAVEATS (derived & documented, apply per test matrix)

| Platform | Behavior | App impact | Reference |
|---|---|---|---|
| iOS Safari | AudioContext created outside gesture starts `suspended`; `resume()` must be awaited in a gesture chain | M-04 (first-words silence; aggravated on iOS) | autoplay policy |
| iOS Safari | Backgrounding suspends audio rendering; WS may remain open | silence streamed upstream; no visibilitychange handler (responsive §5) | platform behavior |
| iOS Safari | 100vh = large viewport → bottom cut with visible toolbars | record button below fold (responsive §1) | viewport units |
| Android Chrome | dynamic toolbar; pull-to-refresh on overscroll | transcript wipe (responsive §4) | overscroll |
| Chrome desktop | dual mic indicator states (tab pill + OS) | C-04 visibility | |
| Firefox | `scrollbar-width/color` honored (Chrome ignores) | scrollbar parity (design §5) | |
| Safari | SVG favicon: OK in 9+ tabs; homescreen needs PNG | L-16 | |
| Any | `contenteditable` + `:empty` placeholder breaks after manual delete leaving `<br>` | H-11 | known pitfall |
| Any | `innerText` reads force layout; cloneNode of editor is O(n) | P-01/P-03 | |
| Windows/Linux | `background-attachment: fixed` repaint cost on scroll; body locked → inert | design §2 | |

## D.3 SUPPORT POLICY PROPOSAL (optional)

Given the API floor: declare **"evergreen browsers, last 2 major versions"** (matches the existing `browserslist` intent — L-07). Concretely:

- Chrome/Edge ≥ 106, Firefox ≥ 105, Safari ≥ 15.4 (≈2022) — covers all proposed fixes natively except Safari's `overscroll-behavior` (16+).
- Communicate floor via README ("Requires a current browser — Chrome, Edge, Firefox, Safari (2022+); needs mic access").
- Feature-gate AudioWorklet (M-08) with a graceful message below the floor instead of silent failure.

## D.4 AUDIO DEVICE TABLE (P-18 context)

| Constraint | Chrome | Firefox | Safari | App value |
|---|---|---|---|---|
| echoCancellation default | on (audio: true) | on | on | unspecified = mixed |
| noiseSuppression default | on | on | on | unspecified |
| autoGainControl default | on | on | on | unspecified |
| explicit constraints + channelCount:1 | honored | partial (some ignored) | honored | P-18 fix |
| 16 kHz `sampleRate` on getUserMedia constraint | honored | ignored (60s+ issue history) | honored | rely on AudioContext resampling instead ✅ (current design) |

---

*Appendix to the LumiNote audit. No source files modified. Master index: `reports/README.md`.*