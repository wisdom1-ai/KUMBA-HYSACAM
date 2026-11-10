import { adminClient, guard, jsonBody, method, readSession, fail } from '../auth/_lib/server.js';
import { randomBytes } from 'node:crypto';

const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const session = await readSession(req);
    if (!session) return res.status(401).json({ message: 'Please sign in before accessing reports.' });
    const db = adminClient();
    if (req.method === 'GET') {
      const { data, error } = await db.from('resident_reports').select('id, reference_code, issue_type, location_description, area, description, latitude, longitude, status, created_at, updated_at').eq('resident_id', session.user.id).order('created_at', { ascending: false });
      if (error) throw new Error('Could not load your reports.');
      return res.status(200).json({ reports: data || [] });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ message: 'Method not allowed.' }); }
    const body = jsonBody(req);
    const issue_type = clean(body.issue_type, 100);
    const location_description = clean(body.location_description, 150);
    const area = clean(body.area, 100);
    const description = clean(body.description, 800);
    const phone = clean(body.phone, 40);
    const latitude = body.latitude == null ? null : Number(body.latitude);
    const longitude = body.longitude == null ? null : Number(body.longitude);
    if (issue_type.length < 3 || !location_description || !area || description.length < 3) return res.status(400).json({ message: 'Complete all required report fields.' });
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) return res.status(400).json({ message: 'The GPS coordinates are invalid.' });
    const reference_code = `HYS-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const { data, error } = await db.from('resident_reports').insert({ resident_id: session.user.id, reporter_name: clean(session.user.user_metadata?.full_name, 80), reporter_email: session.user.email, reporter_phone: phone || null, issue_type, location_description, area, description, latitude, longitude, reference_code }).select('id, reference_code, issue_type, location_description, area, description, latitude, longitude, status, created_at').single();
    if (error) { console.error('[HYSACAM reports]', error.message); throw new Error('Your report could not be saved. Please try again.'); }
    return res.status(201).json({ report: data });
  } catch (error) { return fail(res, error, 500); }
}
