import { adminClient, guard, jsonBody, readSession, fail } from '../auth/_lib/server.js';
import { isAdminEmail } from '../admin/_lib/admin.js';

const STATUSES = new Set(['submitted','under_review','assigned','in_progress','resolved','rejected']);
export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const session = await readSession(req);
    if (!session || !isAdminEmail(session.user.email)) return res.status(403).json({ message: 'Administrator access required.' });
    const db = adminClient();
    if (req.method === 'GET') {
      const { data, error } = await db.from('resident_reports')
        .select('id,reference_code,resident_id,reporter_name,reporter_email,reporter_phone,issue_type,location_description,area,description,latitude,longitude,photo_path,status,admin_notes,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(250);
      if (error) throw new Error('Could not load resident reports.');
      return res.status(200).json({ reports: data || [] });
    }
    if (req.method === 'PATCH') {
      const body = jsonBody(req); const id = String(body.id || ''); const status = String(body.status || '');
      const notes = typeof body.admin_notes === 'string' ? body.admin_notes.trim().slice(0,1000) : '';
      if (!id || !STATUSES.has(status)) return res.status(400).json({ message: 'A valid report and status are required.' });
      const { data, error } = await db.from('resident_reports').update({ status, admin_notes: notes || null, updated_at: new Date().toISOString() }).eq('id', id).select('id,reference_code,status,admin_notes,updated_at').single();
      if (error) throw new Error('Could not update this report.');
      return res.status(200).json({ report: data });
    }
    res.setHeader('Allow','GET, PATCH'); return res.status(405).json({ message:'Method not allowed.' });
  } catch (error) { return fail(res, error, 500); }
}
