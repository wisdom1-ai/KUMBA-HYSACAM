import { anonClient, guard, method, jsonBody, normalEmail, consumeLimit, encrypt, sendCode, fail } from './_lib/server.js';
export default async function handler(req, res) {
  if (!guard(req,res) || !method(req,res,'POST')) return;
  try {
    const email = normalEmail(jsonBody(req).email); const password = jsonBody(req).password;
    if (!/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || !password) return res.status(400).json({ message: 'Email or password is incorrect.' });
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      // Successful sign-ins are not rate-limited. Only failed password attempts count.
      if (!await consumeLimit(`login-failed:${email}`, 20, 900)) {
        return res.status(429).json({ message: 'Too many incorrect sign-in attempts. Please try again later.' });
      }
      return res.status(401).json({ message: 'Email or password is incorrect, or the email has not been verified.' });
    }
    await sendCode(email, 'login', data.user.id, encrypt(data.session.refresh_token));
    return res.status(200).json({ code_sent: true });
  } catch (e) { return fail(res,e,500); }
}
