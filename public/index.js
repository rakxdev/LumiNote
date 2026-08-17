/* global anime */

/**
 * LumiNote v03 Client Engine
 * Real-time voice intelligence streaming with AssemblyAI v3 & Deepgram Nova-3
 * Dual-World Mode (RodeX Obsidian & Wabi-Sabi Silk)
 */

// DOM Elements
const recordButton = document.getElementById("recordButton");
const buttonText = document.getElementById("buttonText");
const messageEl = document.getElementById("message");
const statusStamp = document.getElementById("statusStamp");
const copyFeedback = document.getElementById("copyFeedback");
const wordCountEl = document.getElementById("wordCount");
const charCountEl = document.getElementById("charCount");
const grammarButton = document.getElementById("grammarButton");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const clearButton = document.getElementById("clearButton");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const customModelSwitcher = document.getElementById("customModelSwitcher");
const modelSwitcherTrigger = document.getElementById("modelSwitcherTrigger");
const modelDropdownMenu = document.getElementById("modelDropdownMenu");
const selectedModelLabel = document.getElementById("selectedModelLabel");

// Session state
let isRecording = false;
let ws = null;
let microphone = null;
let selectedModel = "universal-3-5-pro"; // Default: AssemblyAI Universal-3.5 Pro
let switchTimer = null;

// Editor state
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

// Token & Session Auth Manager
const TokenManager = {
  assemblyAiToken: null,
  assemblyAiTokenTimestamp: null,

  async getAssemblyAiToken() {
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

// Web Audio Real-Time Analyser Pipeline
let liveAnalyser = null;
let liveDataArray = null;
let animFrameId = null;

function setupLiveAnalyser(audioCtx) {
  try {
    liveAnalyser = audioCtx.createAnalyser();
    liveAnalyser.fftSize = 128;
    liveAnalyser.smoothingTimeConstant = 0.8;
    liveAnalyser.minDecibels = -90;
    liveAnalyser.maxDecibels = -10;
    
    liveDataArray = new Uint8Array(liveAnalyser.frequencyBinCount);
    return liveAnalyser;
  } catch (err) {
    console.error("Failed to setup Live Web Audio Analyser:", err);
    return null;
  }
}

function renderOscilloscopeFrame() {
  const headerCanvas = document.getElementById("fftOscilloscope");
  const bgCanvas = document.getElementById("waveformCanvasBackdrop");
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // 1. Render Header Oscilloscope Pill
  if (headerCanvas) {
    const ctx = headerCanvas.getContext("2d");
    ctx.clearRect(0, 0, headerCanvas.width, headerCanvas.height);

    if (!isRecording) {
      // Idle straight resting line
      ctx.beginPath();
      ctx.moveTo(0, headerCanvas.height / 2);
      ctx.lineTo(headerCanvas.width, headerCanvas.height / 2);
      ctx.strokeStyle = isLight ? 'rgba(43,38,33,0.2)' : 'rgba(217,182,74,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      let isSynthetic = false;
      
      if (liveAnalyser) {
        liveAnalyser.getByteFrequencyData(liveDataArray);
        // Check if there is actual audio energy coming through
        let totalEnergy = 0;
        for (let i = 0; i < liveDataArray.length; i++) {
          totalEnergy += liveDataArray[i];
        }
        if (totalEnergy < 10) {
          isSynthetic = true; // Fallback to synthetic if hardware muted/silenced
        }
      } else {
        isSynthetic = true;
      }

      const numBars = 16;
      const barWidth = Math.max(2, (headerCanvas.width / numBars) - 2);
      const time = Date.now() * 0.005;

      for (let i = 0; i < numBars; i++) {
        let norm = 0.05; // Base height
        
        if (isSynthetic) {
          // Synthetic organic audio wave simulation
          const noise = Math.random() * 0.15;
          const wave1 = Math.sin(time * 1.5 + i * 0.3) * 0.5 + 0.5;
          const wave2 = Math.sin(time * 0.8 - i * 0.5) * 0.5 + 0.5;
          const pulse = Math.sin(time * 0.2) * 0.3 + 0.7; 
          const syntheticNorm = ((wave1 * 0.6 + wave2 * 0.4) * pulse) + noise;
          norm = Math.min(1, Math.max(0.05, syntheticNorm));
        } else {
          // Hardware Analyser rendering
          const step = Math.floor(liveDataArray.length / numBars);
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += liveDataArray[i * step + j] || 0;
          }
          const val = sum / step;
          const targetNorm = val / 255;
          // Boost sensitivity for better visualizer response
          norm = Math.min(1, targetNorm * 1.8 + 0.05);
        }
        
        // Responsive bar height
        const barHeight = Math.max(2, norm * (headerCanvas.height - 2));
        const x = i * (barWidth + 2);
        const y = headerCanvas.height - barHeight;

        const grad = ctx.createLinearGradient(0, headerCanvas.height, 0, 0);
        if (isLight) {
          grad.addColorStop(0, '#b91c1c');
          grad.addColorStop(1, '#d97706');
        } else {
          grad.addColorStop(0, '#d9b64a');
          grad.addColorStop(1, '#e8452c');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }
    }
  }

  // 2. Render Full-Canvas Time-Domain Voice Waveform in Background
  if (bgCanvas) {
    const bgCtx = bgCanvas.getContext("2d");
    if (bgCanvas.width !== bgCanvas.offsetWidth || bgCanvas.height !== bgCanvas.offsetHeight) {
      bgCanvas.width = bgCanvas.offsetWidth;
      bgCanvas.height = bgCanvas.offsetHeight;
    }

    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    if (isRecording) {
      bgCtx.beginPath();
      bgCtx.lineWidth = 1.5;
      bgCtx.strokeStyle = isLight ? 'rgba(185, 28, 28, 0.4)' : 'rgba(217, 182, 74, 0.35)';

      let isSyntheticBg = false;
      let timeDomainData = null;

      if (liveAnalyser) {
        timeDomainData = new Uint8Array(liveAnalyser.fftSize);
        liveAnalyser.getByteTimeDomainData(timeDomainData);
        // Check if flatlined (128 is center)
        let hasEnergy = false;
        for (let i = 0; i < timeDomainData.length; i++) {
          if (Math.abs(timeDomainData[i] - 128) > 2) {
            hasEnergy = true; break;
          }
        }
        if (!hasEnergy) isSyntheticBg = true;
      } else {
        isSyntheticBg = true;
      }

      if (isSyntheticBg) {
        // Synthetic wave
        const time = Date.now() * 0.003;
        const amplitude = (Math.sin(time * 0.5) * 0.5 + 0.5) * 60 + 20;
        const sliceWidth = bgCanvas.width / 128;
        let x = 0;
        for (let i = 0; i < 128; i++) {
          const wave = Math.sin(i * 0.1 + time * 2) * Math.cos(i * 0.05 - time);
          const y = (bgCanvas.height / 2) + (wave * amplitude);
          if (i === 0) bgCtx.moveTo(x, y);
          else bgCtx.lineTo(x, y);
          x += sliceWidth;
        }
      } else {
        // Hardware waveform
        const sliceWidth = bgCanvas.width / timeDomainData.length;
        let x = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          // Amplify the waveform slightly for visibility
          const v = ((timeDomainData[i] - 128) * 1.5 + 128) / 128.0; 
          const y = (v * bgCanvas.height) / 2;
          if (i === 0) bgCtx.moveTo(x, y);
          else bgCtx.lineTo(x, y);
          x += sliceWidth;
        }
      }

      bgCtx.stroke();
    }
  }

  if (isRecording) {
    animFrameId = requestAnimationFrame(renderOscilloscopeFrame);
  }
}

function startOscilloscope() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  renderOscilloscopeFrame();
}

function stopOscilloscope() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (liveAnalyser) {
    try { liveAnalyser.disconnect(); } catch (e) {}
    liveAnalyser = null;
  }
  liveDataArray = null;
  renderOscilloscopeFrame();
}

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
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      source = audioContext.createMediaStreamSource(stream);

      // Connect standard Web Audio Analyser directly to microphone input stream
      const analyser = setupLiveAnalyser(audioContext);

      await audioContext.audioWorklet.addModule('audio-processor.js');

      audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

      // The critical fix: ensure the AnalyserNode is fully connected in the active graph path
      // source -> analyser -> worklet -> destination
      if (analyser) {
        source.connect(analyser);
        analyser.connect(audioWorkletNode);
      } else {
        source.connect(audioWorkletNode);
      }
      
      audioWorkletNode.connect(audioContext.destination);

      startOscilloscope();

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
      stopOscilloscope();

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

// Toast Feedback
function showToast(message) {
  const toastText = document.getElementById('toastText');
  if (toastText) {
    toastText.textContent = message;
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
  
  if (wordCountEl) wordCountEl.textContent = `${words} WORD${words === 1 ? '' : 'S'}`;
  if (charCountEl) charCountEl.textContent = `${chars} CHARACTER${chars === 1 ? '' : 'S'}`;
}

function scrollToBottomSmart() {
  if (!messageEl) return;
  const distanceFromBottom = messageEl.scrollHeight - messageEl.clientHeight - messageEl.scrollTop;
  if (distanceFromBottom < 120 || document.activeElement !== messageEl) {
    messageEl.scrollTop = messageEl.scrollHeight;
  }
}

// Render Transcript with Live Word Highlight
function renderTranscript() {
  if (!messageEl) return;
  let liveSpan = document.getElementById('liveTurnSpan');
  const cleanTurn = activeTurnText.trim();

  if (cleanTurn) {
    if (!liveSpan) {
      liveSpan = document.createElement('span');
      liveSpan.id = 'liveTurnSpan';
      liveSpan.className = 'live-turn-span';
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
  saveDraftToStorage();
}

// Autosave & Local Draft Recovery
const DRAFT_STORAGE_KEY = "luminote_v03_saved_draft";

function saveDraftToStorage() {
  if (!messageEl) return;
  const content = messageEl.innerText;
  if (content && content.trim().length > 0) {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, content);
    } catch (e) {}
  } else {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
  }
}

function restoreDraftFromStorage() {
  if (!messageEl) return;
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved && saved.trim().length > 0 && messageEl.innerText.trim().length === 0) {
      messageEl.innerText = saved;
      baseText = saved;
      updateStats();
      showToast("Restored unsaved draft from local storage");
    }
  } catch (e) {}
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
  saveDraftToStorage();
}

// Dual Theme Switcher (Dark Mode / Light Mode)
function toggleDualMode() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('luminote_theme', next);

  updateThemeControls(next);
  showToast(next === 'dark' ? 'RodeX Obsidian Dark Activated' : 'Wabi-Sabi Silk Light Activated');
}

function updateThemeControls(theme) {
  const iconSlot = document.getElementById('themeIconSlot');

  if (theme === 'dark') {
    if (iconSlot) {
      iconSlot.innerHTML = `<svg class="theme-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>`;
    }
  } else {
    if (iconSlot) {
      iconSlot.innerHTML = `<svg class="theme-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>`;
    }
  }
}

// Model Switcher
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

  const options = document.querySelectorAll('.engine-opt');
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

    updateRecordingState(true, true, `SWITCHING...`);

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

// Recording Controls & State Updates
function updateRecordingState(recording, connected = false, customStatus = null) {
  isRecording = recording;
  document.body.classList.toggle('is-recording', recording);

  if (recordButton) {
    recordButton.disabled = false;
    recordButton.classList.toggle('recording', recording);
    recordButton.setAttribute('aria-pressed', recording ? 'true' : 'false');
  }

  if (buttonText) {
    buttonText.textContent = recording ? 'Stop Dictating' : 'Start Dictating';
  }

  if (clearButton) {
    clearButton.disabled = recording;
  }

  if (statusStamp) {
    statusStamp.classList.toggle('recording', recording);
    if (customStatus) {
      statusStamp.textContent = customStatus;
    } else if (recording) {
      statusStamp.textContent = 'TRANSMITTING';
    } else if (connected) {
      statusStamp.textContent = 'LINKED';
    } else {
      statusStamp.textContent = 'READY';
    }
  }
}

async function toggleRecording() {
  if (recordButton && recordButton.disabled) return;
  
  if (isRecording) {
    if (recordButton) recordButton.disabled = true;
    stopRecording();
  } else {
    if (recordButton) recordButton.disabled = true;
    updateRecordingState(false, true, `CONNECTING...`);
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
        showToast("Unable to authenticate with Deepgram. Check credentials.");
        updateRecordingState(false);
        return;
      }

      // Pass token via query parameter (or subprotocol fallback) to prevent Sec-WebSocket-Protocol header length rejection
      const dgUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&language=en&encoding=linear16&sample_rate=16000&smart_format=true&interim_results=true&access_token=${encodeURIComponent(dgToken)}`;
      ws = new WebSocket(dgUrl);

      ws.onopen = async () => {
        try {
          await microphone.startRecording((audioChunk) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(audioChunk);
            }
          });
          updateRecordingState(true, true);
          showToast("Acoustic Stream Engaged (150ms)");
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
      // AssemblyAI Engine
      const token = await TokenManager.getAssemblyAiToken();
      if (!token) {
        showToast("Unable to authenticate with AssemblyAI.");
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
          showToast("Acoustic Stream Engaged (AssemblyAI)");
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
  showToast("Stream Committed");
}

// Utility Actions: Grammar, Copy, Download, Clear
async function fixGrammar() {
  if (!messageEl) return;
  const text = messageEl.innerText.trim();

  if (!text) {
    showToast('No text to polish!');
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
      showToast('✨ Vāk Sanskāra: Grammar polished & structured!');
    } else {
      showToast('Grammar analysis verified: Text is clean');
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
        showToast('Copied to clipboard [⌘C]');
        
        if (typeof anime !== 'undefined') {
          anime({
            targets: tickIcon,
            scale: [0.7, 1.15, 1],
            rotate: [-10, 5, 0],
            duration: 350,
            easing: 'easeOutElastic(1, .6)'
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
  a.download = `LumiNote-Vak-Transcript-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Transcript Exported');
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
    saveDraftToStorage();
    showToast('Canvas Purged');
  }
}

// Bind DOM Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved theme
  const savedTheme = localStorage.getItem('luminote_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeControls(savedTheme);
  } else {
    updateThemeControls('dark');
  }

  updateRecordingState(false);
  
  if (messageEl) {
    messageEl.addEventListener('input', onEditorInput);
  }

  if (recordButton) {
    recordButton.addEventListener('click', toggleRecording);
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleDualMode);
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

  const modelOptions = document.querySelectorAll('.engine-opt');
  modelOptions.forEach((opt) => {
    opt.addEventListener('click', (e) => {
      const val = opt.getAttribute('data-value');
      const label = opt.querySelector('.opt-title').textContent.trim();
      selectCustomModel(val, label, opt);
    });
  });

  document.addEventListener('click', (e) => {
    if (customModelSwitcher && !customModelSwitcher.contains(e.target)) {
      closeModelDropdown();
    }
  });

  // Global Keyboard Shortcuts (Space to dictate, Escape to close dropdown)
  document.addEventListener('keydown', (e) => {
    // Escape key closes dropdown
    if (e.key === 'Escape') {
      closeModelDropdown();
      return;
    }

    // Space key toggles recording when not actively typing inside the editor
    if (e.code === 'Space' && document.activeElement !== messageEl) {
      e.preventDefault();
      toggleRecording();
    }
  });

  restoreDraftFromStorage();
  updateStats();

  // Initialize Oscilloscope in idle state
  const canvas = document.getElementById("fftOscilloscope");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(43,38,33,0.15)' : 'rgba(217,182,74,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
});

window.addEventListener('beforeunload', (e) => {
  if (isRecording) {
    stopRecording();
  }
  if (globalAudioContext && globalAudioContext.state !== 'closed') {
    globalAudioContext.close();
  }
  if (messageEl && messageEl.innerText.trim().length > 50) {
    e.preventDefault();
    e.returnValue = '';
  }
});
