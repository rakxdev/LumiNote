/**
 * LumiNote Link Mode — room & message protocol helpers.
 * Pure functions only: usable in Workers, Durable Objects, Node tests, and the browser.
 */

// Unambiguous alphabet (no 0/O, 1/I/L) for human-typed room codes.
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export const MAX_TEXT_LENGTH = 100000;
export const MAX_CLIENT_MESSAGE_BYTES = 128 * 1024;

export const CLIENT_MESSAGE_TYPES = ['hello', 'turn', 'interim', 'clipboard', 'clear', 'ping', 'level'];
export const ROLES = ['desktop', 'phone'];

/**
 * Generate a random room code (the code is the room's only credential).
 * Uses crypto.getRandomValues, available in Workers and Node >= 19.
 */
export function generateRoomCode() {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  }
  return code;
}

/** Normalize user-typed room input: trim, uppercase, drop characters outside the alphabet. */
export function sanitizeRoomCode(input) {
  if (typeof input !== 'string') return '';
  return input.trim().toUpperCase().replace(new RegExp(`[^${ROOM_ALPHABET}]`, 'g'), '');
}

export function isValidRoomCode(code) {
  return typeof code === 'string' && ROOM_CODE_PATTERN.test(code);
}

/** Validate a device role parameter; defaults to 'desktop'. */
export function parseRole(value) {
  return ROLES.includes(value) ? value : 'desktop';
}

/**
 * Validate an incoming client message. Returns
 * { ok: true, message } or { ok: false, error }.
 * Enforces shape and size limits; never trusts raw payload fields.
 */
export function validateClientMessage(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'binary frames are not supported' };
  if (raw.length > MAX_CLIENT_MESSAGE_BYTES) return { ok: false, error: 'message too large' };

  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) {
    return { ok: false, error: 'invalid message' };
  }
  if (!CLIENT_MESSAGE_TYPES.includes(msg.type)) {
    return { ok: false, error: 'unknown message type' };
  }
  if (msg.type === 'clear' || msg.type === 'ping' || msg.type === 'hello') {
    return { ok: true, message: { type: msg.type } };
  }
  if (msg.type === 'level') {
    // Remote-voice meter: a normalized 0..1 scalar, no text payload.
    if (typeof msg.v !== 'number' || !Number.isFinite(msg.v)) {
      return { ok: false, error: 'level.v must be a finite number' };
    }
    return { ok: true, message: { type: 'level', v: Math.min(1, Math.max(0, msg.v)) } };
  }
  if (typeof msg.text !== 'string') {
    return { ok: false, error: 'missing text field' };
  }
  if (msg.text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: 'text too long' };
  }
  return { ok: true, message: { type: msg.type, text: msg.text } };
}

/** Server-to-client events. */
export function serverEvent(type, fields = {}) {
  return JSON.stringify({ type, ...fields });
}
