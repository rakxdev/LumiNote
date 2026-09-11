/**
 * LumiNote Link Mode — client-side room-code helpers.
 *
 * Scoped copy of the room-code rules from worker/src/protocol.js (the single
 * source of truth). This copy exists because the client is a static module
 * that cannot import server directories; tests/link-protocol.test.js keeps
 * all copies behaviorally identical.
 */

export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export function generateRoomCode() {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  }
  return code;
}

export function sanitizeRoomCode(input) {
  if (typeof input !== 'string') return '';
  return input.trim().toUpperCase().replace(new RegExp(`[^${ROOM_ALPHABET}]`, 'g'), '');
}

export function isValidRoomCode(code) {
  return typeof code === 'string' && ROOM_CODE_PATTERN.test(code);
}
