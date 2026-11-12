import { adminClient, guard, jsonBody, readSession } from '../auth/_lib/server.js';
import { isAdminEmail } from './_lib/admin.js';

const clean = (v, max = 160) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const validCoord = (v, min, max) => v === '' || v == null || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max);

async function requireAdmin(req, res) {
  const session = await readSession(req);
  if (!session || !isAdminEmail(session.user.email)) {
    res.status(403).json({ message: 'Administrator access required.' });
    return null;
  }
  return session;
}

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const session = await requireAdmin(req, res);
    if (!session) return;
    const db = adminClient();

    if (req.method === 'GET') {
      const [{ data: bins, error: binsError }, { data: records, error: recordsError }, usersResult] = await Promise.all([
        db.from('bins').select('id,bin_code,name,area,latitude,longitude,status').order('name', { ascending: true }).limit(1000),
        db.from('cleaning_records').select('id,bin_id,area,cleaned_at,activity,status,notes,verified').order('cleaned_at', { ascending: false }).limit(500),
        db.auth.admin.listUsers({ page: 1, perPage: 1000 })
      ]);
      if (binsError) throw new Error(binsError.code === '42703' ? 'The bins.bin_code column is missing. Run supabase/uuid-bin-code-migration.sql in Supabase first.' : 'Could not load dustbins.');
      if (recordsError) throw new Error('Could not load cleaning records.');
      if (usersResult.error) throw new Error('Could not load user accounts.');
      const users = (usersResult.data?.users || []).map(user => ({
        id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: user.email || '',
        created_at: user.created_at,
        email_confirmed: Boolean(user.email_confirmed_at),
        last_sign_in_at: user.last_sign_in_at || null,
        role: isAdminEmail(user.email) ? 'administrator' : 'resident'
      }));
      return res.status(200).json({
        bins: bins || [],
        records: records || [],
        users,
        administrator: session.user.email
      });
    }

    if (req.method === 'POST') {
      const body = jsonBody(req);
      if (body.type === 'bin') {
        const binCode = clean(body.bin_code, 48).toUpperCase();
        const name = clean(body.name, 120);
        const area = clean(body.area, 120);
        const latitude = body.latitude == null || body.latitude === '' ? null : Number(body.latitude);
        const longitude = body.longitude == null || body.longitude === '' ? null : Number(body.longitude);
        const status = clean(body.status || 'Available', 40);
        if (!binCode || !name || !area || !validCoord(latitude, -90, 90) || !validCoord(longitude, -180, 180) || ((latitude == null) !== (longitude == null))) {
          return res.status(400).json({ message: 'Enter a dustbin code, name, area and valid coordinate pair.' });
        }
        const payload = { bin_code: binCode, name, area, latitude, longitude, status };
        const { data, error } = await db.from('bins').insert(payload).select('id,bin_code,name,area,latitude,longitude,status').single();
        if (error) {
          // Log database diagnostics on the server only. Never log request payloads,
          // credentials, cookies, or Supabase keys.
          console.error('[HYSACAM dustbin insert] Supabase rejected the insert:', {
            code: error.code || null,
            message: error.message || null,
            details: error.details || null,
            hint: error.hint || null
          });
          if (error.code === '23505') return res.status(409).json({ message: 'That dustbin code is already registered.' });
          if (error.code === '42703') throw new Error('The bins.bin_code column is missing. Run supabase/uuid-bin-code-migration.sql in Supabase first.');
          if (error.code === '22P02') throw new Error('The database rejected an identifier format. Confirm the UUID/bin-code migration is installed.');
          throw new Error('Could not register this dustbin. Check Vercel function logs for the Supabase error details.');
        }
        return res.status(201).json({ bin: data });
      }
      if (body.type === 'record') {
        const binId = clean(body.bin_id, 48);
        const area = clean(body.area, 120);
        const activity = clean(body.activity || 'Routine cleaning', 120);
        const status = clean(body.status || 'Cleaned', 40);
        const notes = clean(body.notes, 500);
        const cleanedAt = body.cleaned_at ? new Date(body.cleaned_at) : new Date();
        if (!binId || !area || Number.isNaN(cleanedAt.getTime())) return res.status(400).json({ message: 'Select a dustbin and enter a valid date and location.' });
        const { data: bin, error: binError } = await db.from('bins').select('id,area').eq('id', binId).maybeSingle();
        if (binError || !bin) return res.status(404).json({ message: 'The selected dustbin could not be found.' });
        const { data, error } = await db.from('cleaning_records').insert({
          bin_id: binId, area: area || bin.area, cleaned_at: cleanedAt.toISOString(),
          activity, status, notes: notes || null, verified: true
        }).select('id,bin_id,area,cleaned_at,activity,status,notes,verified').single();
        if (error) throw new Error('Could not save this cleaning record. Check the cleaning_records table fields.');
        return res.status(201).json({ record: data });
      }
      return res.status(400).json({ message: 'Unknown administrator action.' });
    }

    if (req.method === 'PATCH') {
      const body = jsonBody(req);
      const id = clean(body.id, 48);
      const name = clean(body.name, 120);
      const area = clean(body.area, 120);
      const status = clean(body.status, 40);
      const latitude = body.latitude == null || body.latitude === '' ? null : Number(body.latitude);
      const longitude = body.longitude == null || body.longitude === '' ? null : Number(body.longitude);
      if (!id || !name || !area || !validCoord(latitude, -90, 90) || !validCoord(longitude, -180, 180) || ((latitude == null) !== (longitude == null))) {
        return res.status(400).json({ message: 'Enter valid dustbin details and a valid coordinate pair.' });
      }
      const { data, error } = await db.from('bins').update({ name, area, latitude, longitude, status: status || 'Available' }).eq('id', id).select('id,bin_code,name,area,latitude,longitude,status').single();
      if (error) throw new Error('Could not update this dustbin.');
      return res.status(200).json({ bin: data });
    }

    if (req.method === 'DELETE') {
      const id = clean(jsonBody(req).id, 48);
      if (!id) return res.status(400).json({ message: 'Dustbin ID is required.' });
      const { error } = await db.from('bins').delete().eq('id', id);
      if (error) throw new Error('Could not delete this dustbin. Check whether cleaning records are linked to it.');
      return res.status(200).json({ deleted: true, id });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ message: 'Method not allowed.' });
  } catch (error) {
    console.error('[HYSACAM admin management]', {
      message: error?.message || 'Unknown error',
      code: error?.code || null,
      name: error?.name || null
    });
    return res.status(500).json({ message: error?.message || 'Administrator data could not be loaded.' });
  }
}
