import { adminClient, guard, method, jsonBody, readSession, consumeLimit, fail } from './_lib/server.js';
export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;
  try {
    const session = await readSession(req);
    if (!session) return res.status(401).json({ message: 'Please sign in again.' });
    if (!await consumeLimit(`profile:${session.user.id}`, 30, 3600)) return res.status(429).json({ message: 'Too many changes. Please try again later.' });
    const body = jsonBody(req);
    const name = String(body.name || '').replace(/\s+/g, ' ').trim();
    const phone = String(body.phone || '').trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Enter your full name (2 to 80 characters).' });
    if (phone && !/^[+\d\s().-]{6,25}$/.test(phone)) return res.status(400).json({ message: 'Enter a valid phone number or leave it empty.' });
    const meta = { ...(session.user.user_metadata || {}), full_name: name, name, phone };
    const { error } = await adminClient().auth.admin.updateUserById(session.user.id, { user_metadata: meta });
    if (error) throw error;
    return res.status(200).json({ ok: true, user: { name, email: session.user.email, phone } });
  } catch (e) { return fail(res, e, 500); }
}
