// /api/notes — list and create durable entries (notes, clips, transcripts).
// Same-origin only; the D1 binding comes from wrangler.toml (env.DB).
import {
  SQL,
  DEFAULT_USER,
  validateKind,
  validateText,
  listParams,
  rowToJson,
} from './store.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) return json({ error: 'Database binding not configured' }, 500);
  const params = listParams(new URL(request.url).searchParams);
  if (!params.ok) return json({ error: params.error }, 400);

  const statement = params.value.kind
    ? env.DB.prepare(SQL.list).bind(DEFAULT_USER, params.value.kind, params.value.limit)
    : env.DB.prepare(SQL.listAll).bind(DEFAULT_USER, params.value.limit);
  const { results } = await statement.all();
  return json({ notes: results.map(rowToJson) });
}

export async function onRequestPost({ env, request }) {
  if (!env.DB) return json({ error: 'Database binding not configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'body must be valid JSON' }, 400);
  }
  const text = validateText(body?.text);
  if (!text.ok) return json({ error: text.error }, 400);
  const kind = validateKind(body?.kind ?? 'note');
  if (!kind.ok) return json({ error: kind.error }, 400);
  const sourceDevice = typeof body?.source_device === 'string'
    ? body.source_device.slice(0, 100)
    : null;

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    kind: kind.value,
    text: text.value,
    source_device: sourceDevice,
    created_at: now,
  };
  await env.DB.prepare(SQL.insert)
    .bind(row.id, DEFAULT_USER, row.kind, row.text, row.source_device, row.created_at)
    .run();
  return json({ note: rowToJson({ ...row, updated_at: now, pinned: 0 }) }, 201);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
