/* global anime */

/**
 * LumiNote v03 Client Engine
 * Real-time voice dictation with zero-latency streaming (AssemblyAI v3 & Deepgram Nova-3)
 */

// DOM element references
const recordButton = document.getElementById("recordButton");
const buttonText = document.getElementById("buttonText");
const buttonIcon = document.getElementById("buttonIcon");
const messageEl = document.getElementById("message");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const copyFeedback = document.getElementById("copyFeedback");
const wordCountEl = document.getElementById("wordCount");
const charCountEl = document.getElementById("charCount");
const grammarButton = document.getElementById("grammarButton");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const clearButton = document.getElementById("clearButton");
const customModelSwitcher = document.getElementById("customModelSwitcher");
const modelSwitcherTrigger = document.getElementById("modelSwitcherTrigger");
const modelDropdownMenu = document.getElementById("modelDropdownMenu");
const selectedModelLabel = document.getElementById("selectedModelLabel");

// Session state variables
let isRecording = false;
let ws = null;
let microphone = null;
let selectedModel = "universal-3-5-pro"; // Default: AssemblyAI Universal-3.5 Pro
let switchTimer = null;

// Editor state management
let baseText = "";
let currentTurnOrder = null;
let activeTurnText = "";

// Global AudioContext singleton
let globalAudioContext = null;

function getAudioContext() {
  if (!globalAudioContext || globalAudioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    globalAudioContext = new AudioCtx({
      sampleRate: 16000,
      latencyHint: 'interactive'
    });
  }
  
  if (globalAudioContext.state === 'suspended') {
    globalAudioContext.resume();
  }
  
  return globalAudioContext;
}

// Token & Session Auth Manager (on-demand ephemeral token minting)
const TokenManager = {
  assemblyAiToken: null,
  assemblyAiTokenTimestamp: null,

  async getAssemblyAiToken() {
    // Re-use token if less than 8 minutes old (server mints with 600s TTL)
    if (this.assemblyAiToken && this.assemblyAiTokenTimestamp) {
      const ageSeconds = (Date.now() - this.assemblyAiTokenTimestamp) / 1000;
      if (ageSeconds < 480) {
        return this.assemblyAiToken;
      }
    }

    try {
      const res = await fetch("/api/token", { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
      const data = await res.json();
      if (data.token) {
        this.assemblyAiToken = data.token;
        this.assemblyAiTokenTimestamp = Date.now();
        return data.token;
      }
      return null;
    } catch (err) {
      console.error("AssemblyAI token error:", err);
      return null;
    }
  },

  async getDeepgramToken() {
    try {
      // Ephemeral grant token (~30s TTL) minted on-demand for immediate WebSocket connection
      const res = await fetch("/api/deepgram-token", { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Deepgram token endpoint returned ${res.status}`);
      const data = await res.json();
      return data.token || null;
    } catch (err) {
      console.error("Deepgram token error:", err);
      return null;
    }
  }
};

// Microphone Capture & AudioWorklet pipeline
function createMicrophone() {
  let stream = null;
  let audioContext = null;
  let audioWorkletNode = null;
  let source = null;
  let audioBufferQueue = new Int16Array(0);

  return {
    async startRecording(onAudioCallback) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

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

          if (onAudioCallback) {
            onAudioCallback(new Uint8Array(finalBuffer.buffer));
          }
        }
      };
    },

    resetBuffer() {
      audioBufferQueue = new Int16Array(0);
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
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        stream = null;
      }
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

// UI State & Toast Feedback
function showToast(message) {
  const toastText = document.getElementById('toastText');
  if (toastText) {
    toastText.textContent = message;
  } else if (copyFeedback) {
    copyFeedback.textContent = message;
  }
  if (copyFeedback) {
    copyFeedback.classList.add('show');
    setTimeout(() => {
      copyFeedback.classList.remove('show');
    }, 2200);
  }
}

function updateStats() {
  if (!messageEl) return;
  const fullText = messageEl.innerText.trim();
  const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
  const chars = fullText.length;
  
  if (wordCountEl) wordCountEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
  if (charCountEl) charCountEl.textContent = `${chars} character${chars === 1 ? '' : 's'}`;
}

function scrollToBottomSmart() {
  if (!messageEl) return;
  const distanceFromBottom = messageEl.scrollHeight - messageEl.clientHeight - messageEl.scrollTop;
  if (distanceFromBottom < 120 || document.activeElement !== messageEl) {
    messageEl.scrollTop = messageEl.scrollHeight;
  }
}

// Render interim and committed text
function renderTranscript() {
  if (!messageEl) return;
  let liveSpan = document.getElementById('liveTurnSpan');
  const cleanTurn = activeTurnText.trim();

  if (cleanTurn) {
    if (!liveSpan) {
      liveSpan = document.createElement('span');
      liveSpan.id = 'liveTurnSpan';
      liveSpan.className = 'live-turn';
      liveSpan.setAttribute('aria-live', 'polite');
      
      if (messageEl.childNodes.length > 0) {
        const lastChild = messageEl.lastChild;
        if (lastChild && lastChild.nodeType === Node.TEXT_NODE && lastChild.textContent && !lastChild.textContent.endsWith(' ')) {
          messageEl.appendChild(document.createTextNode(' '));
        }
      }
      messageEl.appendChild(liveSpan);
    }
    liveSpan.textContent = cleanTurn;
  } else {
    if (liveSpan) {
      liveSpan.remove();
    }
  }

  scrollToBottomSmart();
  updateStats();
}

function commitActiveTurn() {
  if (!messageEl) return;
  const liveSpan = document.getElementById('liveTurnSpan');
  if (liveSpan) {
    const turnText = liveSpan.textContent.trim();
    if (turnText) {
      const textNode = document.createTextNode((messageEl.textContent.trim() ? " " : "") + turnText);
      liveSpan.replaceWith(textNode);
    } else {
      liveSpan.remove();
    }
  }
  baseText = messageEl.innerText;
  activeTurnText = "";
  updateStats();
}

function onEditorInput() {
  if (!messageEl) return;
  const liveSpan = document.getElementById('liveTurnSpan');
  if (liveSpan) {
    const clone = messageEl.cloneNode(true);
    const tempLiveSpan = clone.querySelector('#liveTurnSpan');
    if (tempLiveSpan) tempLiveSpan.remove();
    baseText = clone.innerText;
  } else {
    baseText = messageEl.innerText;
  }
  updateStats();
}

// Dropdown & Model Switcher
function toggleModelDropdown(event) {
  if (event) event.stopPropagation();
  if (customModelSwitcher) {
    const isOpen = customModelSwitcher.classList.toggle('open');
    if (modelSwitcherTrigger) {
      modelSwitcherTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  }
}

function closeModelDropdown() {
  if (customModelSwitcher) {
    customModelSwitcher.classList.remove('open');
    if (modelSwitcherTrigger) {
      modelSwitcherTrigger.setAttribute('aria-expanded', 'false');
    }
  }
}

async function selectCustomModel(value, label, element) {
  if (selectedModel === value) {
    closeModelDropdown();
    return;
  }

  selectedModel = value;
  
  if (selectedModelLabel) selectedModelLabel.textContent = label;

  const options = document.querySelectorAll('.model-option');
  options.forEach(opt => {
    opt.classList.remove('active');
    opt.setAttribute('aria-selected', 'false');
  });
  if (element) {
    element.classList.add('active');
    element.setAttribute('aria-selected', 'true');
  }

  closeModelDropdown();

  if (isRecording) {
    if (switchTimer) clearTimeout(switchTimer);

    let modelName = "Deepgram Nova-3";
    if (value === "universal-streaming-english") modelName = "AssemblyAI Fast";
    if (value === "universal-3-5-pro") modelName = "AssemblyAI 3.5 Pro";

    updateRecordingState(true, true, `Switching to ${modelName}...`);

    // Cleanly stop existing pipeline before launching new stream
    stopAudioAndWebSocket();

    switchTimer = setTimeout(async () => {
      await startRecording();
    }, 250);
  }
}

function stopAudioAndWebSocket() {
  if (ws) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        if (selectedModel === 'deepgram-nova-3') {
          ws.send(JSON.stringify({ type: "CloseStream" }));
        } else {
          ws.send(JSON.stringify({ type: "Terminate" }));
        }
      }
      ws.close();
    } catch (e) {}
    ws = null;
  }

  if (microphone) {
    microphone.stopRecording();
    microphone = null;
  }
}

// Recording Controls & Lifecycle
function updateRecordingState(recording, connected = false, customStatus = null) {
  isRecording = recording;

  document.body.classList.toggle('is-recording', recording);

  if (recordButton) {
    recordButton.disabled = false;
    recordButton.classList.toggle('recording', recording);
    recordButton.setAttribute('aria-pressed', recording ? 'true' : 'false');
  }

  if (buttonText) {
    buttonText.textContent = recording ? 'Stop Recording' : 'Start Recording';
  }

  if (buttonIcon) {
    if (recording) {
      buttonIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>`;
    } else {
      buttonIcon.innerHTML = `<svg class="mic-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
    }
  }

  if (clearButton) {
    clearButton.disabled = recording;
  }

  if (statusIndicator) {
    statusIndicator.classList.toggle('recording', recording);
    statusIndicator.classList.toggle('connected', !recording && connected);
  }

  let modelLabel = "Deepgram Nova-3";
  if (selectedModel === "universal-streaming-english") modelLabel = "AssemblyAI Fast";
  if (selectedModel === "universal-3-5-pro") modelLabel = "AssemblyAI 3.5 Pro";

  if (statusText) {
    if (customStatus) {
      statusText.textContent = customStatus;
    } else if (recording) {
      statusText.textContent = `Recording (${modelLabel})`;
    } else if (connected) {
      statusText.textContent = 'Connected';
    } else {
      statusText.textContent = 'Ready';
    }
  }

  if (typeof anime !== 'undefined' && recordButton && statusIndicator) {
    anime({
      targets: [recordButton, statusIndicator],
      scale: [0.95, 1],
      duration: 350,
      easing: 'easeOutElastic(1, .8)'
    });
  }
}

async function toggleRecording() {
  if (recordButton && recordButton.disabled) return;
  
  if (isRecording) {
    if (recordButton) recordButton.disabled = true;
    stopRecording();
  } else {
    if (recordButton) recordButton.disabled = true;
    let modelName = "Deepgram Nova-3";
    if (selectedModel === "universal-streaming-english") modelName = "AssemblyAI Fast";
    if (selectedModel === "universal-3-5-pro") modelName = "AssemblyAI 3.5 Pro";

    updateRecordingState(false, true, `Connecting (${modelName})...`);
    await startRecording();
  }
}

async function startRecording() {
  try {
    microphone = createMicrophone();

    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }

    if (selectedModel === 'deepgram-nova-3') {
      const dgToken = await TokenManager.getDeepgramToken();
      if (!dgToken) {
        showToast("Unable to authenticate with Deepgram. Check API credentials.");
        updateRecordingState(false);
        return;
      }

      const dgUrl = 'wss://api.deepgram.com/v1/listen?model=nova-3&language=en&encoding=linear16&sample_rate=16000&smart_format=true&interim_results=true';
      ws = new WebSocket(dgUrl, ['token', dgToken]);

      ws.onopen = async () => {
        try {
          await microphone.startRecording((audioChunk) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(audioChunk);
            }
          });
          updateRecordingState(true, true);
        } catch (micErr) {
          console.error("Mic initialization failed:", micErr);
          showToast("Microphone access denied or unavailable");
          stopRecording();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "Results" && msg.channel?.alternatives?.[0]) {
            const transcript = msg.channel.alternatives[0].transcript || "";
            if (!transcript.trim()) return;

            if (msg.is_final) {
              activeTurnText = transcript;
              commitActiveTurn();
            } else {
              activeTurnText = transcript;
              renderTranscript();
            }
          }
        } catch (e) {
          console.error("Deepgram message parse error:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("Deepgram WebSocket error:", err);
        showToast("Connection issue with Deepgram");
        handleStreamEnded();
      };

      ws.onclose = () => {
        handleStreamEnded();
      };

    } else {
      // AssemblyAI Realtime Engine
      const token = await TokenManager.getAssemblyAiToken();
      if (!token) {
        showToast("Unable to authenticate with AssemblyAI. Check API credentials.");
        updateRecordingState(false);
        return;
      }

      const endpoint = `wss://streaming.assemblyai.com/v3/ws?speech_model=${selectedModel}&language_code=en&sample_rate=16000&encoding=pcm_s16le&token=${token}`;
      ws = new WebSocket(endpoint);

      ws.onopen = async () => {
        try {
          await microphone.startRecording((audioChunk) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(audioChunk);
            }
          });
          updateRecordingState(true, true);
        } catch (micErr) {
          console.error("Mic initialization failed:", micErr);
          showToast("Microphone access denied or unavailable");
          stopRecording();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "Turn") {
            const { turn_order, transcript } = msg;
            if (currentTurnOrder !== null && turn_order !== currentTurnOrder) {
              commitActiveTurn();
            }
            currentTurnOrder = turn_order;
            activeTurnText = transcript || "";
            renderTranscript();
          } else if (msg.type === "Termination") {
            handleStreamEnded();
          }
        } catch (e) {
          console.error("AssemblyAI message parse error:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("AssemblyAI WebSocket error:", err);
        showToast("Connection issue with AssemblyAI");
        handleStreamEnded();
      };

      ws.onclose = (evt) => {
        if (evt.code === 1008) {
          showToast("Session conflict (Too many concurrent streams)");
        }
        handleStreamEnded();
      };
    }

  } catch (error) {
    console.error("Error starting recording:", error);
    showToast("Error accessing microphone. Check permissions.");
    handleStreamEnded();
  }
}

function handleStreamEnded() {
  if (isRecording) {
    stopRecording();
  } else {
    updateRecordingState(false);
  }
}

function stopRecording() {
  stopAudioAndWebSocket();
  commitActiveTurn();
  currentTurnOrder = null;
  updateRecordingState(false);
}

// Utility Actions: Grammar, Copy, Download, Clear
async function fixGrammar() {
  if (!messageEl) return;
  const text = messageEl.innerText.trim();

  if (!text) {
    showToast('No text to fix!');
    return;
  }

  if (grammarButton) grammarButton.classList.add('loading');

  try {
    const res = await fetch('/api/grammar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10000)
    });

    const data = await res.json();

    if (data.correctedText !== undefined) {
      baseText = data.correctedText;
      activeTurnText = "";
      currentTurnOrder = null;
      messageEl.innerText = baseText;
      const liveSpan = document.getElementById('liveTurnSpan');
      if (liveSpan) liveSpan.remove();
      updateStats();
      showToast('✨ Grammar polished & corrected!');
    } else {
      showToast('Grammar check complete!');
    }
  } catch (err) {
    console.error('Grammar check error:', err);
    showToast('Failed to process grammar');
  } finally {
    if (grammarButton) grammarButton.classList.remove('loading');
  }
}

async function copyToClipboard() {
  if (!messageEl) return;
  const text = messageEl.innerText.trim();

  if (!text) {
    showToast('No text to copy!');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    
    if (copyButton) {
      const copyIcon = copyButton.querySelector('.copy-icon');
      const tickIcon = copyButton.querySelector('.tick-icon');

      if (copyIcon && tickIcon) {
        copyIcon.style.display = 'none';
        tickIcon.style.display = 'inline-block';
        showToast('Copied to clipboard!');
        
        if (typeof anime !== 'undefined') {
          anime({
            targets: tickIcon,
            scale: [0.8, 1],
            duration: 300,
            easing: 'easeOutQuad'
          });
        }

        setTimeout(() => {
          copyIcon.style.display = 'inline-block';
          tickIcon.style.display = 'none';
        }, 2000);
      }
    }
  } catch (err) {
    showToast('Failed to copy');
  }
}

function downloadTranscript() {
  if (!messageEl) return;
  const text = messageEl.innerText.trim();
  if (!text) {
    showToast('No text to download!');
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

function clearTranscription() {
  if (!messageEl) return;
  if (messageEl.innerText.trim().length > 0) {
    baseText = "";
    activeTurnText = "";
    currentTurnOrder = null;
    messageEl.innerText = "";
    const liveSpan = document.getElementById('liveTurnSpan');
    if (liveSpan) liveSpan.remove();
    updateStats();
    showToast('Cleared');
  }
}

// Bind DOM event listeners (unobtrusive JS)
document.addEventListener('DOMContentLoaded', () => {
  updateRecordingState(false);
  
  if (messageEl) {
    messageEl.addEventListener('input', onEditorInput);
  }

  if (recordButton) {
    recordButton.addEventListener('click', toggleRecording);
  }

  if (grammarButton) {
    grammarButton.addEventListener('click', fixGrammar);
  }

  if (copyButton) {
    copyButton.addEventListener('click', copyToClipboard);
  }

  if (downloadButton) {
    downloadButton.addEventListener('click', downloadTranscript);
  }

  if (clearButton) {
    clearButton.addEventListener('click', clearTranscription);
  }

  if (modelSwitcherTrigger) {
    modelSwitcherTrigger.addEventListener('click', toggleModelDropdown);
  }

  // Model option selection
  const modelOptions = document.querySelectorAll('.model-option');
  modelOptions.forEach((opt) => {
    opt.addEventListener('click', (e) => {
      const val = opt.getAttribute('data-value');
      const label = opt.textContent.trim();
      selectCustomModel(val, label, opt);
    });
  });

  // Global click listener to close custom dropdown
  document.addEventListener('click', (e) => {
    if (customModelSwitcher && !customModelSwitcher.contains(e.target)) {
      closeModelDropdown();
    }
  });

  updateStats();
});

window.addEventListener('beforeunload', (e) => {
  if (isRecording) {
    stopRecording();
  }
  if (globalAudioContext && globalAudioContext.state !== 'closed') {
    globalAudioContext.close();
  }
  if (messageEl && messageEl.innerText.trim().length > 50) {
    // Standard prompt to guard unsaved content
    e.preventDefault();
    e.returnValue = '';
  }
});
