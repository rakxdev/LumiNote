// /api/auth/status — what the client needs to decide its login UI:
// enrolled (secret exists), confirmed (setup finished), auth_valid (the
// request already carries a valid login cookie), and — when a room code is
// supplied — room_authed (that room is inside its 12h trust window, so
// joining it needs no OTP).
import { getSetting, AUTH_COOKIE, parseCookieHeader, verifyAuthCookie } from './totp.js';
import { sanitizeRoomCode, isValidRoomCode } from '../link/room-protocol.js';

export async function onRequestGet({ env, request }) {
  if (!env.DB) {
    return Response.json({ error: 'Database binding not configured' }, { status: 500 });
  }
  const secret = await getSetting(env, 'totp_secret');
  const confirmed = (await getSetting(env, 'totp_confirmed')) === '1';
  let auth_valid = false;
  if (confirmed && secret) {
    const raw = parseCookieHeader(request.headers.get('Cookie'), AUTH_COOKIE);
    auth_valid = !!(raw && (await verifyAuthCookie(secret, raw)));
  }

  let room_authed = false;
  const room = sanitizeRoomCode(new URL(request.url).searchParams.get('room') || '');
  if (confirmed && room && isValidRoomCode(room)) {
    const until = await getSetting(env, `room_auth:${room}`);
    room_authed = !!(until && new Date(until).getTime() > Date.now());
  }

  return Response.json(
    { enrolled: !!secret, confirmed, auth_valid, room_authed },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
