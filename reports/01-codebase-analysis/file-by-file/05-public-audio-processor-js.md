# FILE ANALYSIS — `public/audio-processor.js` (24 lines)

- **Role:** AudioWorklet processor — runs on the dedicated audio rendering thread; converts the browser's native Float32 mic samples to Int16 PCM and ships them to the main thread.
- **Load path:** `audioContext.audioWorklet.addModule('audio-processor.js')` (`public/index.js:189`) — relative URL, same-origin ✅.

---

## FULL LISTING (annotated)

```js
const MAX_16BIT_INT = 32767                          // L1: no semicolon (style only)

class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {                                  // L4: outputs param unused (fine — no audio out)
    const input = inputs[0]                          // L5: first input node (the mic source)
    
    if (!input || !input[0] || input[0].length === 0) {
      return true                                    // L9: keep processor alive on silent frames ✅
    }

    const channelData = input[0]                     // L12: channel 0 only → mono ✅ (context is mono capture)
    const float32Array = Float32Array.from(channelData)   // L13: alloc #1 — pure copy (unnecessary)
    const int16Array = Int16Array.from(
      float32Array.map((n) => n * MAX_16BIT_INT)     // L15: alloc #2a (JS array) + closure/element — NO CLAMP (H-08)
    )                                                // L15b: alloc #2b (typed copy)
    const buffer = int16Array.buffer
    this.port.postMessage({ audio_data: buffer })    // L18: alloc #3 — structured clone (P-13; no transfer list)
    return true                                      // L20: keep alive ✅
  }
}

registerProcessor('audio-processor', AudioProcessor) // L24
```

---

## CORRECTNESS FINDINGS (cross-referenced)

| Finding | ID | Summary |
|---|---|---|
| No saturation clamp | **H-08** | `n*32767` for \|n\|>1 wraps modulo 2¹⁶ → sign-inverted samples → audible crackle on loud speech |
| Mono assumption | — | `input[0]` only; correct for this app's single-channel capture; a stereo source would silently drop the right channel (acceptable/documented behavior) |
| 128-sample quanta | — | At 16 kHz the render quantum is 128 samples ⇒ ~7.8 ms cadence; 128 posts/sec to main thread (P-15 design note) |
| Silent-frame keep-alive | ✅ | Returning `true` unconditionally is required to keep the processor scheduled; done correctly |
| No output writing | ✅ | `outputs` untouched → silence → the `connect(destination)` in index.js is purely a keep-alive, no echo risk |

---

## PERFORMANCE FINDINGS

- **P-12:** three allocations + a `.map` closure per quantum ≈ 375 heap objects/sec on the audio thread. The audio thread has the tightest deadline in the app (must finish within a sub-millisecond slice per quantum); allocation churn here is the worst possible place for GC pressure. A GC pause on the audio thread = audible glitch (dropped/silent quantum sent upstream → ASR hears a 8 ms hole).
- **P-13:** `postMessage` copies (no transfer). Fix: `this.port.postMessage({audio_data: buffer}, [buffer])`.
- **P-15:** buffering 100 ms inside the worklet would cut messages 12.5× and let the main thread be a pure forwarder.

## STYLE FINDINGS

- No semicolons (the rest of the codebase uses them) — prettier config absent for this file's style (no `.prettierrc` exists anywhere; prettier is in dependencies but unconfigured — code-quality report).
- `const MAX_16BIT_INT = 32767` — negative rail (`-32768`) unused because the conversion is symmetric-positive (itself part of the H-08 issue).

## SECURITY

- Same-origin module, no eval, no dynamic imports — clean. `postMessage` payload is plain PCM buffer. Nothing attacker-influenced beyond sample data. ✅

---

## PROPOSED REWRITE (NOT APPLIED — consolidates H-08/P-12/P-13/P-15 fixes)

```js
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = new Int16Array(1600);   // 100 ms @ 16 kHz
    this._n = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const ch = input[0];
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));       // clamp (H-08)
      this._queue[this._n++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      if (this._n === this._queue.length) {
        const out = this._queue;
        this.port.postMessage({ audio_data: out.buffer }, [out.buffer]);  // transfer (P-13)
        this._queue = new Int16Array(1600);
        this._n = 0;
      }
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
```

One allocation + one transfer per 100 ms; zero per quantum; saturating conversion. (Main-thread `mergeBuffers` logic then collapses to forwarding — pairs with the P-14 sketch in the audio performance report.)

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
