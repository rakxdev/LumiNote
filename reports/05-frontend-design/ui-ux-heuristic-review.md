# UI/UX HEURISTIC REVIEW — LumiNote v02

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Method:** Jakob Nielsen's 10 usability heuristics applied to the single-page interface (`public/index.html` + `public/styles.css` + behaviors in `public/index.js`), read as a complete interactive system. Static review (no live user sessions); interaction traces are derived from the code paths.

---

## SCORECARD

| # | Heuristic | Verdict | Key evidence |
|---|---|---|---|
| 1 | Visibility of system status | 🟡 Mixed | Good status pill + live-span styling; broken by silent stream death (H-04) and ghost "Connected" state (L-11) |
| 2 | Match between system and real world | 🟢 Good | "Turn", transcript-as-document metaphor, plain button labels |
| 3 | User control and freedom | 🔴 Poor | No undo for grammar (H-07), logo-click data loss (C-05), no cancel while connecting (H-02) |
| 4 | Consistency and standards | 🟡 Mixed | Toast vs alert split-brain (M-09); model naming drift (M-01/L-02) |
| 5 | Error prevention | 🔴 Poor | Grammar enabled mid-recording (M-07); destructive reload unguarded (C-05); live span editable trap (H-06) |
| 6 | Recognition rather than recall | 🟢 Good | Model dropdown with descriptions; icon+label buttons |
| 7 | Flexibility and efficiency of use | 🟡 Mixed | No keyboard shortcuts (no hotkey for record/copy); live model switching is a power feature done well *conceptually* |
| 8 | Aesthetic and minimalist design | 🟢 Strong | Clean single-purpose layout, restrained chrome (see design-system review) |
| 9 | Help users recognize/recover from errors | 🔴 Poor | alert()-based errors without recovery paths; silent no-op grammar (H-09) |
| 10 | Help and documentation | 🟡 Minimal | Tooltips only; placeholder carries the only onboarding; no help affordance |

Overall: a polished-feeling surface over fragile interaction plumbing. The visual design (heuristic 8) is the app's strongest UX asset; recovery paths (3, 9) are the weakest.

---

## H-1 · VISIBILITY OF SYSTEM STATUS

### What works
- **Status pill** (`styles.css:266-310`): three visual states (idle gray dot / recording red pulse / connected green) + text label synchronized to the model name — glanceable, correctly positioned in the header's information cluster.
- **Live turn styling** (`.live-turn`, `styles.css:414-418`): purple + dashed underline communicates "provisional" text distinctively — genuinely good pattern for interim transcripts.
- **Recording button morph** (mic ↔ stop square + gradient shift to red + pulse ring): standard, well-executed recording idiom.

### What breaks
- **Silent stream death** (H-04/C-04): when the provider closes mid-session, the pill flips to "Ready" while the mic stays hot and the user keeps talking. The single most damaging status lie in the app.
- **"Switching to X…" then nothing**: if the switch fails (H-01/H-02), status text stays stale; no terminal state distinguishes "switch failed" from "switching".
- **Ghost "Connected"** (L-11): a designed state users never see.
- **No audio-level indicator**: users get zero feedback that the mic hears them (crucial when permission settings route the wrong device). A tiny VU meter in the status pill during recording would resolve "is it me or the app?" — the most common support question for dictation apps.

## H-2 · MATCH WITH THE REAL WORLD

The transcript-as-a-document metaphor (editable like a text editor, "Fix Grammar" as a verb users already know) is right. "Turn" never surfaces to users (good — internal jargon stays internal). Model descriptions in the dropdown ("Ultra-fast 150ms real-time latency", "Deep voice agent model (Default)") speak the user's evaluation language. One nit: "Export" (button label) vs "Download" (tooltip) name the same action differently — pick one.

## H-3 · USER CONTROL AND FREEDOM

- **No undo anywhere it matters**: grammar replacement is irreversible (H-07); clearing is instant with no confirm (though Clear is disabled during recording — a good prevention, inconsistently applied vs grammar).
- **Logo = reload = data loss** (C-05): an anti-affordance in the app's most conventional click target.
- **Cannot cancel a connection attempt** (H-02): clicking Start commits the user to a disabled button until the network resolves.
- **Cannot stop-and-keep-draft across reload**: no persistence at all — refresh, crash, or OS kill loses everything (R-12's autosave addresses the class).

## H-4 · CONSISTENCY AND STANDARDS

- **Two error idioms**: polished toast (`showCopyFeedback`) for copy/grammar success/failure, blocking `alert()` for recording failures (M-09). Users meet two different design languages for the same conceptual event.
- **Three names per model** (M-01/L-02).
- **Standard idioms used correctly**: chevron dropdown, checkmark on active option, footer placement, focus ring on editor (custom but visible: `styles.css:400-403`).

## H-5 · ERROR PREVENTION

- Grammar mid-recording corrupts the document (M-07) — should be disabled or queued like Clear is.
- The live span invites edits it will destroy (H-06) — affordance mismatch: looks editable, punishes editing.
- Model switch during recording is *allowed* and advertised ("Live switching") but is the least-tested path in the codebase (C-03, H-01) — prevention would be disabling switching while recording (v1 behavior) until the switch path is hardened; power users can stop/start.
- Double-click "Fix Grammar" fires two full round trips and can interleave corrections — no debounce on the button (only a spinner class, no disabled state — actually `classList.add('loading')` spins the icon but the button stays clickable; the `finally` removes the class; concurrent calls are possible).

## H-6 · RECOGNITION OVER RECALL

Dropdown options carry icon + title + one-line description + checkmark — exemplary. Placeholder text teaches the core interaction ("Start recording or type your text here… You can edit any word while live transcribing!") — good onboarding-in-place. Word/character counts give ambient feedback of progress.

## H-7 · FLEXIBILITY AND EFFICIENCY

- **Missing shortcuts**: record start/stop is the app's primary action and has no keybinding (e.g., Ctrl/Cmd+Shift+R territory — or Space when editor unfocused). Copy could bind Ctrl+Shift+C; Export Ctrl+S (intercepting browser save with a download is a beloved pattern in note apps).
- **No text-selection actions**: select text → "fix just this" or "copy selection" would halve grammar round trips on long docs.
- **Live model switching** is the power feature; conceptually excellent (compare models on your own voice), execution tracked in C-03/H-01.
- **No session resume**: stopping ends everything; a "pause" (hold mic open, mute sends) is a natural dictation feature.

## H-8 · AESTHETIC AND MINIMALIST DESIGN

The strongest dimension. Single-purpose layout; header → editor → controls hierarchy is unmistakable; decorative elements (gradient wordmark, glass cards, glow accents) are concentrated in chrome, not content. The editor occupies the visual and physical center — correct for a transcription tool. Detailed aesthetic assessment in `design-system-review.md`.

## H-9 · ERROR RECOGNITION AND RECOVERY

Current error copy is generic and recovery-free:
- "Microphone permission denied. Please allow microphone access." — no path to the site-permissions UI, no link, no retry button (alert dismissal is the only affordance).
- "Failed to get authorization token. Please try again." — no retry action, no status of what to check.
- "Session conflict (Too many concurrent sessions). Please wait a moment and try again." — the best of the four (names cause + remedy), still an alert.
- Grammar silent no-op (H-09) — the worst class: success feedback for a failed operation.

Every error should offer the next action (retry button in the toast, deep-link hint for permissions, auto-retry with backoff for transient provider errors).

## H-10 · HELP AND DOCUMENTATION

None in-app. The README is developer-facing. For a tool aimed at spoken-language cleanup, a "?" affordance explaining (a) what Fix Grammar sends where (also the S-09 privacy disclosure), (b) the three models' practical differences, (c) that text lives only in this tab, would pre-empt the three most consequential misconceptions.

---

## INTERACTION TRACE SUMMARIES (derived from code)

**Trace 1 — happy path:** Load → tokens prefetch (invisible) → click Start → permission (first time) → "Recording (model)" + live span streams → click Stop → final commit → Copy (toast + tick). ✅ Works; feels modern; latency dominated by provider.

**Trace 2 — the reviewer's path:** Load → dictate 10 minutes → click logo to "go home" → **everything gone** → close tab in frustration. (C-05)

**Trace 3 — the switcher:** Record on default → switch to Deepgram mid-speech → garbled duplicates (C-03) → click Stop during the 300 ms window → recording restarts itself (H-01) → mic pill never clears (C-04).

**Trace 4 — the polisher:** Dictate with decimals and the word "like" → Fix Grammar → "3. 14", deleted "like"s → Ctrl+Z → **nothing** (H-07 + C-06).

---

## TOP TEN UX FIXES (ranked by harm prevented)

1. Guard or remove logo-reload (C-05).
2. Stop the mic on remote close + show "Connection lost — resume?" (C-04 + H-04).
3. Undo affordance for Fix Grammar (H-07).
4. Route all errors through the toast with retry actions (M-09 + H-9 above).
5. Disable grammar/switching during recording until hardened (M-07, H-5).
6. Make the live span visibly non-editable (H-06).
7. Autosave to localStorage + restore banner (R-12; converts all data-loss bugs into annoyances).
8. Cancel affordance during Connect (H-02).
9. Keyboard shortcuts for record/copy/export (H-7).
10. Fix auto-scroll hijack so users can re-read while recording (M-02).

---

*Analysis only — no source files were modified. Companion documents: `design-system-review.md`, `accessibility-audit.md`, `responsive-mobile-review.md`, `redesign-proposals.md`. Master index: `reports/README.md`.*
