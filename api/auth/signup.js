import { adminClient, guard, method, jsonBody, normalEmail, consumeLimit, sendCode, fail } from './_lib/server.js';
export default async function handler(req, res) {
  if (!guard(req,res) || !method(req,res,'POST')) return;
  try {
    const { name, password } = jsonBody(req); const email = normalEmail(jsonBody(req).email);
    if (!name || name.trim().length > 80 || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8) return res.status(400).json({ message: 'Enter a valid name, email and password of at least 8 characters.' });
    if (!await consumeLimit(`signup:${email}`, 3, 3600)) return res.status(429).json({ message: 'Too many attempts. Please try again later.' });
    const db = adminClient();
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name: name.trim() } });
    if (error || !data.user) return res.status(400).json({ message: 'We could not create that account. Check the details or try signing in.' });
    await sendCode(email, 'signup', data.user.id);
    return res.status(200).json({ code_sent: true });
  } catch (e) { return fail(res,e,500); }
}
