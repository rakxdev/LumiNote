// Notes API shared logic: input validation and SQL. Deliberately free of
// D1/Request runtime types so the rules unit-test in plain Node, mirroring
// the worker protocol module's style ({ ok, value | error } results).

export const NOTE_KINDS = ['note', 'clip', 'transcript'];
export const MAX_TEXT_LENGTH = 200 * 1024; // 200 KB of text per entry
export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 200;
export const DEFAULT_USER = 'local';

export function validateKind(kind) {
  if (typeof kind !== 'string' || !NOTE_KINDS.includes(kind)) {
    return { ok: false, error: `kind must be one of: ${NOTE_KINDS.join(', ')}` };
  }
  return { ok: true, value: kind };
}

export function validateText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: 'text must be a non-empty string' };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `text exceeds the ${MAX_TEXT_LENGTH} character cap` };
  }
  return { ok: true, value: text };
}

export function validateId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: 'id must be a uuid' };
  }
  return { ok: true, value: id.toLowerCase() };
}

// List params from a URLSearchParams: optional kind, optional integer limit,
// optional search text (D1 LIKE, % and _ escaped by the caller's SQL).
export function listParams(searchParams) {
  const kindResult = searchParams.get('kind')
    ? validateKind(searchParams.get('kind'))
    : { ok: true, value: null };
  if (!kindResult.ok) return kindResult;

  let limit = DEFAULT_LIST_LIMIT;
  const rawLimit = searchParams.get('limit');
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
      return { ok: false, error: `limit must be an integer between 1 and ${MAX_LIST_LIMIT}` };
    }
  }

  let q = null;
  const rawQ = searchParams.get('q');
  if (rawQ !== null) {
    q = String(rawQ).trim().slice(0, 200);
    if (!q) q = null;
  }
  return { ok: true, value: { kind: kindResult.value, limit, q } };
}

// LIKE pattern with % and _ escaped so user input cannot wildcard freely.
export function likePattern(q) {
  return `%${q.replace(/[\\%_]/g, '\\$&')}%`;
}

// PATCH accepts either a new text or a pinned flip; at least one is required.
export function patchChanges(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const hasText = 'text' in body;
  const hasPinned = 'pinned' in body;
  if (!hasText && !hasPinned) {
    return { ok: false, error: 'provide text or pinned to update' };
  }
  let text = null;
  if (hasText) {
    const textResult = validateText(body.text);
    if (!textResult.ok) return textResult;
    text = textResult.value;
  }
  let pinned = null;
  if (hasPinned) {
    if (typeof body.pinned !== 'boolean') {
      return { ok: false, error: 'pinned must be true or false' };
    }
    pinned = body.pinned;
  }
  return { ok: true, value: { text, pinned } };
}

// Rows are returned as JSON with pinned as a real boolean.
export function rowToJson(row) {
  if (!row) return null;
  return { ...row, pinned: !!row.pinned };
}

export const SQL = {
  insert: `INSERT INTO notes (id, user_id, kind, text, source_device, created_at, updated_at, pinned)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, 0)`,
  list: `SELECT id, kind, text, source_device, created_at, updated_at, pinned
         FROM notes WHERE user_id = ?1 AND kind = ?2
         ORDER BY pinned DESC, created_at DESC LIMIT ?3`,
  listQ: `SELECT id, kind, text, source_device, created_at, updated_at, pinned
          FROM notes WHERE user_id = ?1 AND kind = ?2 AND text LIKE ?4 ESCAPE '\\'
          ORDER BY pinned DESC, created_at DESC LIMIT ?3`,
  listAll: `SELECT id, kind, text, source_device, created_at, updated_at, pinned
            FROM notes WHERE user_id = ?1
            ORDER BY pinned DESC, created_at DESC LIMIT ?2`,
  listAllQ: `SELECT id, kind, text, source_device, created_at, updated_at, pinned
             FROM notes WHERE user_id = ?1 AND text LIKE ?3 ESCAPE '\\'
             ORDER BY pinned DESC, created_at DESC LIMIT ?2`,
  get: `SELECT id, kind, text, source_device, created_at, updated_at, pinned
        FROM notes WHERE id = ?1 AND user_id = ?2`,
  updateText: `UPDATE notes SET text = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4`,
  updatePinned: `UPDATE notes SET pinned = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4`,
  delete: `DELETE FROM notes WHERE id = ?1 AND user_id = ?2`,
};
