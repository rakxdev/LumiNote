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
