// /api/notes/:id — read, update (text and/or pinned), or delete one entry.
import {
  SQL,
  DEFAULT_USER,
  validateId,
  patchChanges,
  rowToJson,
} from './store.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function resolveId(params) {
  return validateId(params?.id);
}

export async function onRequestGet({ env, params }) {
  if (!env.DB) return json({ error: 'Database binding not configured' }, 500);
  const id = await resolveId(params);
  if (!id.ok) return json({ error: id.error }, 400);
  const row = await env.DB.prepare(SQL.get).bind(id.value, DEFAULT_USER).first();
  if (!row) return json({ error: 'Not found' }, 404);
  return json({ note: rowToJson(row) });
}

export async function onRequestPatch({ env, params, request }) {
  if (!env.DB) return json({ error: 'Database binding not configured' }, 500);
  const id = await resolveId(params);
  if (!id.ok) return json({ error: id.error }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'body must be valid JSON' }, 400);
  }
  const changes = patchChanges(body);
  if (!changes.ok) return json({ error: changes.error }, 400);

  const existing = await env.DB.prepare(SQL.get).bind(id.value, DEFAULT_USER).first();
  if (!existing) return json({ error: 'Not found' }, 404);

  const now = new Date().toISOString();
  if (changes.value.text !== null) {
    await env.DB.prepare(SQL.updateText).bind(changes.value.text, now, id.value, DEFAULT_USER).run();
  }
  if (changes.value.pinned !== null) {
    await env.DB.prepare(SQL.updatePinned).bind(changes.value.pinned ? 1 : 0, now, id.value, DEFAULT_USER).run();
  }
  const row = await env.DB.prepare(SQL.get).bind(id.value, DEFAULT_USER).first();
  return json({ note: rowToJson(row) });
}

export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ error: 'Database binding not configured' }, 500);
  const id = await resolveId(params);
  if (!id.ok) return json({ error: id.error }, 400);
  const result = await env.DB.prepare(SQL.delete).bind(id.value, DEFAULT_USER).run();
  if (!result.meta.changes) return json({ error: 'Not found' }, 404);
  return json({ deleted: id.value });
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
