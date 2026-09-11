import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRoomCode,
  sanitizeRoomCode,
  isValidRoomCode,
  parseRole,
  validateClientMessage,
  serverEvent,
} from '../worker/src/protocol.js';
import * as pagesRoomProtocol from '../functions/api/link/room-protocol.js';
import * as clientRoomProtocol from '../public/link-protocol.js';

describe('room codes', () => {
  it('generates codes that match the unambiguous alphabet pattern', () => {
    for (let i = 0; i < 50; i++) {
      assert.ok(isValidRoomCode(generateRoomCode()));
    }
  });

  it('generates distinct codes across many draws', () => {
    const codes = new Set();
    for (let i = 0; i < 200; i++) codes.add(generateRoomCode());
    assert.ok(codes.size > 190);
  });

  it('sanitizes typed input: case, whitespace, and characters outside the alphabet', () => {
    assert.equal(sanitizeRoomCode(' abc-def '), 'ABCDEF');
    assert.equal(sanitizeRoomCode('ab0cd1'), 'ABCD');
    assert.equal(sanitizeRoomCode('o0il1'), '');
  });

  it('rejects codes that are too short, unsanitized, or not strings', () => {
    assert.equal(isValidRoomCode('ABCDE'), false);
    assert.equal(isValidRoomCode('ABCDEF0'), false);
    assert.equal(isValidRoomCode('abcdef'), false);
    assert.equal(isValidRoomCode(123456), false);
  });

  it('keeps the Pages Function room-code copy in sync with the worker module', () => {
    assert.equal(pagesRoomProtocol.ROOM_ALPHABET, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    const codes = ['ABCDEF', 'ABCDE', 'ABCDEF0', 'abcdef', '', 123456];
    for (const code of codes) {
      assert.equal(
        pagesRoomProtocol.isValidRoomCode(code),
        isValidRoomCode(code),
        `divergent isValidRoomCode for ${JSON.stringify(code)}`
      );
    }
    const inputs = [' abc-def ', 'ab0cd1', 'o0il1', 'WXY9Z8'];
    for (const input of inputs) {
      assert.equal(
        pagesRoomProtocol.sanitizeRoomCode(input),
        sanitizeRoomCode(input),
        `divergent sanitizeRoomCode for ${JSON.stringify(input)}`
      );
    }
  });

  it('keeps the browser client room-code copy in sync with the worker module', () => {
    assert.equal(clientRoomProtocol.ROOM_ALPHABET, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    for (let i = 0; i < 20; i++) {
      assert.ok(isValidRoomCode(clientRoomProtocol.generateRoomCode()));
    }
    const codes = ['ABCDEF', 'ABCDE', 'ABCDEF0', 'abcdef', ''];
    for (const code of codes) {
      assert.equal(clientRoomProtocol.isValidRoomCode(code), isValidRoomCode(code));
    }
    for (const input of [' ab-cd-ef ', 'ab0cd1']) {
      assert.equal(clientRoomProtocol.sanitizeRoomCode(input), sanitizeRoomCode(input));
    }
  });
});

describe('client message validation', () => {
  it('accepts turn/interim/clipboard messages carrying string text', () => {
    const r = validateClientMessage(JSON.stringify({ type: 'turn', text: 'hello' }));
    assert.deepEqual(r, { ok: true, message: { type: 'turn', text: 'hello' } });
  });

  it('accepts clear and ping without a text field', () => {
    assert.equal(validateClientMessage('{"type":"clear"}').ok, true);
    assert.equal(validateClientMessage('{"type":"ping"}').ok, true);
  });

  it('rejects binary input, oversized payloads, malformed JSON, unknown types, and missing text', () => {
    assert.equal(validateClientMessage(123).ok, false);
    assert.equal(validateClientMessage('x'.repeat(128 * 1024 + 1)).ok, false);
    assert.equal(validateClientMessage('{nope').ok, false);
    assert.equal(validateClientMessage('[]').ok, false);
    assert.equal(validateClientMessage('{"type":"boom"}').ok, false);
    assert.equal(validateClientMessage('{"type":"turn"}').ok, false);
  });

  it('rejects text beyond the length cap', () => {
    const r = validateClientMessage(
      JSON.stringify({ type: 'clipboard', text: 'a'.repeat(100001) })
    );
    assert.equal(r.ok, false);
  });

  it('never relays client-controlled envelope fields like from or room', () => {
    const r = validateClientMessage(
      JSON.stringify({ type: 'turn', text: 'hi', from: 'evil', room: 'ZZZZZZ' })
    );
    assert.deepEqual(r.message, { type: 'turn', text: 'hi' });
  });
});

describe('roles & server events', () => {
  it('defaults unknown roles to desktop', () => {
    assert.equal(parseRole('phone'), 'phone');
    assert.equal(parseRole('banana'), 'desktop');
    assert.equal(parseRole(null), 'desktop');
  });

  it('serializes server events as JSON with a type field', () => {
    assert.deepEqual(
      JSON.parse(serverEvent('turn', { text: 'x', from: 'phone' })),
      { type: 'turn', text: 'x', from: 'phone' }
    );
  });
});
