import { guard, method, jsonBody, normalEmail, verifyCode, createSessionFromChallenge } from '../auth/_lib/server.js';
import { isAdminEmail, recordAdminEvent } from './_lib/admin.js';
export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;
  const body = jsonBody(req);
  const email = normalEmail(body.email);
  const code = String(body.code || '').trim();
  if (!isAdminEmail(email) || !/^\d{6}$/.test(code)) {
    await recordAdminEvent(req, email, 'admin_otp_verification', 'denied', 'Not allowlisted or invalid code format');
    return res.status(401).json({ message: 'The verification code is invalid or has expired.' });
  }
  try {
    const row = await verifyCode(email, 'admin_login', code, true);
    await createSessionFromChallenge(row, req, res);
    await recordAdminEvent(req, email, 'admin_otp_verification', 'success');
    return res.status(200).json({ authenticated: true, role: 'administrator' });
  } catch (error) {
    await recordAdminEvent(req, email, 'admin_otp_verification', 'failed', error?.message || 'Code verification failed');
    return res.status(401).json({ message: error?.message || 'The verification code is invalid or has expired.' });
  }
}
