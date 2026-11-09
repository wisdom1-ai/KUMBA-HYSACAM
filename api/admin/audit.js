import { guard, method, adminClient } from '../auth/_lib/server.js';
import { currentAdmin } from './_lib/admin.js';
export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'GET')) return;
  try {
    if (!await currentAdmin(req)) return res.status(403).json({ message: 'Administrator access required.' });
    const db = adminClient();
    const { data, error } = await db.from('hysacam_admin_audit').select('id,email,event,outcome,ip_address,user_agent,detail,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return res.status(200).json({ events: data || [] });
  } catch (error) {
    console.error('[HYSACAM admin audit]', error?.message || error);
    return res.status(503).json({ message: 'Login activity is not available yet. Apply the admin database setup SQL.' });
  }
}
