// /api/auth/enroll — start TOTP setup: generate a secret and return the
// otpauth:// URI (for the QR) plus the secret (for manual entry). Refuses
// when login is already confirmed; resetting requires deleting the
// app_settings rows (wrangler d1 execute) so a thief cannot silently
// replace the secret.
//
// Every unconfirmed enroll ROTATES the secret. This closes the takeover
// window: whoever calls enroll last is the only party holding the pending
// secret, so a leaked QR can be invalidated by enrolling again, and an
// attacker polling this endpoint cannot ride a secret the owner was shown.
// confirm() additionally rejects pending setups older than 15 minutes.
import { getSetting, putSetting, generateSecretB32, buildTotp } from './totp.js';

export async function onRequestPost({ env }) {
  if (!env.DB) {
    return Response.json({ error: 'Database binding not configured' }, { status: 500 });
  }
  const secret = await getSetting(env, 'totp_secret');
  const confirmed = (await getSetting(env, 'totp_confirmed')) === '1';
  if (secret && confirmed) {
    return Response.json(
      { error: 'Authenticator login is already active' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Rotate: a fresh secret per enroll call. Never reuse a secret that was
  // already handed out in a previous response body.
  const secretB32 = generateSecretB32();
  await putSetting(env, 'totp_secret', secretB32);
  await putSetting(env, 'totp_confirmed', '0');
  await putSetting(env, 'totp_pending_at', String(Date.now()));

  const totp = buildTotp(secretB32);
  return Response.json(
    { otpauth_uri: totp.toString(), secret: secretB32 },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
