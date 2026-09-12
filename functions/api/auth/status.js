// /api/auth/status — what the client needs to decide its login UI:
// enrolled (secret exists), confirmed (setup finished), and auth_valid
// (the request already carries a valid login cookie).
import { getSetting, AUTH_COOKIE, parseCookieHeader, verifyAuthCookie } from './totp.js';

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
  return Response.json(
    { enrolled: !!secret, confirmed, auth_valid },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
