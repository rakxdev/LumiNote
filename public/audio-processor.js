/**
 * AudioProcessor Worklet
 * Converts Float32 audio samples from Web Audio API into 16-bit PCM (Int16Array)
 * with saturating clamping and zero-copy ArrayBuffer transfer.
 */

export function convertFloat32ToInt16(float32Array) {
  const len = float32Array.length;
  const int16Array = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    // Saturating clamp to [-1.0, 1.0] range to prevent wrap-around crackle on loud speech
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  return int16Array;
}

/**
 * Append a PCM chunk to the queue and emit one fixed-size batch when enough
 * samples have accumulated. The batch is a byte view of exactly totalSamples
 * samples — never the whole underlying buffer — so the leftover tail stays
 * queued exactly once and is never sent twice.
 */
export function appendPcmChunk(queue, chunk, totalSamples) {
  const merged = new Int16Array(queue.length + chunk.length);
  merged.set(queue, 0);
  merged.set(chunk, queue.length);

  if (merged.length < totalSamples) {
    return { batch: null, queue: merged };
  }

  const batch = new Uint8Array(merged.buffer, 0, totalSamples * 2);
  return { batch, queue: merged.slice(totalSamples) };
}

if (typeof AudioWorkletProcessor !== 'undefined') {
  class AudioProcessor extends AudioWorkletProcessor {
    process(inputs) {
      const input = inputs[0];
      
      // If no input or channel data, keep processor active
      if (!input || !input[0] || input[0].length === 0) {
        return true;
      }

      const channelData = input[0];
      const int16Array = convertFloat32ToInt16(channelData);
      const buffer = int16Array.buffer;

      // Transfer ownership of ArrayBuffer to avoid costly heap copying on high-frequency audio tick
      this.port.postMessage({ audio_data: buffer }, [buffer]);

      return true;
    }
  }

  registerProcessor('audio-processor', AudioProcessor);
}
