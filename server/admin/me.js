import { guard, method } from '../auth/_lib/server.js';
import { currentAdmin } from './_lib/admin.js';
export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'GET')) return;
  try {
    const session = await currentAdmin(req);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, role: 'administrator', email: session.user.email });
  } catch { return res.status(503).json({ message: 'Administrator session could not be checked.' }); }
}
