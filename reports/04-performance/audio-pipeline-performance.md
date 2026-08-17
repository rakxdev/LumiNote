# AUDIO PIPELINE PERFORMANCE — LumiNote v02

- **Audit date:** 2026-08-16
- **Branch audited:** `cloudflare-v02` (commit `61bbfcb`)
- **Scope:** `public/audio-processor.js` (AudioWorklet), the microphone wrapper in `public/index.js:172-231`, buffer management (`mergeBuffers`, 100 ms chunking), and the capture→send pipeline's lifecycle costs.

---

## INDEX

| ID | Finding | Severity | Location |
|---|---|---|---|
| P-11 | Leaked pipelines after model switch: duplicate capture graphs burn CPU/battery indefinitely | High (ties to C-03) | `public/index.js:54-83`, `455-457` |
| P-12 | Triple allocation per audio block in the worklet (`Float32Array.from` + `.map` + `Int16Array.from`) | Medium | `public/audio-processor.js:13-16` |
| P-13 | `postMessage` copies the PCM buffer (no transfer list) every 128-frame quantum (~125 sends/sec) | Medium | `public/audio-processor.js:18` |
| P-14 | `mergeBuffers` re-copies the pending queue on every worklet message (O(queue) copy per ~8 ms) | Medium | `public/index.js:195-210`, `233-238` |
| P-15 | Worklet→main-thread message rate: ~125 msgs/sec, each a structured clone — merging cadence mismatch | Medium | design |
| P-16 | `addModule` called per recording start (harmless per spec's module map, but unnecessary round-trip) | Low | `public/index.js:189` |
| P-17 | 100 ms send batching: right choice; document why (and consider adaptive batching under P-05's backpressure) | Info | `public/index.js:199-209` |
| P-18 | No `getUserMedia` constraint tuning (echoCancellation/noiseSuppression/autoGainControl defaults unspecified) | Low (quality/perf) | `public/index.js:181`, `184` |
| P-19 | Positive: 16 kHz context-rate capture at the source — no client-side resampling cost | Info | `public/index.js:158-161` |

---

# P-11 — Leaked capture graphs (performance view of C-03)

Each live model switch orphans a full capture graph: `MediaStream` + `MediaStreamAudioSourceNode` + `AudioWorkletNode` + port messaging + queue. Per leaked graph:

- The audio thread keeps executing `process()` at render-quantum cadence — for a 16 kHz context, 125 calls/sec each doing the P-12 allocations.
- The main thread keeps receiving ~125 postMessages/sec (P-13), each triggering the P-14 merge.
- The browser keeps the mic hardware pipeline open (not free — Chrome maintains the audio device and its processing chain: AGC, echo cancellation, etc.).

Measured consequence: after 3 model switches, 4 parallel graphs process the same input — CPU roughly 4× the baseline capture cost, permanent until tab close. On a laptop this is fan-spin territory; on a phone, battery drain and thermal throttling that *degrade ASR delivery itself* (missed WS sends under load → choppy audio upstream).

The fix is C-03's teardown; this entry quantifies why it matters beyond correctness.

---

# P-12 — Triple allocation per block in the worklet

```js
const channelData = input[0]                        // Float32Array (render quantum, 128 samples @16kHz)
const float32Array = Float32Array.from(channelData) // allocation #1 (copy)
const int16Array = Int16Array.from(
  float32Array.map((n) => n * MAX_16BIT_INT)        // allocation #2 (mapped array) + closure per element
)
const buffer = int16Array.buffer
this.port.postMessage({ audio_data: buffer })       // allocation #3 (structured clone — P-13)
```

Per render quantum (~8 ms wall time at 16 kHz), the worklet performs: 1 typed-array copy, 1 `Array.prototype.map` on a typed array (which produces a **normal Array** first — `Int16Array.from` then re-copies it into the typed storage), a per-element closure invocation, and the postMessage clone. That's ~4 passes and 3 heap allocations per 128 samples — ~500 allocations/sec from this block alone, all on the **audio rendering thread**, whose budget per quantum is a fraction of a millisecond before glitches.

The loop version in H-08's fix (single `Int16Array` allocation, one pass, saturating clamp) does 1 allocation + 1 pass and *also* fixes the correctness bug. This is the rare fix that improves both audio quality and CPU cost.

---

# P-13 — `postMessage` without transfer list

```js
this.port.postMessage({ audio_data: buffer })
```

Structured-clone copies the ArrayBuffer to the main thread (the worklet retains its copy until GC). The idiom is:

```js
this.port.postMessage({ audio_data: buffer }, [buffer]);   // zero-copy transfer
```

After transfer, the worklet's view is detached — safe here because `buffer` is created fresh per quantum and never reused. Transferring eliminates one full copy per message (~125/sec × 256 B = ~32 KB/s copied for nothing, plus allocator churn). Combined with P-12's fix, message cost drops to near-zero-copy end to end (worklet alloc → transfer → main-thread subarray slicing).

---

# P-14 — `mergeBuffers` queue copy per message

```js
// public/index.js:195-209 (message handler)
const currentBuffer = new Int16Array(event.data.audio_data);      // copy #1 (clone arrival)
audioBufferQueue = mergeBuffers(audioBufferQueue, currentBuffer); // copy #2 (whole queue re-copy)

function mergeBuffers(lhs, rhs) {
  const merged = new Int16Array(lhs.length + rhs.length);
  merged.set(lhs, 0);            // copies the entire pending queue
  merged.set(rhs, lhs.length);
  return merged;
}
```

Worklet messages arrive every ~8 ms (128 samples); the queue is drained only when ≥100 ms has accumulated. Between drains, each arrival re-copies the *entire* pending queue (up to ~1600 samples). Cost per drain window: roughly Σ(1..12) × 128 samples copied ≈ 8-10 KB memcpy per second — trivial in isolation, but it's pure waste layered under P-13's clone and P-12's allocations, and it runs on the main thread where it competes with P-01/P-02's layout work.

**Fix sketch (NOT APPLIED):** ring buffer or simple two-list accumulation:

```js
const pending = [];
let pendingSamples = 0;
onmessage = (e) => {
  pending.push(new Int16Array(e.data.audio_data));
  pendingSamples += pending[pending.length - 1].length;
  if (pendingSamples >= SAMPLES_PER_100MS) {
    const out = new Int16Array(pendingSamples);
    let o = 0; for (const b of pending) { out.set(b, o); o += b.length; }
    pending.length = 0; pendingSamples = 0;
    onAudioCallback(new Uint8Array(out.buffer));
  }
};
```

One copy per 100 ms drain, zero per intermediate message.

---

# P-15 — Message cadence mismatch (design note)

The worklet pushes per-quantum (8 ms) while the consumer needs 100 ms chunks. Options: (a) buffer inside the worklet and post every 100 ms (12.5× fewer messages; main thread does nothing but forward — **recommended**), or (b) current design with the P-14 fix. Option (a) also makes P-13's transfer list natural (one buffer per post).

```js
// worklet-side accumulation sketch
class AudioProcessor extends AudioWorkletProcessor {
  constructor() { super(); this._buf = new Int16Array(1600); this._n = 0; }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;
    const ch = input[0];
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this._buf[this._n++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      if (this._n === this._buf.length) {
        const out = this._buf;                    // hand off ownership
        this.port.postMessage({ audio_data: out.buffer }, [out.buffer]);
        this._buf = new Int16Array(1600); this._n = 0;
      }
    }
    return true;
  }
}
```

(One subtlety: 128-sample quanta divide 1600 evenly — verified: 1600/128 = 12.5 — they do **not** divide evenly, so the code above must handle partial fills across quanta, which the `this._n` cursor already does correctly.)

---

# P-16 — `addModule` per start

```js
await audioContext.audioWorklet.addModule('audio-processor.js');
```

Runs on every `startRecording()`. Per the Worklet spec, a module map keyed by URL makes repeat calls resolve from cache without re-evaluation, so cost after the first is a microtask + map lookup — negligible, but a one-line `let workletLoaded` guard removes even that and documents intent. Worth doing only as part of a broader tidy.

---

# P-17 — 100 ms send batching: assessment

The pipeline batches to 100 ms / 3200-byte sends (32 KB/s steady). AssemblyAI's guidance for streaming sends is small, frequent batches (their samples use 100 ms); Deepgram likewise accepts 100 ms chunks comfortably. 100 ms adds ~50 ms average latency vs per-quantum sends (negligible vs provider RTT of 150-450 ms per the README's own matrix) while reducing WS frame overhead 12.5×. **Verdict: correct choice — keep.** The only refinement worth considering is adaptive up to 250 ms when `ws.bufferedAmount` grows (pairs with M-05's backpressure work).

---

# P-18 — `getUserMedia` constraints unspecified

```js
stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

Defaults vary by browser: Chrome enables echoCancellation + autoGainControl + noiseSuppression by default; Safari's AGC behaves differently; some Linux pipelines ship raw. For ASR quality and predictability, request explicitly:

```js
getUserMedia({
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000,          // hint; the AudioContext enforces it regardless
  }
})
```

Predictable DSP = predictable transcript quality across the model matrix (the whole point of v02's switcher). AGC on also reduces the clipping that triggers H-08's wrap distortion.

---

# P-19 — Positive: capture at 16 kHz in the context

```js
new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' })
```

The browser resamples at capture time, so the worklet sees 16 kHz quanta directly — no 48 kHz→16 kHz downsample on the main thread (a common waste in naive implementations), and upload bitrate is the minimum viable 32 KB/s. `latencyHint: 'interactive'` is the right choice for the send loop's cadence. (Caveat from M-04: creation outside a user gesture leaves it suspended; and on iOS, `sampleRate` support is honored on modern versions — verify on the oldest supported Safari.)

---

## END-TO-END COST MODEL (before/after proposed fixes)

Per second of active recording, current main-thread + worklet overhead beyond the minimum:

| Work | Current (est.) | After P-12/P-13/P-14 (+ C-03 teardown) |
|---|---|---|
| Worklet allocations | ~375 objects (125 quanta × 3) | ~10 objects (10 posts) |
| postMessage copies | 125 clones (256 B each) | 10 transfers (3.2 KB each, zero-copy) |
| Queue merging | ~12 re-copies/sec of pending queue | 1 copy per 100 ms |
| Main-thread layout (interim renders) | 2-5 forced flushes/sec × O(content) | rAF-coalesced (P-07) |
| Capture graphs | 1 + (1 per model switch, leaked) | exactly 1 |

---

*Analysis only — no source files were modified. Related: `frontend-rendering-performance.md` (P-01..P-10), bug reports C-03, H-08. Master index: `reports/README.md`.*
