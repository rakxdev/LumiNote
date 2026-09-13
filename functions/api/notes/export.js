// /api/notes/export — the user's data, out of D1 and into their hands.
// ?format=md (default, human-readable) or json (full fidelity).
import { SQL, DEFAULT_USER, rowToJson } from './store.js';

const KIND_TITLES = { note: 'Notes', clip: 'Clips', transcript: 'Transcripts' };

// Exported for the contract tests (pure formatter, runtime-free).
export function markdown(rows, exportedAt) {
  const lines = [`# LumiNote export`, ``, `Exported ${exportedAt}`, ``];
  for (const kind of ['note', 'clip', 'transcript']) {
    const group = rows.filter((r) => r.kind === kind);
    if (!group.length) continue;
    lines.push(`## ${KIND_TITLES[kind]}`, ``);
    for (const row of group) {
      const device = row.source_device ? ` (from ${row.source_device})` : '';
      lines.push(`### ${row.created_at}${row.pinned ? ' • pinned' : ''}${device}`, ``);
      lines.push(row.text, ``);
    }
  }
  if (lines.length <= 4) lines.push('_Nothing saved yet._', '');
  return lines.join('\n');
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database binding not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const format = new URL(request.url).searchParams.get('format') === 'json' ? 'json' : 'md';
  const { results } = await env.DB.prepare(SQL.listAll).bind(DEFAULT_USER, 1000).all();
  const rows = results.map(rowToJson);
  const exportedAt = new Date().toISOString();
  const dateStamp = exportedAt.slice(0, 10).replace(/-/g, '');

  if (format === 'json') {
    return new Response(JSON.stringify({ exported_at: exportedAt, notes: rows }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="luminote-export-${dateStamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  return new Response(markdown(rows, exportedAt), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="luminote-export-${dateStamp}.md"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequest() {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
