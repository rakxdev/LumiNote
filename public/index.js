/* global anime */
// DOM elements
const recordButton = document.getElementById("recordButton");
const buttonText = document.getElementById("buttonText");
const messageEl = document.getElementById("message");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const copyFeedback = document.getElementById("copyFeedback");

let isRecording = false;
let ws;
let microphone;

// Token Management System - Phase 1: Delay Optimization
const TokenManager = {
  token: null,
  tokenTimestamp: null,
  refreshInterval: null,
  
  isValid() {
    if (!this.token || !this.tokenTimestamp) return false;
    const age = (Date.now() - this.tokenTimestamp) / 1000;
    return age < 55; // Consider valid if less than 55 seconds old
  },
  
  async fetchToken() {
    try {
      // Use relative URL - works on both localhost and Cloudflare
      const response = await fetch("/api/token");
      const data = await response.json();
      
      if (data.token) {
        this.token = data.token;
        this.tokenTimestamp = Date.now();
        console.log('✅ Token refreshed successfully');
        return data.token;
      } else {
        console.error('❌ Token fetch failed: No token in response');
        return null;
      }
    } catch (error) {
      console.error('❌ Token fetch error:', error);
      return null;
    }
  },
  
  async getToken() {
    if (this.isValid()) {
      const age = Math.round((Date.now() - this.tokenTimestamp) / 1000);
      console.log(`🔄 Using cached token (age: ${age}s)`);
      return this.token;
    }
    console.log('🔄 Fetching fresh token...');
    return await this.fetchToken();
  },
  
  startBackgroundRefresh() {
    // Refresh every 50 seconds
    this.refreshInterval = setInterval(() => {
      console.log('🔄 Background token refresh...');
      this.fetchToken();
    }, 50000);
    console.log('✅ Background token refresh started (every 50s)');
  },
  
  stopBackgroundRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏹️ Background token refresh stopped');
    }
  }
};

// Phase 2: Pre-created Audio Context for faster recording start
let globalAudioContext = null;

function getAudioContext() {
  if (!globalAudioContext || globalAudioContext.state === 'closed') {
    globalAudioContext = new AudioContext({
      sampleRate: 16000,
      latencyHint: 'balanced'
    });
    console.log('🎵 AudioContext created');
  }
  
  if (globalAudioContext.state === 'suspended') {
    globalAudioContext.resume();
    console.log('🎵 AudioContext resumed');
  }
  
  return globalAudioContext;
}

// Create this function
function resampleAudioBuffer(originalSampleRate, targetSampleRate, buffer) {
  if (originalSampleRate === targetSampleRate) return buffer;

  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const sourceIndex = Math.floor(i * ratio);
    const nextIndex = Math.min(sourceIndex + 1, buffer.length - 1);
    const fraction = (i * ratio) - sourceIndex;

    const left = buffer[sourceIndex];
    const right = buffer[nextIndex];
    result[i] = Math.round(left + (right - left) * fraction);
  }

  return result;
}

function createMicrophone() {
  let stream;
  let audioContext;
  let audioWorkletNode;
  let source;
  let audioBufferQueue = new Int16Array(0);

  return {
    async requestPermission() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    },
    async startRecording(onAudioCallback) {
      if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Use pre-created AudioContext (Phase 2 optimization)
      audioContext = getAudioContext();

      source = audioContext.createMediaStreamSource(stream);
      await audioContext.audioWorklet.addModule('audio-processor.js');

      audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      source.connect(audioWorkletNode);
      audioWorkletNode.connect(audioContext.destination);

      audioWorkletNode.port.onmessage = (event) => {
        const currentBuffer = new Int16Array(event.data.audio_data);
        audioBufferQueue = mergeBuffers(audioBufferQueue, currentBuffer);

        const bufferDuration = (audioBufferQueue.length / audioContext.sampleRate) * 1000;

        if (bufferDuration >= 100) {
          const totalSamples = Math.floor(audioContext.sampleRate * 0.1);
          let finalBuffer = audioBufferQueue.subarray(0, totalSamples);
          audioBufferQueue = audioBufferQueue.subarray(totalSamples);

          // Resample from 16kHz to 8kHz for free accounts
          finalBuffer = resampleAudioBuffer(16000, 8000, finalBuffer);

          if (onAudioCallback) {
            onAudioCallback(new Uint8Array(finalBuffer.buffer));
          }
        }
      };
    },
    stopRecording() {
      // Disconnect audio worklet first to stop data flow
      if (audioWorkletNode) {
        audioWorkletNode.port.onmessage = null;
        audioWorkletNode.disconnect();
        audioWorkletNode = null;
      }
      if (source) {
        source.disconnect();
        source = null;
      }
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      // Don't close AudioContext - reuse it (Phase 2 optimization)
      // audioContext?.close();
      audioBufferQueue = new Int16Array(0);
    }
  };
}

function mergeBuffers(lhs, rhs) {
  const merged = new Int16Array(lhs.length + rhs.length);
  merged.set(lhs, 0);
  merged.set(rhs, lhs.length);
  return merged;
}

// Copy to clipboard functionality
async function copyToClipboard() {
  const text = messageEl.innerText.trim();
  const copyButton = document.getElementById('copyButton');
  const copyIcon = copyButton.querySelector('.copy-icon');
  const tickIcon = copyButton.querySelector('.tick-icon');

  if (!text) {
    showCopyFeedback('No text to copy!');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    
    copyIcon.style.display = 'none';
    tickIcon.style.display = 'inline-block';
    
    anime({
      targets: tickIcon,
      scale: [0.8, 1],
      duration: 300,
      easing: 'easeOutQuad'
    });

    setTimeout(() => {
      copyIcon.style.display = 'inline-block';
      tickIcon.style.display = 'none';
    }, 2000);

  } catch (err) {
    showCopyFeedback('Failed to copy');
  }
}

function showCopyFeedback(message) {
  copyFeedback.textContent = message;
  copyFeedback.classList.add('show');

  setTimeout(() => {
    copyFeedback.classList.remove('show');
  }, 2000);
}

// Select text when clicking on message area
function selectText() {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(messageEl);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Toggle recording function
async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    updateRecordingState(false, true, 'Connecting...');
    await startRecording();
  }
}

async function startRecording() {
  try {
    microphone = createMicrophone();
    
    // Phase 3: Run operations in parallel for maximum speed
    const [permissionResult, token] = await Promise.all([
      microphone.requestPermission()
        .then(() => true)
        .catch((err) => {
          console.error('❌ Microphone permission error:', err);
          return false;
        }),
      TokenManager.getToken()
    ]);

    if (!permissionResult) {
      alert("Microphone permission denied. Please allow microphone access.");
      updateRecordingState(false);
      return;
    }

    if (!token) {
      alert("Failed to get token. Please check your connection.");
      updateRecordingState(false);
      return;
    }

    const endpoint = `wss://streaming.assemblyai.com/v3/ws?sample_rate=8000&formatted_finals=true&token=${token}`;
    ws = new WebSocket(endpoint);

    const turns = {}; // keyed by turn_order

    ws.onopen = () => {
      console.log("WebSocket connected!");
      updateRecordingState(true, true);
      microphone.startRecording((audioChunk) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(audioChunk);
        }
      });
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "Turn") {
        const { turn_order, transcript } = msg;
        turns[turn_order] = transcript;

        const orderedTurns = Object.keys(turns)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => turns[k])
          .join(" ");

        messageEl.innerText = orderedTurns;

        // Auto-scroll to the bottom
        messageEl.scrollTop = messageEl.scrollHeight;
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      updateRecordingState(false);
      alert("Connection error. Please check your internet connection and try again.");
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      updateRecordingState(false, false);
    };

  } catch (error) {
    console.error("Error starting recording:", error);
    alert("Error accessing microphone. Please check permissions.");
    updateRecordingState(false);
  }
}

function stopRecording() {
  if (ws) {
    // Only send Terminate if WebSocket is OPEN
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "Terminate" }));
      } catch (error) {
        console.warn('⚠️ Failed to send Terminate message:', error.message);
      }
    }
    
    // Close WebSocket if it's not already CLOSING or CLOSED
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try {
        ws.close();
      } catch (error) {
        console.warn('⚠️ Failed to close WebSocket:', error.message);
      }
    }
    
    ws = null;
  }

  if (microphone) {
    microphone.stopRecording();
    microphone = null;
  }

  updateRecordingState(false);
}

function updateRecordingState(recording, connected = false, customStatus = null) {
  isRecording = recording;

  // Disable clear button while recording
  const clearButton = document.getElementById('clearButton');
  if (clearButton) {
    clearButton.disabled = recording;
  }

  // Update button
  recordButton.classList.toggle('recording', recording);
  const icon = document.getElementById('buttonIcon');
  buttonText.textContent = recording ? 'Stop Recording' : 'Start Recording';

  if (recording) {
    // Show a stop icon
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>`;
  } else {
    // Show a mic icon
    icon.innerHTML = `<svg class="mic-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
  }

  // Update status indicator
  statusIndicator.classList.toggle('recording', recording);
  statusIndicator.classList.toggle('connected', !recording && connected);

  if (customStatus) {
    statusText.textContent = customStatus;
  } else if (recording) {
    statusText.textContent = 'Recording';
  } else if (connected) {
    statusText.textContent = 'Connected';
  } else {
    statusText.textContent = 'Ready';
  }

  // Animate button and status
  anime({
    targets: [recordButton, statusIndicator],
    scale: [0.95, 1],
    duration: 400,
    easing: 'easeOutElastic(1, .8)'
  });

  // Clear message when starting new recording
  if (recording) {
    messageEl.innerText = '';
  }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', async function() {
  // Initial state
  updateRecordingState(false);
  
  // Phase 1: Pre-fetch token and start background refresh
  console.log('🚀 Initializing token system...');
  await TokenManager.fetchToken();
  TokenManager.startBackgroundRefresh();
  console.log('✅ Token system ready!');
  
  // Phase 2: Pre-create AudioContext for instant recording
  getAudioContext();
  console.log('🎵 Audio system ready!');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  TokenManager.stopBackgroundRefresh();
  if (globalAudioContext) {
    globalAudioContext.close();
    console.log('🎵 AudioContext closed');
  }
});

// Expose functions to global scope for HTML onclick handlers
window.copyToClipboard = copyToClipboard;
window.selectText = selectText;
window.toggleRecording = toggleRecording;
window.clearTranscription = clearTranscription;

function clearTranscription() {
  messageEl.innerText = '';
}
