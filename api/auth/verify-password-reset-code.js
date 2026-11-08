import {
  guard,
  method,
  jsonBody,
  normalEmail,
  verifyCode,
  consumeLimit,
  fail
} from './_lib/server.js';

export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;

  try {
    const body = jsonBody(req);
    const email = normalEmail(body.email);
    const code = String(body.code || '').trim();

    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        message: 'Enter a valid email address and the 6-digit code.'
      });
    }

    const allowed = await consumeLimit(`password-reset-code-check:${email}`, 10, 900);
    if (!allowed) {
      return res.status(429).json({
        message: 'Too many code attempts. Please request a new reset code later.'
      });
    }

    await verifyCode(email, 'password_reset', code, false);
    return res.status(200).json({ verified: true });
  } catch (error) {
    return fail(res, error, 400);
  }
}
