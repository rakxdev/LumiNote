const MAX_16BIT_INT = 32767

class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    
    // If no input or channel data, skip this frame but keep processor alive
    if (!input || !input[0] || input[0].length === 0) {
      return true
    }

    const channelData = input[0]
    const float32Array = Float32Array.from(channelData)
    const int16Array = Int16Array.from(
      float32Array.map((n) => n * MAX_16BIT_INT)
    )
    const buffer = int16Array.buffer
    this.port.postMessage({ audio_data: buffer })

    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)
