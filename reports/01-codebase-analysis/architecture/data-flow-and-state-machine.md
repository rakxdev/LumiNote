# DATA FLOW & STATE MACHINES — LumiNote v02

- **Audit date:** 2026-08-16
- **Purpose:** Formalize the implicit state machines the code operates, then show where the implemented transitions diverge from the safe set. This is the analysis behind the C-03/C-04/H-01/H-02 bug family.

---

## 1. RECORDING SESSION STATE MACHINE — AS IMPLEMENTED

Variables involved: `isRecording`, `ws.readyState`, `microphone != null`, UI status text, `recordButton.disabled`.

```
                    ┌────────────────────────────────────────────────┐
                    │ IDLE                                            │
                    │ isRecording=false, ws=null, mic=null, "Ready"   │
                    └──────┬─────────────────────────────────────────┘
                       click Start (button.disabled=true)
                           ▼
                    ┌────────────────────────────────────────────────┐
                    │ CONNECTING                                     │
                    │ mic: getUserMedia → token → new WebSocket      │
                    │ "Connecting (Model)…"                          │
                    └──────┬─────────────────────────────────────────┘
              onopen ──────┼──────────── onerror ──── no timeout ❌ (H-02)
                  ▼         ▼            
        ┌───────────────────────────┐   → IDLE (mic NOT stopped ❌ C-04 family on error path)
        │ RECORDING                  │
        │ mic streaming → ws.send    │◄─────────────────────────┐
        │ "Recording (Model)"        │                          │ │
        └──────┬─────────┬──────────┘                          │ │
     click Stop│         │ provider onclose / onerror           │ │
               ▼         ▼                                      │ │
        ┌────────────┐  ┌──────────────────────────────┐        │ │
        │ STOPPING   │  │ IDLE-with-live-mic ❌ (C-04)  │        │ │
        │ Terminate  │  │ isRecording=false            │        │ │
        │ ws.close   │  │ mic still capturing          │────────┘ │
        │ mic.stop ✅ │  │ status "Ready" (a lie)       │  user clicks Start:
        │ commit ✅  │  └──────────────────────────────┘          │ mic ref may leak if
        └─────┬──────┘                                            │ non-null (C-03 seed)
              ▼
            IDLE
```

**Extra transition the code allows (should not):** from RECORDING, model switch:

```
RECORDING ──selectCustomModel──▶ SWITCHING
   ├─ resetBuffer (queue only)
   ├─ close old ws
   └─ setTimeout(300) ──▶ startRecording()  ──▶ CONNECTING…
        ❌ old mic never stopped (C-03)
        ❌ timer not cancellable: Stop during window → IDLE → timer fires → RECORDING (H-01 race A)
        ❌ second switch schedules a second timer (H-01 race B)
```

### Safe target machine (proposal)

```
IDLE ⇄ CONNECTING ⇄ RECORDING ⇄ SWITCHING → CONNECTING …
  * every non-IDLE state has ONE teardown path (Session.stop)
  * CONNECTING has a timeout → IDLE with user-visible reason
  * SWITCHING awaits old ws 'close' event (with 500ms cap) instead of fixed 300ms
  * remote close/error from RECORDING → Session.stop('remote') → IDLE + reconnect affordance
  * page hide/unload → Session.stop('unload')
```

---

## 2. EDITOR STATE RECONCILIATION — AS IMPLEMENTED

Truth holders: DOM children of `#message`; derived `baseText`; `activeTurnText`; `currentTurnOrder`; plus the dedicated `#liveTurnSpan`.

```
                    ┌──────────────────────────────────────────────┐
   ASRC interim ───▶│ liveSpan exists? no → create (+ space guard) │
   (Turn.transcript │                    yes → textContent = text  │──▶ scroll+stats
   / Results)       └──────────────────────────────────────────────┘
        │
   is_final / turn_order change
        ▼
   commitActiveTurn: span → text node (prefix space), baseText := DOM.innerText
        │
        ├── user types (input event) ──▶ onEditorInput:
        │        liveSpan present? clone editor → strip span → baseText := clone.innerText
        │        else baseText := innerText                    ❌ H-06: edits *inside* span lost
        │                                                     ❌ P-03: clone cost
        │
        └── fixGrammar success ──▶ DOM.innerText = corrected   ❌ H-07: undo/caret destroyed
                                 (baseText := corrected)
```

**Invariant violations in the current implementation:**
1. `baseText` can disagree with DOM (e.g., after user edits inside the live span — derived value excludes text visible on screen).
2. The DOM can contain the live span at rest (if a turn's last message was interim-only and stop happens mid-flush — commit handles it, but only via `stopRecording`'s explicit call; remote-close path skips commit).
3. No transaction boundary — writers interleave (ASR append + user edit + grammar replace), last-writer-wins per node.

**Safe target (proposal):** `EditorState { committed: Turn[], live: string, userOverlay: Map<range, edit> }` with the DOM as a pure projection; all three current writers go through it; stats/scroll derived views; `replaceAll` stores undo entry.

---

## 3. TOKEN/KEY LIFECYCLE — AS IMPLEMENTED

```
page load ─▶ fetchToken() + getDeepgramKey()          (M-06/N-02: eager)
every 50s ─▶ fetchToken()  ❌ C-07 (one-time-use tokens; 600s life)

AAI session start ─▶ getToken(): valid(55s)? token : fetch     ← lifetime constants disagree (55 vs 600)
DG  session start ─▶ cached key (forever)                       ← M-06
```

**Target:** mint-at-session-start for both providers; no background interval; failures surface in UI (seam #3 in the architecture report).

---

## 4. MESSAGE PROTOCOL STATE MACHINES (per provider)

### AssemblyAI v3 (from docs + code)

```
client ── (connect ?token&speech_model&…) ──▶ server
client ◀─ Begin {id, expires_at}              ❌ ignored (H-04)
client ◀─ Turn {turn_order, transcript, end_of_turn?, turn_is_formatted?}  ✅ partially handled
client ── binary PCM (100ms) ──▶
client ── {"type":"Terminate"} ──▶
client ◀─ Turn (final)                        ❌ never awaited (H-05)
client ◀─ Termination {audio_duration_seconds,…} ❌ ignored (H-04)
```

### Deepgram (from code)

```
client ── (connect, subprotocol ['token', key]) ──▶
client ◀─ Metadata                              ❌ ignored (benign)
client ◀─ Results {is_final?, speech_final?, channel…}  ✅ Results handled; speech_final unused
client ── {"type":"CloseStream"} ──▶
client ◀─ Results (final flush)                 ❌ never awaited (H-05)
   (server may also send {"type":"Error"} — ❌ ignored)
```

---

## 5. UI STATE MATRIX (status pill × button)

Implemented combinations and their reachability:

| `updateRecordingState(rec, conn, custom)` | Pill | Button | Reachable via |
|---|---|---|---|
| (false, false) | idle "Ready" | Start | init, stop, errors ✅ |
| (false, true) | green "Connected" | Start | **only** transient switch call (L-11 ghost) |
| (true, true) | red "Recording (Model)" | Stop | onopen ✅ |
| (true, true, "Switching…") | red "Switching…" | Stop | live switch ✅ |

Missing states the machine needs (gaps, not bugs per se): "Connecting…" as a pill state (currently shown as text while pill is idle-gray), "Connection lost" (C-04's remedy), "Degraded — network slow" (M-05's signal).

---

## 6. EVENT → HANDLER REGISTRATION MAP (verified from source)

| Event | Target | Handler | Line |
|---|---|---|---|
| click (toggle) | recordButton (inline) | `toggleRecording` | html:116 |
| click | clear/copy/download/grammar (inline) | exports | html:97-113 |
| click | logo (inline) | `location.reload` | html:18 |
| click | switcher btn/options (inline) | dropdown fns | html:27-57 |
| click | document | outside-close | js:694 |
| input | messageEl | `onEditorInput` | js:677 |
| DOMContentLoaded | document | init | js:673 |
| beforeunload | window | cleanup | js:701 |
| (ws) open/message/error/close | per-socket | branches | js:484-587 |
| port.onmessage | worklet node | queue pump | js:195 |

No `visibilitychange`, no `pagehide`, no keyboard listeners, no `scroll` listener (M-02 measures instead) — the gaps the proposals (D-03/D-09, responsive §5) fill.

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
