/* global anime */

import { appendPcmChunk } from './audio-processor.js';
import { generateRoomCode, sanitizeRoomCode, isValidRoomCode } from './link-protocol.js';
import { meterAdvance, dbToNorm, rms16 } from './viz.js';

/**
 * LumiNote v04 Client Engine
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
const selectedModelLabel = document.getElementById("selectedModelLabel");

// Link Mode elements
const linkToggleBtn = document.getElementById("linkToggleBtn");
const linkOverlay = document.getElementById("linkOverlay");
const linkCloseBtn = document.getElementById("linkCloseBtn");
const linkRoomCodeEl = document.getElementById("linkRoomCode");
const linkCopyCodeBtn = document.getElementById("linkCopyCodeBtn");
const linkQrWrap = document.getElementById("linkQrWrap");
const linkJoinInput = document.getElementById("linkJoinInput");
const linkJoinBtn = document.getElementById("linkJoinBtn");
const linkStatusDot = document.getElementById("linkStatusDot");
const linkStatusText = document.getElementById("linkStatusText");
const linkDevicesEl = document.getElementById("linkDevices");
const linkLeaveBtn = document.getElementById("linkLeaveBtn");
// Authenticator login (TOTP) elements
const linkAuthSection = document.getElementById("linkAuthSection");
const linkAuthSetup = document.getElementById("linkAuthSetup");
const linkTotpSetupBtn = document.getElementById("linkTotpSetupBtn");
const linkTotpQrWrap = document.getElementById("linkTotpQrWrap");
const linkTotpSecret = document.getElementById("linkTotpSecret");
const linkTotpConfirmRow = document.getElementById("linkTotpConfirmRow");
const linkTotpConfirmInput = document.getElementById("linkTotpConfirmInput");
const linkTotpConfirmBtn = document.getElementById("linkTotpConfirmBtn");
const linkTotpRecovery = document.getElementById("linkTotpRecovery");
const linkAuthGate = document.getElementById("linkAuthGate");
const linkAuthInput = document.getElementById("linkAuthInput");
const linkAuthBtn = document.getElementById("linkAuthBtn");
const linkAuthError = document.getElementById("linkAuthError");
const linkAuthActive = document.getElementById("linkAuthActive");
const clipboardTray = document.getElementById("clipboardTray");
const trayText = document.getElementById("trayText");
const trayCopyBtn = document.getElementById("trayCopyBtn");
const trayDismissBtn = document.getElementById("trayDismissBtn");
const pushButton = document.getElementById("pushButton");

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
// Tokens are cached per model slug: different models may be minted by
// different AssemblyAI account keys, so a cached token is only reusable for
// the model it was issued under.
const TokenManager = {
  assemblyAiTokens: new Map(), // model slug -> { token, timestamp }

  async getAssemblyAiToken() {
    const model = selectedModel;
    const cached = this.assemblyAiTokens.get(model);
    if (cached) {
      const ageSeconds = (Date.now() - cached.timestamp) / 1000;
      if (ageSeconds < 480) {
        return cached.token;
      }
    }

    try {
      const res = await fetch(
        `/api/token?model=${encodeURIComponent(model)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
      const data = await res.json();
      if (data.token) {
        this.assemblyAiTokens.set(model, { token: data.token, timestamp: Date.now() });
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
let liveFreqData = null; // Float32Array of dBFS bins while recording

// Voice pill state: smoothed per-bar heights and the remote-voice scalar.
const VIZ_BAR_COUNT = 12;
const barDisp = new Float32Array(VIZ_BAR_COUNT);
let remoteLevelTarget = 0;
let remoteLevelDisp = 0;
let lastRemoteLevelAt = 0;
const REMOTE_LEVEL_STALE_MS = 2000;

function setupLiveAnalyser(audioCtx) {
  try {
    liveAnalyser = audioCtx.createAnalyser();
    liveAnalyser.fftSize = 512;
    liveAnalyser.smoothingTimeConstant = 0.3;
    liveAnalyser.minDecibels = -90;
    liveAnalyser.maxDecibels = -10;
    liveFreqData = new Float32Array(liveAnalyser.frequencyBinCount);
    return liveAnalyser;
  } catch (err) {
    console.error("Failed to setup Live Web Audio Analyser:", err);
    return null;
  }
}

function stopLiveAnalyser() {
  if (liveAnalyser) {
    try { liveAnalyser.disconnect(); } catch (e) {}
    liveAnalyser = null;
  }
  liveFreqData = null;
}

/**
 * Per-bar target heights (0..1) for the pill:
 * - local voice: real FFT bins in log-spaced groups, dB-mapped over the
 *   speech range (the old linear byte-averaging read near-zero for voice);
 * - remote voice: the streamed level scalar shaped as a decaying spectrum;
 * - idle: a faint breathing floor. Silence never draws a fake wave.
 */
function vizBarTargets() {
  const targets = new Float32Array(VIZ_BAR_COUNT);
  if (isRecording && liveAnalyser) {
    liveAnalyser.getFloatFrequencyData(liveFreqData);
    const usable = Math.max(2, Math.floor(liveFreqData.length / 4));
    const span = usable - 1;
    for (let i = 0; i < VIZ_BAR_COUNT; i++) {
      const lo = 1 + Math.floor(span * Math.pow(i / VIZ_BAR_COUNT, 1.6));
      const hi = Math.max(lo + 1, 1 + Math.floor(span * Math.pow((i + 1) / VIZ_BAR_COUNT, 1.6)));
      let peak = -90;
      for (let b = lo; b < Math.min(hi, liveFreqData.length); b++) {
        if (liveFreqData[b] > peak) peak = liveFreqData[b];
      }
      targets[i] = dbToNorm(peak);
    }
    return targets;
  }
  if (!isRecording && lastRemoteLevelAt > 0) {
    // Remote voice: drive the spectrum from the streamed scalar, and drain
    // smoothly back to the idle floor when it goes quiet (no hard pop).
    remoteLevelDisp = meterAdvance(remoteLevelDisp, Date.now() - lastRemoteLevelAt < REMOTE_LEVEL_STALE_MS ? remoteLevelTarget : 0);
    if (remoteLevelDisp > 0.01) {
      for (let i = 0; i < VIZ_BAR_COUNT; i++) {
        targets[i] = remoteLevelDisp * (1 - i / (VIZ_BAR_COUNT + 2));
      }
      return targets;
    }
  }
  const breathe = 0.025 + (Math.sin(Date.now() * 0.0012) * 0.5 + 0.5) * 0.03;
  targets.fill(breathe);
  return targets;
}

function renderOscilloscopeFrame() {
  const headerCanvas = document.getElementById("fftOscilloscope");
  const bgCanvas = document.getElementById("waveformCanvasBackdrop");
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // 1. Render Header Oscilloscope Pill
  if (headerCanvas) {
    const ctx = headerCanvas.getContext("2d", { alpha: false });
    // Fill solid background instead of clearRect for composite optimization
    ctx.fillStyle = isLight ? '#f4efe6' : '#101318';
    ctx.fillRect(0, 0, headerCanvas.width, headerCanvas.height);

    const W = headerCanvas.width;
    const H = headerCanvas.height;
    const targets = vizBarTargets();
    const gap = 4;
    const barWidth = Math.max(4, (W - gap * (VIZ_BAR_COUNT + 1)) / VIZ_BAR_COUNT);

    for (let i = 0; i < VIZ_BAR_COUNT; i++) {
      barDisp[i] = meterAdvance(barDisp[i], targets[i]);
      const barHeight = Math.max(3, barDisp[i] * (H - 4));
      const x = gap + i * (barWidth + gap);
      const y = H - 2 - barHeight;

      const grad = ctx.createLinearGradient(0, H, 0, 0);
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

  // 2. Render Full-Canvas Time-Domain Voice Waveform in Background
  if (bgCanvas) {
    const bgCtx = bgCanvas.getContext("2d", { alpha: true });

    // Only resize if actually needed (prevents layout thrashing)
    if (bgCanvas.width !== bgCanvas.offsetWidth || bgCanvas.height !== bgCanvas.offsetHeight) {
      bgCanvas.width = bgCanvas.offsetWidth;
      bgCanvas.height = bgCanvas.offsetHeight;
    }

    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    if (isRecording && liveAnalyser) {
      const timeDomainData = new Uint8Array(liveAnalyser.fftSize);
      liveAnalyser.getByteTimeDomainData(timeDomainData);
      // Check if flatlined (128 is center): silence draws nothing —
      // the old code painted a fake wave exactly when the mic was quiet.
      let hasEnergy = false;
      for (let i = 0; i < timeDomainData.length; i++) {
        if (Math.abs(timeDomainData[i] - 128) > 2) {
          hasEnergy = true; break;
        }
      }
      if (hasEnergy) {
        bgCtx.beginPath();
        bgCtx.lineWidth = 1.5;
        bgCtx.strokeStyle = isLight ? 'rgba(185, 28, 28, 0.4)' : 'rgba(217, 182, 74, 0.35)';
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
        bgCtx.stroke();
      }
    }
  }
}

// The meter loop runs for the life of the page (the pill is always on
// screen): full frame rate while a voice is being tracked, 15fps when idle
// so an unlinked, non-recording page stays cheap on battery.
let lastVizDrawAt = 0;
function vizLoop(ts) {
  requestAnimationFrame(vizLoop);
  const busy = isRecording || !!LinkManager.room;
  if (!busy && ts - lastVizDrawAt < 1000 / 15) return;
  lastVizDrawAt = ts;
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
          noiseSuppression: true,
          // Normalize quiet voices toward a healthy level before any model
          // sees the audio (reported low-voice accuracy complaint).
          autoGainControl: true
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

      // The meter loop runs for the life of the page (vizLoop); it picks
      // up the new analyser automatically on the next frame.

      const batchSamples = Math.floor(audioContext.sampleRate * 0.1);
      audioWorkletNode.port.onmessage = (event) => {
        const currentBuffer = new Int16Array(event.data.audio_data);
        const result = appendPcmChunk(audioBufferQueue, currentBuffer, batchSamples);
        audioBufferQueue = result.queue;

        if (result.batch && onAudioCallback) {
          onAudioCallback(result.batch);
        }
      };
    },

    resetBuffer() {
      audioBufferQueue = new Int16Array(0);
    },

    // Return whatever is left of the batch queue (less than one batch) as
    // a byte view, so the caller can send it before the stream closes and
    // the tail of the last word is not clipped at the batch boundary.
    flushRemaining() {
      const remaining = audioBufferQueue;
      audioBufferQueue = new Int16Array(0);
      if (remaining.length === 0) return null;
      return new Uint8Array(remaining.buffer, 0, remaining.length * 2);
    },

    stopRecording() {
      stopLiveAnalyser();

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
let lastInterimSent = 0;

function renderTranscript() {
  if (!messageEl) return;
  let liveSpan = document.getElementById('liveTurnSpan');
  const cleanTurn = activeTurnText.trim();

  // Throttled live preview for linked devices
  const now = Date.now();
  if (cleanTurn && now - lastInterimSent > 150) {
    lastInterimSent = now;
    LinkManager.send({ type: "interim", text: cleanTurn });
  }

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
      // Relay the committed turn to linked devices
      LinkManager.send({ type: "turn", text: turnText });
    } else {
      liveSpan.remove();
    }
  }
  baseText = messageEl.innerText;
  activeTurnText = "";
  updateStats();
  saveDraftToStorage();
}

// Link Mode relay: remote events into the local editor
let remoteInterimTimer = null;

function appendRemoteTurn(text) {
  if (!messageEl || !text || !text.trim()) return;
  const liveSpan = document.getElementById('liveTurnSpan');
  const prefix = messageEl.textContent.trim() ? " " : "";
  const node = document.createTextNode(prefix + text.trim());
  if (liveSpan) {
    messageEl.insertBefore(node, liveSpan);
  } else {
    messageEl.appendChild(node);
  }
  hideRemoteInterim();
  updateStats();
  saveDraftToStorage();
  scrollToBottomSmart();
}

function showRemoteInterim(text) {
  const el = document.getElementById('remoteInterim');
  if (!el) return;
  if (!text || !text.trim()) {
    hideRemoteInterim();
    return;
  }
  el.textContent = `◉ ${text.trim()}`;
  // Fade the permanently-reserved zone in (opacity only, never display) so
  // the bar height and its neighbours never shift while words stream in.
  el.classList.add('show');
  clearTimeout(remoteInterimTimer);
  remoteInterimTimer = setTimeout(hideRemoteInterim, 2500);
}

function hideRemoteInterim() {
  const el = document.getElementById('remoteInterim');
  if (el) el.classList.remove('show');
  clearTimeout(remoteInterimTimer);
}

let lastRemoteClipboard = "";

// A pushed clipboard payload lands in BOTH places on this device: the
// transcript editor and the clipboard tray. Newlines survive via <br>
// because the editor collapses them inside plain text nodes.
function appendRemoteClipboardToEditor(text) {
  if (!messageEl || !text || !text.trim()) return;
  const liveSpan = document.getElementById('liveTurnSpan');
  const frag = document.createDocumentFragment();
  if (messageEl.textContent.trim()) frag.appendChild(document.createElement('br'));
  text.replace(/\r/g, '').split('\n').forEach((line, i) => {
    if (i > 0) frag.appendChild(document.createElement('br'));
    frag.appendChild(document.createTextNode(line));
  });
  if (liveSpan) {
    messageEl.insertBefore(frag, liveSpan);
  } else {
    messageEl.appendChild(frag);
  }
  updateStats();
  saveDraftToStorage();
  scrollToBottomSmart();
}

function showRemoteClipboard(text, { replay = false } = {}) {
  if (!text || !text.trim()) return;
  lastRemoteClipboard = text;
  if (trayText) trayText.textContent = text;
  if (clipboardTray) clipboardTray.hidden = false;
  // Fresh pushes flow into the editor too; snapshot replays (reconnect
  // catch-up) must not duplicate the same payload there.
  if (!replay) {
    appendRemoteClipboardToEditor(text);
    saveClip(text, 'receive');
  }
  // Auto-copy is best-effort: browsers require a user gesture (Safari) or a
  // focused document; the tray's Copy button is the guaranteed fallback.
  if (document.hasFocus() && navigator.clipboard) {
    navigator.clipboard.writeText(text).then(
      () => showToast('Remote clipboard ready & copied'),
      () => showToast('Remote clipboard received — tap Copy')
    );
  } else {
    showToast('Remote clipboard received — tap Copy');
  }
}

async function pushToLinkedDevices() {
  const text = messageEl ? messageEl.innerText.trim() : '';
  if (!text) {
    showToast('No text to push!');
    return;
  }
  if (!LinkManager.send({ type: "clipboard", text })) {
    showToast('Link a device first');
    return;
  }
  saveClip(text, 'push');
  showToast('Pushed to linked device');
}

// ==========================================================================
// Saved Library (D1-backed) + hash router. The recorder is a singleton on
// this page: hash navigation swaps views without unloading the audio graph.
// ==========================================================================
const LIBRARY_ROUTES = {
  '/notes': { kind: 'note', title: 'Notes' },
  '/clips': { kind: 'clip', title: 'Clips' },
  '/transcripts': { kind: 'transcript', title: 'Transcripts' },
};

let currentLibraryRoute = null;

function currentRoute() {
  return window.location.hash.replace(/^#/, '') || '/';
}

// POST one entry to /api/notes. Shared by the Save button, clip capture,
// and transcript auto-save. Silent failures toast the error text.
async function saveEntry(kind, text, sourceDevice = null) {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, text: trimmed, source_device: sourceDevice }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return true;
  } catch (err) {
    console.error(`Saving ${kind} failed:`, err);
    showToast(`Could not save ${kind}`);
    return false;
  }
}

async function saveCurrentNote() {
  const text = messageEl ? messageEl.innerText.trim() : '';
  if (!text) {
    showToast('Nothing to save yet!');
    return;
  }
  if (await saveEntry('note', text)) showToast('Saved to Notes');
}

// Every clipboard push/receipt becomes a durable clip, so the clip history
// survives refreshes and device swaps.
function saveClip(text, source) {
  saveEntry('clip', text, source);
}

// One transcript entry per dictation session (fires after the final turn
// commits on stop).
function saveTranscriptSession() {
  const text = messageEl ? messageEl.innerText.trim() : '';
  if (text) saveEntry('transcript', text);
}

function renderLibraryError(message) {
  const list = document.getElementById('libraryList');
  const empty = document.getElementById('libraryEmpty');
  if (list) list.textContent = '';
  if (empty) {
    empty.hidden = false;
    empty.textContent = message;
  }
}

function formatEntryTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Library rows are built with createElement/textContent only — entry text
// is user content and must never hit innerHTML.
function buildLibraryItem(note) {
  const item = document.createElement('article');
  item.className = 'library-item';
  item.dataset.id = note.id;
  if (note.pinned) item.classList.add('pinned');

  const meta = document.createElement('div');
  meta.className = 'item-meta';

  const time = document.createElement('time');
  time.textContent = formatEntryTime(note.created_at);
  meta.appendChild(time);

  const kind = document.createElement('span');
  kind.className = 'item-kind';
  kind.textContent = note.kind;
  meta.appendChild(kind);

  const source = note.source_device ? ` • ${note.source_device}` : '';
  if (source) {
    const src = document.createElement('span');
    src.className = 'item-source';
    src.textContent = source;
    meta.appendChild(src);
  }

  const actions = document.createElement('span');
  actions.className = 'item-actions';
  for (const [act, label] of [['pin', note.pinned ? 'Unpin' : 'Pin'], ['copy', 'Copy'], ['delete', 'Delete']]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `item-act-btn act-${act}`;
    btn.textContent = label;
    btn.dataset.act = act;
    actions.appendChild(btn);
  }
  meta.appendChild(actions);
  item.appendChild(meta);

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const preview = note.text.replace(/\s+/g, ' ').trim();
  summary.textContent = preview.length > 160 ? `${preview.slice(0, 160)}…` : preview;
  details.appendChild(summary);
  const body = document.createElement('p');
  body.className = 'item-body';
  body.textContent = note.text;
  details.appendChild(body);
  item.appendChild(details);

  return item;
}

async function loadLibrary(route) {
  const lib = LIBRARY_ROUTES[route];
  const title = document.getElementById('libraryTitle');
  const list = document.getElementById('libraryList');
  const empty = document.getElementById('libraryEmpty');
  if (!lib || !list) return;
  if (title) title.textContent = lib.title;
  list.textContent = '';
  if (empty) { empty.hidden = true; empty.textContent = 'Nothing saved yet.'; }
  currentLibraryRoute = route;

  try {
    const res = await fetch(`/api/notes?kind=${lib.kind}&limit=100`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (currentLibraryRoute !== route) return; // user navigated away mid-fetch
    const notes = data.notes || [];
    if (empty) empty.hidden = notes.length > 0;
    for (const note of notes) list.appendChild(buildLibraryItem(note));
  } catch (err) {
    console.error('Loading library failed:', err);
    renderLibraryError('Could not load the library. Try Refresh.');
  }
}

async function handleLibraryAction(item, action) {
  const id = item.dataset.id;
  if (!id) return;
  if (action === 'delete') {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(8000) });
      if (!res.ok && res.status !== 404) throw new Error(`status ${res.status}`);
      item.remove();
      const list = document.getElementById('libraryList');
      const empty = document.getElementById('libraryEmpty');
      if (list && !list.children.length && empty) empty.hidden = false;
      showToast('Deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Could not delete');
    }
    return;
  }
  if (action === 'copy') {
    const body = item.querySelector('.item-body');
    if (body && navigator.clipboard) {
      await navigator.clipboard.writeText(body.textContent || '');
      showToast('Copied');
    }
    return;
  }
  if (action === 'pin') {
    const pinned = !item.classList.contains('pinned');
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      item.classList.toggle('pinned', pinned);
      const pinBtn = item.querySelector('.act-pin');
      if (pinBtn) pinBtn.textContent = pinned ? 'Unpin' : 'Pin';
      showToast(pinned ? 'Pinned' : 'Unpinned');
    } catch (err) {
      console.error('Pin failed:', err);
      showToast('Could not pin');
    }
  }
}

// Swap the studio panels for the library view. The transport deck stays
// visible in both, so dictation keeps working while browsing the library.
function renderRoute() {
  const route = currentRoute();
  const libraryRoute = LIBRARY_ROUTES[route] ? route : null;
  const isLibrary = !!libraryRoute;

  const workspaceMain = document.querySelector('.fusion-workspace');
  if (workspaceMain) {
    for (const sel of ['.workspace-top-bar', '#message', '.workspace-bottom-bar']) {
      const panel = workspaceMain.querySelector(sel);
      if (panel) panel.hidden = isLibrary;
    }
  }
  const libraryView = document.getElementById('libraryView');
  if (libraryView) libraryView.hidden = !isLibrary;

  for (const link of document.querySelectorAll('.view-nav a[data-route]')) {
    link.classList.toggle('active', link.dataset.route === route);
  }

  if (isLibrary && libraryRoute !== currentLibraryRoute) loadLibrary(libraryRoute);
}

// Autosave & Local Draft Recovery
const DRAFT_STORAGE_KEY = "luminote_v04_saved_draft";
const LEGACY_DRAFT_STORAGE_KEY = "luminote_v03_saved_draft";

// Last linked room, persisted so a page refresh can rejoin automatically.
const LINK_ROOM_STORAGE_KEY = "luminote_v04_link_room";

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
    // Read-through migration: v03 drafts carry over to the v04 key on first load.
    const saved =
      localStorage.getItem(DRAFT_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
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

// Link Mode: Cross-Device Pairing & Relay
/* global qrcode */

// Durable messages are held briefly while a (re)connecting socket is in
// CONNECTING state; ephemeral interim previews are never queued.
const LINK_OUTBOX_MAX = 50;

// Client keepalive cadence. Well under the ~100s Cloudflare edge idle
// timeout, so a quiet pair (both devices finished talking) is not killed.
const LINK_PING_INTERVAL_MS = 25000;

// Consecutive failed reconnects before giving up and asking the user to
// tap the link button to retry manually.
const MAX_RECONNECT_ATTEMPTS = 10;

// ==========================================================================
// Authenticator login (TOTP). The server keeps the secret and issues a
// signed 12h cookie after a valid code; this side only fetches status,
// drives the setup UI, and asks for a fresh code when the cookie is gone.
// ==========================================================================
let linkAuthResolve = null;

async function fetchAuthStatus(room) {
  try {
    const query = room ? `?room=${encodeURIComponent(room)}` : '';
    const res = await fetch(`/api/auth/status${query}`, { signal: AbortSignal.timeout(4000) });
    return res.ok ? res.json() : null;
  } catch (e) {
    return null;
  }
}

async function postAuthJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// True when the link socket may be opened: login inactive, cookie still
// valid, the ROOM is inside its trust window (a verified device — usually
// the desktop — connected recently, so the phone needs no OTP), the status
// check failed (the server gate decides then), or the user just verified a
// fresh code. Resolves false when the overlay closes mid-prompt so the
// caller silently aborts connecting.
async function ensureLinkAuth(code) {
  const status = await fetchAuthStatus(code);
  if (!status || !status.confirmed || status.auth_valid || status.room_authed) return true;
  if (!linkAuthGate || !linkAuthInput) return true;
  if (linkOverlay) linkOverlay.hidden = false;
  showLinkAuthGate();
  return new Promise((resolve) => {
    linkAuthResolve = resolve;
  });
}

function showLinkAuthGate() {
  if (linkAuthSection) linkAuthSection.hidden = false;
  if (linkAuthSetup) linkAuthSetup.hidden = true;
  if (linkAuthGate) linkAuthGate.hidden = false;
  if (linkAuthActive) linkAuthActive.hidden = true;
  if (linkAuthInput) linkAuthInput.value = '';
  if (linkAuthError) linkAuthError.textContent = '';
  setTimeout(() => linkAuthInput && linkAuthInput.focus(), 60);
}

async function submitLinkAuth() {
  if (!linkAuthInput) return;
  const code = linkAuthInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    if (linkAuthError) linkAuthError.textContent = 'Enter the 6-digit code from your authenticator';
    return;
  }
  if (linkAuthBtn) linkAuthBtn.disabled = true;
  try {
    const { ok, data } = await postAuthJson('/api/auth/challenge', { code });
    if (!ok) {
      if (linkAuthError) linkAuthError.textContent = data.error || 'Wrong code';
      return;
    }
    if (linkAuthGate) linkAuthGate.hidden = true;
    if (linkAuthActive) linkAuthActive.hidden = false;
    // Either a pending connect is waiting on this code, or the session was
    // paused earlier (e.g. page reloaded mid-prompt): resume it either way.
    if (linkAuthResolve) {
      const resolve = linkAuthResolve;
      linkAuthResolve = null;
      resolve(true);
    } else if (LinkManager.room) {
      LinkManager.retry();
    }
  } catch (e) {
    if (linkAuthError) linkAuthError.textContent = 'Verification failed — try again';
  } finally {
    if (linkAuthBtn) linkAuthBtn.disabled = false;
  }
}

// Overlay opened: decide which login section to show, if any. The gate is
// NOT raised here — it belongs to the connect path (ensureLinkAuth), which
// knows the room and its trust window.
async function initTotpSection() {
  if (!linkAuthSection) return;
  const status = await fetchAuthStatus();
  if (status && status.confirmed) {
    if (linkAuthSetup) linkAuthSetup.hidden = true;
    if (linkAuthGate) linkAuthGate.hidden = true;
    if (linkAuthActive) linkAuthActive.hidden = !status.auth_valid;
    linkAuthSection.hidden = !status.auth_valid;
    return;
  }
  if (linkAuthActive) linkAuthActive.hidden = true;
  if (linkAuthGate) linkAuthGate.hidden = true;
  if (linkAuthSetup) linkAuthSetup.hidden = false;
  if (linkAuthSection) linkAuthSection.hidden = false;
}

async function startTotpEnrollment() {
  if (!linkTotpSetupBtn) return;
  linkTotpSetupBtn.disabled = true;
  try {
    const { ok, data } = await postAuthJson('/api/auth/enroll', {});
    if (!ok) {
      showToast(data.error || 'Setup failed');
      return;
    }
    renderQrInto(linkTotpQrWrap, data.otpauth_uri);
    if (linkTotpQrWrap) linkTotpQrWrap.hidden = false;
    if (linkTotpSecret) {
      linkTotpSecret.textContent = data.secret;
      linkTotpSecret.hidden = false;
    }
    if (linkTotpConfirmRow) linkTotpConfirmRow.hidden = false;
    setTimeout(() => linkTotpConfirmInput && linkTotpConfirmInput.focus(), 60);
  } finally {
    linkTotpSetupBtn.disabled = false;
  }
}

async function confirmTotpEnrollment() {
  if (!linkTotpConfirmInput) return;
  const code = linkTotpConfirmInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    showToast('Enter the current 6-digit code');
    return;
  }
  if (linkTotpConfirmBtn) linkTotpConfirmBtn.disabled = true;
  try {
    const { ok, data } = await postAuthJson('/api/auth/confirm', { code });
    if (!ok) {
      showToast(data.error || 'That code was not valid');
      return;
    }
    if (linkTotpQrWrap) linkTotpQrWrap.hidden = true;
    if (linkTotpSecret) linkTotpSecret.hidden = true;
    if (linkTotpConfirmRow) linkTotpConfirmRow.hidden = true;
    if (linkTotpRecovery) {
      linkTotpRecovery.replaceChildren();
      const title = document.createElement('p');
      title.className = 'totp-recovery-title';
      title.textContent = 'Save these one-time recovery codes now — they are shown only once:';
      linkTotpRecovery.appendChild(title);
      const list = document.createElement('div');
      list.className = 'totp-recovery-codes';
      for (const rc of data.recovery_codes || []) {
        const span = document.createElement('code');
        span.textContent = rc;
        list.appendChild(span);
      }
      linkTotpRecovery.appendChild(list);
      linkTotpRecovery.hidden = false;
    }
    showToast('Authenticator login activated');
  } finally {
    if (linkTotpConfirmBtn) linkTotpConfirmBtn.disabled = false;
  }
}

// Renders a QR (vendored qrcode-generator) into the given wrap element,
// with a text fallback sized for the same slot. Used for both the room QR
// and the authenticator setup QR.
function renderQrInto(wrapEl, text) {
  if (!wrapEl) return;
  const showFallback = (message) => {
    // Fallback text uses the page ink, which is light — on the white QR
    // background it would be invisible, so drop the white panel too.
    wrapEl.textContent = message;
    wrapEl.classList.add("link-qr-fallback");
  };
  if (typeof qrcode === "undefined") {
    showFallback("Scan unavailable — use the secret below instead.");
    return;
  }
  try {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    wrapEl.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    wrapEl.classList.remove("link-qr-fallback");
  } catch (e) {
    showFallback("QR rendering failed — use the secret below instead.");
  }
}

const LinkManager = {
  room: null,
  role: "desktop",
  ws: null,
  devices: [],
  outbox: [],
  intentionalClose: false,
  reconnectAttempts: 0,
  reconnectTimer: null,
  heartbeatTimer: null,
  exhausted: false,

  detectRole() {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = window.matchMedia("(max-width: 820px)").matches;
    return coarse && small ? "phone" : "desktop";
  },

  hostRoom() {
    const code = generateRoomCode();
    this.role = this.detectRole();
    this.room = code;
    this.outbox = [];
    if (linkRoomCodeEl) linkRoomCodeEl.textContent = code.split("").join(" ");
    this.renderQr(`${location.origin}/?join=${code}`);
    this.connect(code);
  },

  // Rejoin the previous room after a page reload. The /?join= deep link is
  // consumed on first use, so a refresh has no code in the URL — this
  // stored record is the restore path.
  restoreRoom() {
    let stored = null;
    try {
      const raw = localStorage.getItem(LINK_ROOM_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!stored || !isValidRoomCode(stored.code || "")) {
      try {
        localStorage.removeItem(LINK_ROOM_STORAGE_KEY);
      } catch (e) {}
      return;
    }
    // Rooms expire 12h after last activity; an older record is useless.
    if (Date.now() - (stored.at || 0) > 12 * 60 * 60 * 1000) {
      try {
        localStorage.removeItem(LINK_ROOM_STORAGE_KEY);
      } catch (e) {}
      showToast("Previous link expired");
      return;
    }
    this.role = this.detectRole();
    this.room = stored.code;
    this.outbox = [];
    if (linkRoomCodeEl) linkRoomCodeEl.textContent = stored.code.split("").join(" ");
    this.updateStatus("linking", `Restoring link ${stored.code}…`);
    this.connect(stored.code);
  },

  joinRoom(input) {
    const code = sanitizeRoomCode(input);
    if (!isValidRoomCode(code)) {
      showToast("Enter a 6-character room code");
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.reconnectAttempts = 0;
    this.role = this.detectRole();
    this.room = code;
    this.outbox = [];
    if (linkRoomCodeEl) linkRoomCodeEl.textContent = code.split("").join(" ");
    this.renderQr(`${location.origin}/?join=${code}`);
    this.connect(code);
  },

  renderQr(text) {
    renderQrInto(linkQrWrap, text);
  },

  async connect(code) {
    // TOTP gate: when authenticator login is active and this room has no
    // open trust window, a fresh code may be required before the socket can
    // be opened (the server enforces it too — this is the UX path).
    if (!(await ensureLinkAuth(code))) {
      this.updateStatus("error", "Link paused — verify your authenticator code");
      return;
    }
    this.closeSocket(true);
    this.exhausted = false;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const url = `${scheme}://${location.host}/api/link/ws?room=${encodeURIComponent(code)}&role=${this.role}`;
    this.updateStatus("linking", `Linking to ${code}…`);
    this.updateLinkBadge();
    if (linkLeaveBtn) linkLeaveBtn.hidden = false;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.updateStatus("error", "Link failed");
      return;
    }
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Trigger the server handshake: hello -> init + join broadcast
      this.send({ type: "hello" });
      this.flushOutbox();
      this.startHeartbeat();
    };
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.intentionalClose) {
        this.intentionalClose = false;
        return;
      }
      this.updateStatus("error", `Reconnecting to ${this.room}…`);
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {};
  },

  scheduleReconnect() {
    if (!this.room) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.exhausted = true;
      this.updateStatus("error", "Reconnect failed — tap to retry");
      return;
    }
    const base = Math.min(10000, 1000 * 2 ** this.reconnectAttempts);
    // Jitter the upper half of the backoff window so two devices that drop
    // at the same moment do not retry in lockstep.
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectAttempts++;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(this.room), delay);
  },

  // Manual recovery once auto-reconnect is exhausted (or from the
  // background-resume hooks): immediate rejoin of the current room.
  retry() {
    if (!this.room) return;
    this.reconnectAttempts = 0;
    this.exhausted = false;
    clearTimeout(this.reconnectTimer);
    this.connect(this.room);
  },

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // The Durable Object auto-responds to "ping" without waking, so the
        // keepalive costs the room no compute.
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, LINK_PING_INTERVAL_MS);
  },

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  },

  closeSocket(intentional) {
    this.intentionalClose = intentional;
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  },

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.closeSocket(true);
    this.outbox = [];
    // Leaving the room is deliberate: do not auto-rejoin on next load.
    try {
      localStorage.removeItem(LINK_ROOM_STORAGE_KEY);
    } catch (e) {}
    this.room = null;
    this.devices = [];
    this.renderDeviceList();
    this.updateStatus("off", "Offline");
    this.updateLinkBadge();
    if (linkLeaveBtn) linkLeaveBtn.hidden = true;
    // Reset the pairing panel so a stale code/QR never lingers after leaving.
    if (linkRoomCodeEl) linkRoomCodeEl.textContent = "······";
    if (linkQrWrap) {
      linkQrWrap.innerHTML = "";
      linkQrWrap.classList.remove("link-qr-fallback");
    }
  },

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    // While a socket is (re)connecting, durable messages are held briefly
    // instead of being dropped; ephemeral interim previews are not worth
    // buffering (the receiver only shows them for a moment anyway).
    if (
      this.ws &&
      this.ws.readyState === WebSocket.CONNECTING &&
      (obj.type === "turn" || obj.type === "clipboard") &&
      this.outbox.length < LINK_OUTBOX_MAX
    ) {
      this.outbox.push(JSON.stringify(obj));
      return true;
    }
    return false;
  },

  flushOutbox() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    for (const data of this.outbox.splice(0)) {
      try {
        this.ws.send(data);
      } catch (e) {
        // socket died between the readyState check and the send
      }
    }
  },

  handleMessage(event) {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return;
    }
    switch (msg.type) {
      case "init": {
        this.devices = Array.isArray(msg.devices) ? msg.devices : [];
        this.renderDeviceList();
        const peers = msg.devices?.length ?? 0;
        this.updateStatus(peers > 1 ? "linked" : "linking", peers > 1
          ? `Linked to ${this.room}`
          : `Waiting for a device — room ${this.room}`);
        showToast(peers > 1 ? "Link established" : "Room ready — waiting for a device");
        this.applySnapshot(msg.snapshot);
        // Persist the room so a page refresh can rejoin it automatically.
        try {
          localStorage.setItem(
            LINK_ROOM_STORAGE_KEY,
            JSON.stringify({ code: this.room, at: Date.now() })
          );
        } catch (e) {}
        break;
      }
      case "device_joined":
        if (msg.device?.role) {
          this.devices = [...this.devices, msg.device];
          this.renderDeviceList();
          showToast("Device linked");
        }
        break;
      case "device_left":
        this.devices = this.devices.filter((d) => d.role !== msg.device?.role);
        this.renderDeviceList();
        break;
      case "turn":
        appendRemoteTurn(msg.text);
        break;
      case "interim":
        showRemoteInterim(msg.text);
        break;
      case "level":
        // Remote voice loudness (0..1) drives our meter when we are not
        // the one recording, so the second screen follows the first voice.
        remoteLevelTarget = typeof msg.v === "number" ? msg.v : 0;
        lastRemoteLevelAt = Date.now();
        break;
      case "clipboard":
        showRemoteClipboard(msg.text);
        break;
      case "error":
        showToast(`Link: ${msg.message}`);
        break;
      default:
        break;
    }
  },

  applySnapshot(snapshot) {
    if (!snapshot) return;
    // Catch-up text only lands in an empty editor so local drafts are never clobbered.
    if (snapshot.text && messageEl && !messageEl.innerText.trim()) {
      appendRemoteTurn(snapshot.text);
    }
    if (snapshot.clipboard?.text) {
      showRemoteClipboard(snapshot.clipboard.text, { replay: true });
    }
  },

  renderDeviceList() {
    if (linkDevicesEl) {
      linkDevicesEl.textContent = this.devices.map((d) => d.role.toUpperCase()).join(" • ");
    }
    this.updateLinkBadge();
  },

  updateStatus(state, text) {
    if (linkStatusDot) linkStatusDot.className = `link-status-dot ${state}`;
    if (linkStatusText) linkStatusText.textContent = text;
  },

  // Ambient header indicator, driven by PRESENCE, not socket state: a room
  // with no peer is "Waiting" (amber), a room with a peer is "Linked"
  // (emerald), no room is plain "Link". Socket-to-room alone never reads as
  // connected — reported as misleading while dictating alone.
  updateLinkBadge() {
    if (!linkToggleBtn) return;
    const peers = this.devices?.length ?? 0;
    const state = !this.room && !this.ws ? "idle" : peers > 1 ? "linked" : "waiting";
    linkToggleBtn.classList.toggle("link-active", state === "linked");
    linkToggleBtn.classList.toggle("link-waiting", state === "waiting");
    const label = document.getElementById("linkBtnLabel");
    if (label) {
      label.textContent = state === "linked" ? "Linked" : state === "waiting" ? "Waiting" : "Link";
    }
    linkToggleBtn.title = state === "linked"
      ? `Linked — ${peers} devices in room ${this.room}`
      : state === "waiting"
        ? `Waiting for a device in room ${this.room}`
        : "Link another device";
  },

  openModal() {
    if (!this.room && !this.ws) this.hostRoom();
    if (linkOverlay) linkOverlay.hidden = false;
    if (linkToggleBtn) linkToggleBtn.setAttribute("aria-expanded", "true");
    if (linkCloseBtn) linkCloseBtn.focus();
    initTotpSection();
  },

  closeModal() {
    if (linkOverlay) linkOverlay.hidden = true;
    if (linkToggleBtn) linkToggleBtn.setAttribute("aria-expanded", "false");
    if (linkToggleBtn) linkToggleBtn.focus();
    // Closing the modal while an authenticator prompt is pending aborts the
    // connect that was waiting for the code.
    if (linkAuthResolve) {
      const resolve = linkAuthResolve;
      linkAuthResolve = null;
      resolve(false);
    }
  },
};

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

// One 100 ms PCM batch: forward it to the STT engine, and if a link room is
// live, share the batch's loudness as a `level` frame so the peer screen's
// meter follows this device's voice (~10 Hz, ~28 bytes per frame).
function sendAudioChunk(audioChunk) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(audioChunk);
  }
  if (LinkManager.room) {
    const samples = new Int16Array(audioChunk.buffer, audioChunk.byteOffset, audioChunk.length / 2);
    const v = Math.min(1, Math.round(rms16(samples) * 100) / 100);
    LinkManager.send({ type: "level", v });
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
          await microphone.startRecording(sendAudioChunk);
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

      // language_codes is the documented v3 steering param (language_code is
      // silently ignored, leaving the model to code-switch across all 16
      // supported languages — observed Hindi bleed in English sessions).
      // language_detection reports the detected language per turn.
      // vad_threshold below the default lets quiet speech register (the
      // reported low-voice complaint), and voice_focus suppresses background
      // audio before the model, keeping the lower VAD safe from noise.
      const endpoint = `wss://streaming.assemblyai.com/v3/ws?speech_model=${selectedModel}&language_codes=${encodeURIComponent(JSON.stringify(["en"]))}&language_detection=true&vad_threshold=0.1&voice_focus=near-field&sample_rate=16000&encoding=pcm_s16le&token=${token}`;
      ws = new WebSocket(endpoint);

      ws.onopen = async () => {
        try {
          await microphone.startRecording(sendAudioChunk);
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
            // Official v3 endpointing signal: the server finalized this turn.
            // Commit now so it relays to linked devices immediately instead
            // of waiting for the next turn to start (the last sentence the
            // user says otherwise never left this device).
            if (msg.end_of_turn) {
              commitActiveTurn();
            }
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
  // Flush the sub-batch audio tail before closing the stream so the final
  // word is not clipped at the 100ms batch boundary.
  if (microphone && ws && ws.readyState === WebSocket.OPEN) {
    const tail = microphone.flushRemaining();
    if (tail) ws.send(tail);
  }
  stopAudioAndWebSocket();
  commitActiveTurn();
  currentTurnOrder = null;
  updateRecordingState(false);
  // Durable history: one transcript entry per dictation session, saved
  // after the final turn commits so it includes the last sentence.
  saveTranscriptSession();
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

  if (linkToggleBtn) {
    linkToggleBtn.addEventListener('click', () => {
      // Tapping the link button while auto-reconnect is exhausted is the
      // manual retry path.
      if (LinkManager.exhausted) LinkManager.retry();
      if (linkOverlay && linkOverlay.hidden) {
        LinkManager.openModal();
      } else {
        LinkManager.closeModal();
      }
    });
  }

  if (linkCloseBtn) {
    linkCloseBtn.addEventListener('click', () => LinkManager.closeModal());
  }

  if (linkOverlay) {
    linkOverlay.addEventListener('click', (e) => {
      if (e.target === linkOverlay) LinkManager.closeModal();
    });
  }

  if (linkJoinBtn) {
    linkJoinBtn.addEventListener('click', () => {
      LinkManager.joinRoom(linkJoinInput ? linkJoinInput.value : '');
      if (linkJoinInput) linkJoinInput.value = '';
    });
  }

  if (linkJoinInput) {
    linkJoinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        LinkManager.joinRoom(linkJoinInput.value);
        linkJoinInput.value = '';
      }
    });
  }

  if (linkLeaveBtn) {
    linkLeaveBtn.addEventListener('click', () => {
      LinkManager.disconnect();
      LinkManager.closeModal();
    });
  }

  if (linkAuthBtn) {
    linkAuthBtn.addEventListener('click', () => submitLinkAuth());
  }
  if (linkAuthInput) {
    linkAuthInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitLinkAuth();
      }
    });
  }
  if (linkTotpSetupBtn) {
    linkTotpSetupBtn.addEventListener('click', () => startTotpEnrollment());
  }
  if (linkTotpConfirmBtn) {
    linkTotpConfirmBtn.addEventListener('click', () => confirmTotpEnrollment());
  }
  if (linkTotpConfirmInput) {
    linkTotpConfirmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmTotpEnrollment();
      }
    });
  }

  if (linkCopyCodeBtn) {
    linkCopyCodeBtn.addEventListener('click', async () => {
      if (!LinkManager.room) return;
      try {
        await navigator.clipboard.writeText(LinkManager.room);
        showToast('Room code copied');
      } catch (e) {
        showToast('Failed to copy code');
      }
    });
  }

  if (trayCopyBtn) {
    trayCopyBtn.addEventListener('click', async () => {
      if (!lastRemoteClipboard) return;
      try {
        await navigator.clipboard.writeText(lastRemoteClipboard);
        showToast('Copied to clipboard [⌘C]');
      } catch (e) {
        showToast('Failed to copy');
      }
    });
  }

  if (trayDismissBtn) {
    trayDismissBtn.addEventListener('click', () => {
      if (clipboardTray) clipboardTray.hidden = true;
    });
  }

  if (pushButton) {
    pushButton.addEventListener('click', pushToLinkedDevices);
  }

  const modelOptions = document.querySelectorAll('.engine-opt');
  modelOptions.forEach((opt) => {
    opt.addEventListener('click', () => {
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

  // Global Keyboard Shortcuts (Space to dictate, Escape to close dropdown/dialog)
  document.addEventListener('keydown', (e) => {
    // Escape key closes the link dialog and the model dropdown
    if (e.key === 'Escape') {
      if (linkOverlay && !linkOverlay.hidden) {
        LinkManager.closeModal();
      }
      closeModelDropdown();
      return;
    }

    const typingInField =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement;

    // Space key toggles recording when not actively typing inside the editor or a form field
    if (e.code === 'Space' && document.activeElement !== messageEl && !typingInField) {
      e.preventDefault();
      toggleRecording();
    }
  });

  // Deep link: /?join=CODE pairs this device immediately
  const joinParam = sanitizeRoomCode(new URLSearchParams(location.search).get('join') || '');
  if (joinParam) {
    history.replaceState(null, '', location.pathname);
    LinkManager.joinRoom(joinParam);
  } else {
    // No deep link (e.g. a page refresh): rejoin the previous room.
    LinkManager.restoreRoom();
  }

  // Mobile browsers kill background WebSockets without a close frame, and
  // phones drop sockets across screen-lock. Re-validate the link the moment
  // the page is active again; if it is down, rejoin immediately.
  const resumeLink = () => {
    if (!LinkManager.room) return;
    if (
      LinkManager.ws &&
      (LinkManager.ws.readyState === WebSocket.OPEN ||
        LinkManager.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    LinkManager.reconnectAttempts = 0;
    LinkManager.exhausted = false;
    clearTimeout(LinkManager.reconnectTimer);
    LinkManager.connect(LinkManager.room);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resumeLink();
  });
  window.addEventListener('focus', resumeLink);
  window.addEventListener('online', resumeLink);

  restoreDraftFromStorage();
  updateStats();

  // Version seal: derived from changelog.json — the single version source
  // that also drives /changelog. Falls back silently to the static label.
  fetch('/changelog.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((log) => {
      const latest = log?.entries?.[0];
      const [major, minor] = String(latest?.version ?? '').split('.').map(Number);
      const seal = document.querySelector('.packet-seal');
      if (!latest || !Number.isFinite(major) || !seal) return;
      seal.textContent = minor > 0
        ? `SPEC v${String(major).padStart(2, '0')}.${minor} • VERIFIED`
        : `SPEC v${String(major).padStart(2, '0')} • VERIFIED`;
    })
    .catch(() => {});

  // The voice meter runs for the life of the page: breathing floor when
  // idle, live FFT while recording, streamed scalar when a peer is talking.
  requestAnimationFrame(vizLoop);

  // Library wiring: Save button, refresh, row actions, hash router.
  const saveButton = document.getElementById('saveButton');
  if (saveButton) saveButton.addEventListener('click', saveCurrentNote);

  const libraryRefresh = document.getElementById('libraryRefresh');
  if (libraryRefresh) {
    libraryRefresh.addEventListener('click', () => {
      const route = currentRoute();
      if (LIBRARY_ROUTES[route]) loadLibrary(route);
    });
  }

  const libraryList = document.getElementById('libraryList');
  if (libraryList) {
    libraryList.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      const item = btn.closest('.library-item');
      if (item) handleLibraryAction(item, btn.dataset.act);
    });
  }

  window.addEventListener('hashchange', renderRoute);
  renderRoute();
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
