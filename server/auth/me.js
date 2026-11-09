import { guard, method, readSession, fail } from './_lib/server.js';
export default async function handler(req, res) {
  if (!guard(req,res) || !method(req,res,'GET')) return;
  try {
    const session = await readSession(req);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, user: { id: session.user.id, name: session.user.user_metadata?.full_name || '', email: session.user.email } });
  } catch (e) { return fail(res,e,500); }
}
