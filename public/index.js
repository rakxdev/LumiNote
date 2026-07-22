/* global anime */
// DOM elements
const recordButton = document.getElementById("recordButton");
const buttonText = document.getElementById("buttonText");
const buttonIcon = document.getElementById("buttonIcon");
const messageEl = document.getElementById("message");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const copyFeedback = document.getElementById("copyFeedback");
const wordCountEl = document.getElementById("wordCount");
const charCountEl = document.getElementById("charCount");

let isRecording = false;
let ws = null;
let microphone = null;

// State management for interactive live editing
let baseText = ""; // Text edited by user or finalized turns
let currentTurnOrder = null;
let activeTurnText = "";

// Token Management System
const TokenManager = {
  token: null,
  tokenTimestamp: null,
  refreshInterval: null,
  
  isValid() {
    if (!this.token || !this.tokenTimestamp) return false;
    const age = (Date.now() - this.tokenTimestamp) / 1000;
    return age < 55;
  },
  
  async fetchToken() {
    try {
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

// Pre-created Audio Context for zero-latency recording
let globalAudioContext = null;

function getAudioContext() {
  if (!globalAudioContext || globalAudioContext.state === 'closed') {
    globalAudioContext = new AudioContext({
      sampleRate: 16000, // Native 16kHz for Universal-3.5 Pro
      latencyHint: 'interactive'
    });
    console.log('🎵 16kHz AudioContext created');
  }
  
  if (globalAudioContext.state === 'suspended') {
    globalAudioContext.resume();
    console.log('🎵 AudioContext resumed');
  }
  
  return globalAudioContext;
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
          const finalBuffer = audioBufferQueue.subarray(0, totalSamples);
          audioBufferQueue = audioBufferQueue.subarray(totalSamples);

          // Pure native 16kHz audio stream sent directly to Universal-3.5 Pro
          if (onAudioCallback) {
            onAudioCallback(new Uint8Array(finalBuffer.buffer));
          }
        }
      };
    },
    stopRecording() {
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

// Synchronize DOM edits with internal state (Interactive Editing)
function onEditorInput() {
  // Capture base text from contenteditable container, excluding live interim span
  const liveSpan = messageEl.querySelector('.live-turn');
  if (liveSpan) {
    // Extract non-span text as user base text
    const clone = messageEl.cloneNode(true);
    const tempLiveSpan = clone.querySelector('.live-turn');
    if (tempLiveSpan) tempLiveSpan.remove();
    baseText = clone.innerText;
  } else {
    baseText = messageEl.innerText;
  }
  updateStats();
}

function updateStats() {
  const fullText = messageEl.innerText.trim();
  const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
  const chars = fullText.length;
  
  if (wordCountEl) wordCountEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
  if (charCountEl) charCountEl.textContent = `${chars} character${chars === 1 ? '' : 's'}`;
}

// Render transcript combining user edits and live streaming turn
function renderTranscript() {
  const cleanBase = baseText.trim();
  const cleanTurn = activeTurnText.trim();

  if (!cleanTurn) {
    messageEl.innerText = cleanBase;
  } else {
    const spacing = cleanBase ? " " : "";
    messageEl.innerHTML = `${escapeHtml(cleanBase)}${spacing}<span class="live-turn">${escapeHtml(cleanTurn)}</span>`;
  }
  
  // Auto-scroll to bottom if user is not actively editing
  if (document.activeElement !== messageEl) {
    messageEl.scrollTop = messageEl.scrollHeight;
  }
  updateStats();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    showCopyFeedback('Copied to clipboard!');
    
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

// Download transcript as a .txt file
function downloadTranscript() {
  const text = messageEl.innerText.trim();
  if (!text) {
    showCopyFeedback('No text to download!');
    return;
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LumiNote-Transcript-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showCopyFeedback(message) {
  copyFeedback.textContent = message;
  copyFeedback.classList.add('show');

  setTimeout(() => {
    copyFeedback.classList.remove('show');
  }, 2200);
}

function clearTranscription() {
  baseText = "";
  activeTurnText = "";
  currentTurnOrder = null;
  messageEl.innerText = "";
  updateStats();
}

// Toggle recording function
async function toggleRecording() {
  if (recordButton.disabled) return;
  
  if (isRecording) {
    recordButton.disabled = true;
    stopRecording();
  } else {
    recordButton.disabled = true;
    updateRecordingState(false, true, 'Connecting to Universal-3.5 Pro...');
    await startRecording();
  }
}

async function startRecording() {
  try {
    microphone = createMicrophone();
    
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
      alert("Failed to get authorization token. Please try again.");
      updateRecordingState(false);
      return;
    }

    // Universal-3.5 Pro streaming WebSocket URL at 16kHz
    const endpoint = `wss://streaming.assemblyai.com/v3/ws?speech_model=universal-3-5-pro&sample_rate=16000&encoding=pcm_s16le&formatted_finals=true&token=${token}`;
    
    // Close any residual WebSocket to enforce max 1 concurrent session limit
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }

    ws = new WebSocket(endpoint);

    ws.onopen = () => {
      console.log("🚀 Connected to AssemblyAI Universal-3.5 Pro Realtime!");
      
      if (!microphone) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        recordButton.disabled = false;
        return;
      }
      
      updateRecordingState(true, true);
      recordButton.disabled = false;
      
      microphone.startRecording((audioChunk) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(audioChunk);
        }
      });
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === "Begin") {
        console.log("✅ Session Begin:", msg.configuration);
      } else if (msg.type === "Turn") {
        const { turn_order, transcript } = msg;
        
        // When a new turn starts, commit the previous turn to baseText
        if (currentTurnOrder !== null && turn_order !== currentTurnOrder) {
          if (activeTurnText.trim()) {
            baseText = (baseText.trim() + " " + activeTurnText.trim()).trim();
          }
        }
        
        currentTurnOrder = turn_order;
        activeTurnText = transcript || "";
        renderTranscript();
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      updateRecordingState(false);
      recordButton.disabled = false;
      alert("Connection error. Please check your internet connection.");
    };

    ws.onclose = (evt) => {
      console.log("WebSocket closed with code:", evt.code);
      if (evt.code === 1008) {
        alert("Session conflict (Too many concurrent sessions). Please wait a moment and try again.");
      }
      updateRecordingState(false, false);
    };

  } catch (error) {
    console.error("Error starting recording:", error);
    alert("Error accessing microphone. Please check permissions.");
    updateRecordingState(false);
    recordButton.disabled = false;
  }
}

function stopRecording() {
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "Terminate" }));
      } catch (error) {
        console.warn('⚠️ Failed to send Terminate message:', error.message);
      }
    }
    
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

  // Merge active turn into baseText on stop
  if (activeTurnText.trim()) {
    baseText = (baseText.trim() + " " + activeTurnText.trim()).trim();
    activeTurnText = "";
  }
  currentTurnOrder = null;
  renderTranscript();

  updateRecordingState(false);
}

function updateRecordingState(recording, connected = false, customStatus = null) {
  isRecording = recording;

  if (!recording && recordButton.disabled) {
    recordButton.disabled = false;
  }

  const clearButton = document.getElementById('clearButton');
  if (clearButton) {
    clearButton.disabled = recording;
  }

  recordButton.classList.toggle('recording', recording);
  buttonText.textContent = recording ? 'Stop Recording' : 'Start Recording';

  if (recording) {
    buttonIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>`;
  } else {
    buttonIcon.innerHTML = `<svg class="mic-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
  }

  statusIndicator.classList.toggle('recording', recording);
  statusIndicator.classList.toggle('connected', !recording && connected);

  if (customStatus) {
    statusText.textContent = customStatus;
  } else if (recording) {
    statusText.textContent = 'Recording (Universal-3.5 Pro)';
  } else if (connected) {
    statusText.textContent = 'Connected';
  } else {
    statusText.textContent = 'Ready';
  }

  anime({
    targets: [recordButton, statusIndicator],
    scale: [0.95, 1],
    duration: 350,
    easing: 'easeOutElastic(1, .8)'
  });
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', async function() {
  updateRecordingState(false);
  
  // Attach input listener to editable transcript area
  if (messageEl) {
    messageEl.addEventListener('input', onEditorInput);
  }

  console.log('🚀 Initializing LumiNote token system...');
  await TokenManager.fetchToken();
  TokenManager.startBackgroundRefresh();
  console.log('✅ Token system ready!');
  
  getAudioContext();
  console.log('🎵 Audio system ready (16kHz Native)!');
  updateStats();
});

window.addEventListener('beforeunload', () => {
  TokenManager.stopBackgroundRefresh();
  if (globalAudioContext) {
    globalAudioContext.close();
    console.log('🎵 AudioContext closed');
  }
});

// Global exports
window.copyToClipboard = copyToClipboard;
window.downloadTranscript = downloadTranscript;
window.toggleRecording = toggleRecording;
window.clearTranscription = clearTranscription;
