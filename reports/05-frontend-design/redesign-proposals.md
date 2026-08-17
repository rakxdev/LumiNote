# FRONTEND REDESIGN PROPOSALS — LumiNote v02

- **Audit date:** 2026-08-16
- **Nature:** Forward-looking design proposals building on the existing visual language (dark glass + aurora gradient). These are *proposals* — nothing has been implemented. Each includes rationale, an ASCII wireframe where useful, and implementation notes sized to the current no-framework stack.

---

## PROPOSAL INDEX

| # | Proposal | Effort | Impact |
|---|---|---|---|
| D-01 | Status center: audio VU meter + connection health in the status pill | S | High — resolves the #1 dictation support question |
| D-02 | Turn-based transcript structure (visual paragraphs per turn) | M | High — readability for long sessions |
| D-03 | Command palette + shortcuts layer (record/copy/export/grammar/model) | M | High for power users |
| D-04 | Session timeline rail (scrubbable turn history) | L | Differentiating for meetings/lectures |
| D-05 | Settings popover: language, DSP toggles, autosave, reduced-motion | M | Completes the app shell |
| D-06 | Empty-state onboarding: 3-step first-run card | S | Medium — teaches live-editing |
| D-07 | Inline grammar diff review (before accepting corrections) | M | High — makes Fix Grammar trustworthy post-C-06 |
| D-08 | Light theme via the existing `data-theme` hook | M | Medium |
| D-09 | Keyboard-first record HUD (Space-to-toggle, Esc-to-cancel, waveform key light) | S | Medium |
| D-10 | Mobile: bottom-dock action bar replacing the stacked controls | M | High on mobile |

---

# D-01 — Status Center (VU meter + link health)

**Problem:** Users cannot tell (a) whether the mic hears them, (b) whether the network/provider is keeping up — the two silent failures behind most "it stopped transcribing" reports (H-04, M-05 make these real).

**Design:** Upgrade the status pill into a compound widget:

```
┌───────────────────────────────────────────────┐
│ ▮▮▮▮▮▮▯▯  ● Recording · Universal-3.5 Pro     │
└───────────────────────────────────────────────┘
   ↑ 5-bar input level      ↑ state + model
```

- Input level: 5 vertical bars driven from the worklet (RMS per 100ms chunk — data already flows through `microphone`'s callback; expose it with a second `port.onmessage` consumer or a shared `AudioLevel` shim).
- Link health: green dot = WS open + `bufferedAmount < threshold`; amber = buffering (M-05's signal); red = disconnected (with tap-to-reconnect, fixing H-04's dead end).
- Reduced-motion mode: bars collapse to a numeric dBFS readout.

**Implementation sketch:** pure DOM/CSS (5 `<span>`s with height classes) — ~40 lines JS, ~20 CSS. No new dependencies; pairs with the A-01 live-region fix (announce state changes once, not per frame).

---

# D-02 — Turn-structured transcript

**Problem:** The transcript is one growing `contenteditable` blob; long sessions become a wall of text; turn boundaries (the natural structure ASR already provides via `turn_order` / `is_final`) are discarded at render time.

**Design:** Each committed turn becomes its own paragraph block; interims stay in the trailing live span.

```
┌─ Transcript ────────────────────────────────┐
│ So I'll start with the quarterly numbers    │  ← turn 1 (p)
│ the revenue is up twelve percent Qo Q.      │  ← turn 2 (p, user-edited "QoQ")
│ ▁▁▁the margins are holding despite▁▁▁        │  ← live span (interim)
│                                             │
└─────────────────────────────────────────────┘
```

- Editing remains free-form (blocks are plain `<p>` in the same contenteditable).
- Enables per-turn hover actions later (re-dictate, delete turn) and makes D-04 possible.
- Directly mitigates P-09 (unbounded single-node layout) — bounded line boxes per paragraph.
- Implementation: `commitActiveTurn()` appends `<p>` instead of a text node (guard: caret restore after streaming commit only when user isn't mid-edit).

---

# D-03 — Command palette & shortcuts

**Shortcuts (immediate):**

| Keys | Action |
|---|---|
| Ctrl/Cmd+Shift+R | Toggle recording (browser's hard-reload is Ctrl+Shift+R *without* Cmd on mac — choose `R` single-key when editor unfocused, like dictation tools) |
| Ctrl/Cmd+Shift+C | Copy transcript |
| Ctrl/Cmd+S | Export .txt (intercept default) |
| Ctrl/Cmd+Shift+G | Fix grammar |
| ` (backtick) | Open model switcher (keyboard path also fixes A-04) |

**Palette (Cmd+K):** fuzzy list of actions + models + settings — the app is small enough that a 15-item list covers everything. Reuses dropdown styling; ~100 lines vanilla JS.

---

# D-04 — Session timeline rail

**Design:** A thin horizontal rail under the editor header; each committed turn is a tick segment proportional to its audio duration (AssemblyAI turns carry `words[].start/end` ms — data already arrives and is discarded).

``│ Recording 04:12 ─────────────────────── ●───────``
- Click a tick → editor scrolls to that turn (D-02 prerequisite).
- Hover → timestamp + first words tooltip.
- Marks network gaps (from D-01's health log) as hatched segments — "you lost transcription here".

This is the feature that turns LumiNote from "a transcription box" into "a session tool" — and 100% of its data is already on the wire.

---

# D-05 — Settings popover

Glass dropdown (same component as the model switcher) off a ⚙ in the header:

- Language (today hard-locked `en` — the README documents Hindi-misfire history `bdf7b9c`; expose `language_code` once multi-language models are wired)
- DSP toggles: echo cancellation / noise suppression / autoGain (P-18's constraints, user-controllable)
- Autosave on/off (R-12)
- Reduced motion: system / on / off (pairs with A-05)
- "What is sent where" — the privacy disclosure S-09 requires (LanguageTool, providers)

---

# D-06 — First-run empty state

Replace the bare placeholder with a dismissable 3-card strip inside the editor area (only when transcript empty AND never recorded):

```
┌────────────┐ ┌────────────┐ ┌────────────┐
│ 🎙️ 1.Record │ │ ✏️ 2.Edit   │ │ ✨ 3.Polish │
│ Tap Start… │ │ Fix any…   │ │ One click… │
└────────────┘ └────────────┘ └────────────┘
```
One-time flag in `localStorage`; disappears on first recording. Solves A-08's vanishing-instruction problem.

---

# D-07 — Grammar diff review

Post-C-06, the safe grammar UX is *review before replace*:

```
┌ Review corrections ─────────────────────────┐
│ …revenue is up 12 percent ~~qoq~~ → QoQ…    │
│ ~~like~~ → [removed]         [keep] [drop]  │
│                              [Apply all] ✕  │
└─────────────────────────────────────────────┘
```
- Client computes a word-level diff (simple LCS — no dependency, ~60 lines) between sent and corrected text.
- Render deletions/insertions with `ins/del` styling in the existing toast-card idiom.
- Apply → targeted DOM edits (preserves undo per H-07's deeper fix).

---

# D-08 — Light theme

The `data-theme="dark"` hook (L-01) + token architecture make this a ~12-token re-point (design-system §10.3). Sequence: `prefers-color-scheme` default → manual toggle in D-05 → persist in `localStorage`. The aurora background becomes two soft violet tints on `#f7f8fc`; glass layers lose `backdrop-filter` (poor legibility on light) in favor of solid tints + stronger borders.

---

# D-09 — Recording HUD micro-behaviors

- **Space toggles recording when the editor is unfocused** (with 300ms hold-to-prevent accidental page-scroll triggers on mobile keyboards).
- **Esc cancels a pending connection** (H-02's affordance).
- **Key light:** while recording, a 2px gradient underline on the editor's top border slowly sweeps (pure CSS animation) — ambient "capturing" signal that replaces the pulse ring under reduced motion (A-05 alternative that conveys state without pulsing).

---

# D-10 — Mobile bottom dock

Replace the ≤900px stacked controls with a fixed-feeling dock pinned above the keyboard-safe area:

```
┌─ editor (fills) ────────────────┐
│ …transcript…                    │
│                                 │
├─────────────────────────────────┤
│ [Clear] [Copy] [Export] [✨Fix] │   ← 4 icon-buttons, 44px
│ ┌─────────────────────────────┐ │
│ │      ●  Stop Recording      │ │   ← full-width, thumb zone
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```
- Uses `env(safe-area-inset-bottom)` padding.
- Icons + labels swap at 320px (icons only, `aria-label`s).
- Native-app feel; standard in mobile dictation tools (Otter, Voice Recorder); pairs with the 100dvh fix.

---

## WHAT *NOT* TO ADD (explicit non-goals)

- **No framework migration** (React/Vue/Svelte) — at this size, the vanilla stack is an asset (7 KB of app JS); the pain points are fixable in place.
- **No CSS-in-JS / utility-framework migration** — the token system needs formalizing (design-system §10), not replacing.
- **No dashboard/multi-document UI** yet — the single-session focus is the product's clarity; persistence (R-12) should come as autosave-restore, not a documents manager, until users ask.

---

## PROPOSED SEQUENCING

1. Fix tier first (see `08-recommendations/prioritized-action-plan.md`) — proposals assume C-03/C-04/C-05/H-06 are closed.
2. D-01 + D-06 + D-09 (small, high-visibility).
3. D-02 (unblocks D-04) + D-10.
4. D-05 + D-07 + D-08.
5. D-03 (palette) + D-04 (timeline) as v03 flagship work alongside the cross-device relay from `future_enhancement.txt`.

---

*Proposals only — no source files were modified. Master index: `reports/README.md`.*
