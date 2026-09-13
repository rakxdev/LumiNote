// Pages Function: WebSocket upgrade proxy for Link Mode rooms.
// Validates the room code, then passes the upgrade through to the SyncRoom
// Durable Object (deployed separately as the `luminote-sync` Worker — Pages
// projects cannot define Durable Objects themselves).
// Source: https://developers.cloudflare.com/pages/functions/bindings/

import {
  sanitizeRoomCode,
  isValidRoomCode,
} from './room-protocol.js';
import {
  getSetting,
  putSetting,
  AUTH_COOKIE,
  AUTH_TTL_SECONDS,
  parseCookieHeader,
  verifyAuthCookie,
} from '../auth/totp.js';

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

  // Room-scoped trust (ADR-005): the TOTP verifies a PERSON once per browser
  // (12h signed cookie). A verified device then opens a 12h trust window for
  // its room — recorded in D1 — so the owner's other devices join with just
  // the room code (QR or typed) instead of a second OTP. Only when no window
  // is open and the request carries no valid cookie is the upgrade refused.
  if (!context.env.DB) {
    // Fail closed: without the auth backend we cannot know whether this
    // room is gated, so the upgrade is refused rather than waved through.
    return new Response(JSON.stringify({ error: 'Auth backend unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const totpSecret = await getSetting(context.env, 'totp_secret');
  const confirmed = !!totpSecret
    && (await getSetting(context.env, 'totp_confirmed')) === '1';
  if (confirmed) {
    const raw = parseCookieHeader(request.headers.get('Cookie'), AUTH_COOKIE);
    const verified = raw && (await verifyAuthCookie(totpSecret, raw));
    if (verified) {
      // A verified upgrade opens/refreshes the room's 12h trust window —
      // the single source of truth for "this room joins without an OTP".
      const expiresAt = new Date(Date.now() + AUTH_TTL_SECONDS * 1000).toISOString();
      await putSetting(context.env, `room_auth:${room}`, expiresAt);
    } else {
      const until = await getSetting(context.env, `room_auth:${room}`);
      if (!until || new Date(until).getTime() < Date.now()) {
        return new Response(JSON.stringify({
          error: 'Room not unlocked yet — the verified device must open Link Mode first, or verify with your authenticator',
          code: 'auth_required',
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
    }
  }

  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ error: 'Expected WebSocket upgrade' }), {
      status: 426,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = context.env.SYNC_ROOM.idFromName(room);
  const stub = context.env.SYNC_ROOM.get(id);
  // Forward on a clone with any client-supplied trust headers stripped —
  // headers are not a trust channel; the D1 window above is.
  const upstream = new Request(request);
  upstream.headers.delete('x-ln-authed');
  upstream.headers.delete('x-ln-auth-required');
  return stub.fetch(upstream);
}
