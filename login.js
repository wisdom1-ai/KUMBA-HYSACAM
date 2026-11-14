import { anonClient, adminClient, guard, method, jsonBody, normalEmail, consumeLimit, sendCode, encrypt } from '../auth/_lib/server.js';
import { isAdminEmail, recordAdminEvent } from './_lib/admin.js';

export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;
  const body = jsonBody(req);
  const email = normalEmail(body.email);
  const password = body.password;
  if (!/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || !password) {
    await recordAdminEvent(req, email, 'admin_password_login', 'denied', 'Invalid input');
    return res.status(401).json({ message: 'Administrator access could not be verified.' });
  }
  if (!process.env.ADMIN_EMAILS || !isAdminEmail(email)) {
    await recordAdminEvent(req, email, 'admin_password_login', 'denied', 'Email not on administrator allowlist');
    return res.status(403).json({ message: 'This account is not authorised for administrator access.' });
  }
  try {
    if (!await consumeLimit(`admin-login:${email}`, 8, 900)) {
      await recordAdminEvent(req, email, 'admin_password_login', 'rate_limited');
      return res.status(429).json({ message: 'Too many attempts. Please wait before trying again.' });
    }
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      await recordAdminEvent(req, email, 'admin_password_login', 'failed', 'Password or account verification failed');
      return res.status(401).json({ message: 'Administrator access could not be verified.' });
    }
    await sendCode(email, 'admin_login', data.user.id, encrypt(data.session.refresh_token));
    await recordAdminEvent(req, email, 'admin_password_login', 'password_accepted_otp_sent');
    return res.status(200).json({ code_sent: true, message: 'A verification code has been sent to your authorised email.' });
  } catch (error) {
    console.error('[HYSACAM admin login]', error?.message || error);
    return res.status(500).json({ message: 'Secure administrator sign-in is temporarily unavailable.' });
  }
}
