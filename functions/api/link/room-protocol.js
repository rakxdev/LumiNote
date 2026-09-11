/**
 * Room-code validation for the Pages Function bundle.
 *
 * The Pages Functions bundler cannot resolve imports outside the `functions/`
 * directory, so this is a scoped copy of the room-code rules from
 * worker/src/protocol.js (the single source of truth for the Link Mode
 * protocol). tests/link-protocol.test.js asserts both copies stay in sync.
 */

export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export function sanitizeRoomCode(input) {
  if (typeof input !== 'string') return '';
  return input.trim().toUpperCase().replace(new RegExp(`[^${ROOM_ALPHABET}]`, 'g'), '');
}

export function isValidRoomCode(code) {
  return typeof code === 'string' && ROOM_CODE_PATTERN.test(code);
}
