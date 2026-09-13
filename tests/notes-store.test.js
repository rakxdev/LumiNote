// Notes API contract: input validation and SQL shape live in store.js so
// these rules test in plain Node, before the D1-backed Functions ship.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTE_KINDS,
  MAX_TEXT_LENGTH,
  validateKind,
  validateText,
  validateId,
  listParams,
  patchChanges,
  rowToJson,
  SQL,
} from '../functions/api/notes/store.js';

describe('notes validation', () => {
  it('accepts exactly the three known kinds', () => {
    for (const kind of NOTE_KINDS) {
      assert.equal(validateKind(kind).ok, true);
    }
    assert.deepEqual(NOTE_KINDS, ['note', 'clip', 'transcript']);
    assert.equal(validateKind('Note').ok, false, 'kind matching is case-sensitive');
    assert.equal(validateKind('').ok, false);
    assert.equal(validateKind(undefined).ok, false);
    assert.equal(validateKind(42).ok, false);
  });

  it('requires non-empty text and enforces the size cap', () => {
    assert.equal(validateText('hello world').ok, true);
    assert.equal(validateText('').ok, false);
    assert.equal(validateText('   \n  ').ok, false, 'whitespace-only text is empty');
    assert.equal(validateText(undefined).ok, false);
    assert.equal(validateText(123).ok, false);
    assert.equal(validateText('a'.repeat(MAX_TEXT_LENGTH)).ok, true, 'the cap itself is allowed');
    assert.equal(validateText('a'.repeat(MAX_TEXT_LENGTH + 1)).ok, false);
  });

  it('accepts only uuid ids and normalizes case', () => {
    const id = '7b6c4f21-9a5e-4c1d-8f3a-2b7d5e0c9a11';
    assert.deepEqual(validateId(id), { ok: true, value: id });
    assert.equal(validateId(id.toUpperCase()).value, id, 'ids normalize to lowercase');
    assert.equal(validateId('not-a-uuid').ok, false);
    assert.equal(validateId('7b6c4f219a5e4c1d8f3a2b7d5e0c9a11').ok, false, 'dashes are required');
    assert.equal(validateId(null).ok, false);
  });
});

describe('list params', () => {
  const params = (qs) => listParams(new URLSearchParams(qs));

  it('defaults to all kinds at the default limit', () => {
    assert.deepEqual(params('').value, { kind: null, limit: 100, q: null });
  });

  it('accepts a valid kind and limit', () => {
    assert.deepEqual(params('kind=clip&limit=25').value, { kind: 'clip', limit: 25, q: null });
  });

  it('carries a trimmed search term and drops whitespace-only ones', () => {
    assert.equal(params('q=%20ECG%20').value.q, 'ECG');
    assert.equal(params('q=%20%20').value.q, null);
  });

  it('rejects bad kinds and bad limits', () => {
    assert.equal(params('kind=secret').ok, false);
    assert.equal(params('limit=0').ok, false);
    assert.equal(params('limit=201').ok, false);
    assert.equal(params('limit=10.5').ok, false);
    assert.equal(params('limit=many').ok, false);
  });
});

describe('patch changes', () => {
  it('accepts text, pinned, or both — and requires at least one', () => {
    assert.deepEqual(patchChanges({ text: 'new' }).value, { text: 'new', pinned: null });
    assert.deepEqual(patchChanges({ pinned: true }).value, { text: null, pinned: true });
    assert.deepEqual(patchChanges({ text: 'new', pinned: false }).value, { text: 'new', pinned: false });
    assert.equal(patchChanges({}).ok, false);
    assert.equal(patchChanges(null).ok, false);
    assert.equal(patchChanges('text').ok, false);
  });

  it('validates the fields it receives', () => {
    assert.equal(patchChanges({ text: '' }).ok, false);
    assert.equal(patchChanges({ pinned: 'yes' }).ok, false);
  });
});

describe('row shape and SQL', () => {
  it('returns pinned as a real boolean', () => {
    assert.equal(rowToJson({ id: 'a', pinned: 1 }).pinned, true);
    assert.equal(rowToJson({ id: 'a', pinned: 0 }).pinned, false);
    assert.equal(rowToJson(null), null);
  });

  it('orders pinned entries first, then newest', () => {
    for (const statement of [SQL.list, SQL.listAll]) {
      assert.match(statement, /ORDER BY pinned DESC, created_at DESC/);
    }
    assert.match(SQL.delete, /WHERE id = \?1 AND user_id = \?2/, 'deletes are user-scoped');
    assert.equal(
      new Set([...SQL.insert.matchAll(/\?(\d)/g)].map((m) => m[1])).size,
      6,
      'insert binds six distinct parameters (created_at and updated_at share one)'
    );
  });
});
