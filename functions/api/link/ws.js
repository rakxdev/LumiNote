// Pages Function: WebSocket upgrade proxy for Link Mode rooms.
// Validates the room code, then passes the upgrade through to the SyncRoom
// Durable Object (deployed separately as the `luminote-sync` Worker — Pages
// projects cannot define Durable Objects themselves).
// Source: https://developers.cloudflare.com/pages/functions/bindings/

import {
  sanitizeRoomCode,
  isValidRoomCode,
} from './room-protocol.js';

export async function onRequest(context) {
  const request = context.request;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const room = sanitizeRoomCode(url.searchParams.get('room') || '');
  if (!isValidRoomCode(room)) {
    return new Response(JSON.stringify({ error: 'Invalid room code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ error: 'Expected WebSocket upgrade' }), {
      status: 426,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = context.env.SYNC_ROOM.idFromName(room);
  const stub = context.env.SYNC_ROOM.get(id);
  return stub.fetch(request);
}
