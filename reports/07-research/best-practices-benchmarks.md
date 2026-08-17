# BEST-PRACTICES BENCHMARKS — LumiNote vs Industry Standards

- **Date:** 2026-08-16/17 · LumiNote's implementation benchmarked against current web-platform best practice per area (sources: MDN, W3C/WAI, web.dev, provider docs — itemized in `web-research-findings.md`).

---

## A. REAL-TIME AUDIO CAPTURE

| Practice | Standard | LumiNote | Gap |
|---|---|---|---|
| AudioWorklet over ScriptProcessor | modern baseline | ✅ worklet | — |
| Saturating Int16 conversion | universal DSP convention | ❌ wraps (H-08) | fix |
| Zero-copy transfer (`postMessage(buf, [buf])`) | standard | ❌ clones (P-13) | fix |
| Buffer at worklet, send ≤10 fps | common streaming pattern | ❌ 125 msgs/s (P-15) | optimize |
| Explicit DSP constraints in getUserMedia | recommended | ❌ `{audio:true}` (P-18) | add |
| Warm context inside user gesture | autoplay-policy-safe | ⚠️ pre-gesture + un-awaited resume (M-04) | fix |

## B. STREAMING ASR CLIENTS

| Practice | Standard | LumiNote | Gap |
|---|---|---|---|
| Handle all protocol messages incl. errors/close frames | provider SDKs do this | ❌ Turn/Results only (H-04) | fix |
| Graceful close = terminate → drain finals → close | documented flow | ❌ immediate close (H-05) | fix |
| Reconnect w/ backoff or user-visible resume | resilience baseline | ❌ none | add |
| Single pipeline per session (no leaks) | correctness 101 | ❌ leaks on switch (C-03) | fix |
| `bufferedAmount` backpressure | WS hygiene | ❌ (M-05) | add |
| Ephemeral tokens only in browser | both providers' guidance | ⚠️ AAI yes / DG no (C-02) | fix DG |

## C. EDITING / CONTENTEDITABLE

| Practice | Standard | LumiNote | Gap |
|---|---|---|---|
| textContent (not innerText) for programmatic reads | perf 101 | ❌ innerText hot-path (P-01) | fix |
| rAF-coalesce high-frequency renders | standard | ❌ (P-07) | fix |
| Undoability of programmatic edits | UX baseline | ❌ innerText= (H-07) | fix |
| Placeholder robust to `<br>` (`:has(> br:only-child)`) | known pitfall | ❌ (H-11) | fix |
| Protect live region from caret | live-caption pattern | ❌ (H-06) | fix |

## D. SECURITY HEADERS & CSP

| Practice | Baseline (web.dev/OWASP) | LumiNote | Gap |
|---|---|---|---|
| CSP | table stakes for public apps | ❌ none | add (S-05) |
| HSTS / nosniff / frame-options / referrer-policy | table stakes | ❌ none | add |
| Permissions-Policy `microphone=(self)` | apt for mic apps | ❌ | add |
| SRI on third-party scripts | standard | ❌ (S-08) | add/self-host |
| Same-origin-only APIs (no ACAO *) | first-party baseline | ❌ wildcard ×3 (S-03) | remove |
| Secrets: env-only, rotate-on-leak | absolute | ❌ literal + exposed (S-01/02) | **critical** |
| Input size caps + timeouts server-side | API hygiene | ❌ (S-07/F-03/F-04) | add |

## E. ACCESSIBILITY (WCAG 2.2)

| Criterion | LumiNote | Gap |
|---|---|---|
| 4.1.3 Status messages (live regions) | ❌ | A-01 |
| 2.1.1 Keyboard (dropdown) | ❌ | A-04 |
| 2.4.7 Focus visible (outline:none w/o replacement) | ❌ one control | A-03 |
| 1.4.3 Contrast | ⚠️ 2 borderline pairs | A-11 |
| 2.3.3 / C39 reduced motion | ❌ | A-05 |
| 1.4.1 Not color-alone (status dot) | ⚠️ text-adjacent (passes with A-01) | A-02 |

## F. PERFORMANCE (web.dev vitals lens)

| Area | Baseline | LumiNote |
|---|---|---|
| Render-blocking 3rd-party CSS | avoid/self-host | ❌ Google Fonts sheet (N-03) |
| Preconnect to critical origins | standard | ⚠️ fonts only, not WSS origins (N-05) |
| Layout thrash in hot loops | avoid | ❌ P-01/P-02 |
| dvh on mobile app-shells | current baseline | ❌ 100vh (responsive §1) |
| overscroll-behavior containment | text-app standard | ❌ missing (responsive §4) |
| Total JS | <150 KB ungz app | ✅ ~40 KB incl. anime.js — strong |

## G. ENGINEERING PROCESS

| Practice | Baseline | LumiNote |
|---|---|---|
| Lint in CI | universal | ❌ (tools exist, unwired) |
| Any tests | universal | ❌ |
| Secret scanning | standard since ~2020 | ❌ |
| Single package manager | universal | ❌ dual lockfiles |
| Autosave for text apps | user-expectation | ❌ zero persistence |

---

## SCORING SUMMARY

| Domain | Score | One-line |
|---|---|---|
| Audio capture architecture | B- | Right modern stack, wrong details (clamp/transfer/gesture) |
| ASR client correctness | D+ | Message handling and teardown below provider-SDK standard |
| Security posture | F | Critical credential exposure; zero headers |
| Accessibility | D+ | Landmarks/labels good; live regions/keyboard/motion missing |
| Performance | C+ | Tiny payload & composited animations; hot-path layout thrash |
| Visual design system | A- | Genuinely above standard for the category |
| Process/tooling | D | Nothing runs automatically |

**Overall: a strong v0.2 design layer over a v0.1 reliability layer.** The gap between the two is consistent across every dimension measured.

---

*Master index: `reports/README.md`.*
