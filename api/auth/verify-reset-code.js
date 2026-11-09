import { guard, method, jsonBody, normalEmail, verifyCode, consumeLimit, fail } from './_lib/server.js';

export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;
  try {
    const body = jsonBody(req);
    const email = normalEmail(body.email);
    const code = String(body.code || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'Enter your email and the complete 6-digit reset code.' });
    }
    if (!await consumeLimit(`password-reset-check:${email}`, 10, 900)) {
      return res.status(429).json({ message: 'Too many attempts. Please request a new reset code later.' });
    }
    await verifyCode(email, 'password_reset', code, false);
    return res.status(200).json({ verified: true });
  } catch (e) { return fail(res, e, 400); }
}
