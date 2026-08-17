# ADR-001: Synthetic Oscilloscope Overlay for Microphone Visualization

## Status
Accepted

## Date
2026-08-17

## Context
We needed a live, kinetic audio visualizer (oscilloscope) that bounces when the user is dictating into LumiNote.

**The Constraints & Bugs Encountered:**
1. **Hardware Limitations:** In modern, privacy-focused browser environments (specifically Safari and hardened Chrome versions), attaching an `AnalyserNode` to a `MediaStreamAudioSourceNode` generated from `getUserMedia` often yields an empty array (pure zeros) when trying to read frequency data via `getByteFrequencyData()`.
2. **Audio Graph Suspension:** The browser intentionally suspends audio graphs not directly connected to a physical audio output destination as an anti-fingerprinting measure. 
3. **The User Experience Hit:** Because the actual hardware frequency data was blocked by the browser, the visualizer flatlined completely, making the application feel broken even though the microphone stream to Deepgram/AssemblyAI was working perfectly.

## Decision
We implemented a **Synthetic Math-Driven Oscilloscope Overlay**.

Instead of fighting across dozens of browser privacy permutations to force the hardware `AnalyserNode` to emit real data, we explicitly decouple the visualizer from the microphone hardware. The moment `isRecording` is toggled to `true`, the visualizer renders an organic, layered mathematical sine wave simulation (`Math.sin(time) * amplitude + noise`).

## Alternatives Considered

### 1. Route microphone output to speakers with a GainNode set to 0
- **Pros:** Trick the browser into keeping the AudioContext graph active.
- **Cons:** Triggers severe feedback loops (echo) on some systems; unreliable across iOS.

### 2. Extract RMS energy directly in the AudioWorklet Processor
- **Pros:** 100% accurate energy representation since the worklet already has the raw PCM buffer.
- **Cons:** Sending constant high-frequency `postMessage` calls just for visual UI updates starves the main thread and introduces severe latency overhead to the actual transcription pipeline.

## Consequences
- **Positive:** The interface feels incredibly responsive, alive, and polished 100% of the time on every device.
- **Positive:** Zero performance overhead on the main thread (runs via pure `requestAnimationFrame` math, rather than looping over heavy `Uint8Array` buffers).
- **Negative:** The wave does not exactly match the literal pitch of the user's voice (it is an aesthetic simulation, not a diagnostic tool). This is deemed an acceptable trade-off for a dictation app where the visualizer's primary job is communicating "active listening state", not technical acoustic analysis.
