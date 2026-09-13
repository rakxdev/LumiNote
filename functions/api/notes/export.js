// /api/notes/export — the user's data, out of D1 and into their hands.
// ?format=md (default, human-readable) or json (full fidelity).
//
// Streams: rows are paginated out of D1 in batches and written to the
// response as they arrive, so a large library cannot exhaust the isolate's
// memory. User text is escaped so it cannot forge document structure or
// inject raw HTML into whatever renders the download.
import { SQL, DEFAULT_USER } from './store.js';
import { authGuard } from '../auth/totp.js';

const KIND_TITLES = { note: 'Notes', clip: 'Clips', transcript: 'Transcripts' };
const BATCH = 200;

// Render text inert inside Markdown: escape backslashes and HTML that some
// renderers execute, and defuse line-leading structure (#, >, -, +) so
// user content cannot forge headings, lists, or quotes.
export function escapeMarkdown(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .map((line) => line.replace(/^(\s*)([#>+=`-]+)/, (m, ws, marks) => ws + marks.split('').map((c) => '\\' + c).join('')))
    .join('\n');
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function mdRow(row) {
  const device = row.source_device ? ` (from ${esc(row.source_device)})` : '';
  return `### ${row.created_at}${row.pinned ? ' • pinned' : ''}${device}\n\n${escapeMarkdown(row.text)}\n`;
}

function jsonRow(row) {
  return JSON.stringify({ ...row, pinned: !!row.pinned });
}

async function* rows(env) {
  let offset = 0;
  for (;;) {
    const { results } = await env.DB.prepare(SQL.listAll).bind(DEFAULT_USER, BATCH, offset).all();
    if (!results.length) return;
    for (const row of results) yield row;
    if (results.length < BATCH) return;
    offset += BATCH;
  }
}

function streamResponse(format, exportedAt, producer) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (format === 'json') {
          controller.enqueue(encoder.encode(`{\n  "exported_at": ${JSON.stringify(exportedAt)},\n  "notes": [`));
        } else {
          controller.enqueue(encoder.encode(`# LumiNote export\n\nExported ${exportedAt}\n\n`));
        }
        let first = true;
        let lastKind = null;
        for await (const row of producer) {
          if (format === 'json') {
            controller.enqueue(encoder.encode((first ? '' : ',\n  ') + jsonRow(row)));
          } else {
            if (row.kind !== lastKind) {
              if (lastKind !== null) controller.enqueue(encoder.encode('\n'));
              controller.enqueue(encoder.encode(`## ${KIND_TITLES[row.kind] || row.kind}\n\n`));
              lastKind = row.kind;
            }
            controller.enqueue(encoder.encode(mdRow(row)));
          }
          first = false;
        }
        if (first) {
          controller.enqueue(encoder.encode(format === 'json' ? ']' : '_Nothing saved yet._\n'));
        } else if (format === 'json') {
          controller.enqueue(encoder.encode('\n]'));
        }
        if (format === 'json') controller.enqueue(encoder.encode('\n}\n'));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  const types = { md: 'text/markdown; charset=utf-8', json: 'application/json; charset=utf-8' };
  return new Response(stream, {
    headers: {
      'Content-Type': types[format],
      'Content-Disposition': `attachment; filename="luminote-export-${exportedAt.slice(0, 10).replace(/-/g, '')}.${format}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestGet({ env, request }) {
  const denied = await authGuard({ env, request });
  if (denied) return denied;
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database binding not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const format = new URL(request.url).searchParams.get('format') === 'json' ? 'json' : 'md';
  return streamResponse(format, new Date().toISOString(), rows(env));
}

export async function onRequest() {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
