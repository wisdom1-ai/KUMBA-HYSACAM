import { adminClient, guard, method, getCookie, hash, clearSessionCookie, fail } from './_lib/server.js';
export default async function handler(req, res) {
  if (!guard(req,res) || !method(req,res,'POST')) return;
  try {
    const token = getCookie(req,'hysacam_session');
    if (token) { const db = adminClient(); await db.from('hysacam_auth_sessions').delete().eq('session_hash',hash(token)); }
    clearSessionCookie(req,res);
    return res.status(200).json({ signed_out: true });
  } catch (e) { clearSessionCookie(req,res); return fail(res,e,500); }
}
