import { adminClient, guard, method, jsonBody, normalEmail, verifyCode, consumeLimit, fail } from './_lib/server.js';

export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;
  try {
    const body = jsonBody(req);
    const email = normalEmail(body.email);
    const code = String(body.code || '').trim();
    const password = body.password;
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code) ||
        typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Enter a valid email, 6-digit code and a password of at least 8 characters.' });
    }
    if (!await consumeLimit(`password-reset-verify:${email}`, 10, 900)) {
      return res.status(429).json({ message: 'Too many attempts. Please request a new reset code later.' });
    }

    // Verify and consume the one-time code before changing the account password.
    const challenge = await verifyCode(email, 'password_reset', code, true);
    const db = adminClient();
    const { error } = await db.auth.admin.updateUserById(challenge.user_id, { password });
    if (error) return res.status(400).json({ message: 'We could not update your password. Please try again.' });

    await db.from('hysacam_auth_challenges').delete().eq('email', email).eq('purpose', 'password_reset');
    await db.from('hysacam_auth_sessions').delete().eq('user_id', challenge.user_id);
    return res.status(200).json({ password_reset: true });
  } catch (e) { return fail(res, e, 400); }
}
