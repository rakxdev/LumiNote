// /api/auth/enroll — start TOTP setup: generate a secret and return the
// otpauth:// URI (for the QR) plus the secret (for manual entry). Refuses
// when login is already confirmed; resetting requires deleting the
// app_settings rows (wrangler d1 execute) so a thief cannot silently
// replace the secret.
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

  const secretB32 = secret || generateSecretB32();
  await putSetting(env, 'totp_secret', secretB32);
  await putSetting(env, 'totp_confirmed', '0');

  const totp = buildTotp(secretB32);
  return Response.json(
    { otpauth_uri: totp.toString(), secret: secretB32 },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
