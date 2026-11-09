import { adminClient, readSession, normalEmail } from '../../auth/_lib/server.js';

export function allowedAdminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',').map(normalEmail).filter(Boolean);
}

export function isAdminEmail(email) {
  return allowedAdminEmails().includes(normalEmail(email));
}

export async function currentAdmin(req) {
  const session = await readSession(req);
  if (!session || !isAdminEmail(session.user.email)) return null;
  return session;
}

export async function recordAdminEvent(req, email, event, outcome, detail = '') {
  try {
    const db = adminClient();
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    await db.from('hysacam_admin_audit').insert({
      email: normalEmail(email) || 'unknown',
      event,
      outcome,
      ip_address: forwarded || null,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
      detail: String(detail).slice(0, 500) || null
    });
  } catch (error) {
    console.error('[HYSACAM admin audit] Could not record event:', error?.message || error);
  }
}
