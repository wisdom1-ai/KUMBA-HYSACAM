import { adminClient, guard, jsonBody, readSession } from '../auth/_lib/server.js';
import { isAdminEmail } from './_lib/admin.js';

const clean = (v, max = 160) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const validCoord = (v, min, max) => v === '' || v == null || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max);
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* The database stores each dustbin with an automatic uuid `id` and the typed ID in `bin_code`.
   The dashboard keeps working with the typed code, so it is swapped in and out here. */
const STATUSES = ['available', 'pending', 'full', 'maintenance', 'inactive'];
const normStatus = (v) => { const s = clean(v || 'available', 40).toLowerCase(); return STATUSES.includes(s) ? s : null; };
const BIN_COLS = 'id,bin_code,name,area,latitude,longitude,status';
const toUi = (b) => ({ id: b.bin_code || b.id, name: b.name, area: b.area, latitude: b.latitude, longitude: b.longitude, status: b.status });

async function findBin(db, key) {
  if (!key) return null;
  if (isUuid(key)) {
    const byId = await db.from('bins').select(BIN_COLS).eq('id', key).maybeSingle();
    if (byId.data) return byId.data;
  }
  const byCode = await db.from('bins').select(BIN_COLS).eq('bin_code', key).maybeSingle();
  return byCode.data || null;
}

/* Keeps the database's own reason so the dashboard can show it to the administrator */
function failure(message, error) {
  const e = new Error(message);
  if (error) e.diagnostic = { message: error.message, details: error.details, hint: error.hint, code: error.code };
  return e;
}

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
        db.from('bins').select(BIN_COLS).order('name', { ascending: true }).limit(1000),
        db.from('cleaning_records').select('id,bin_id,area,cleaned_at,activity,status,notes,verified').order('cleaned_at', { ascending: false }).limit(500),
        db.auth.admin.listUsers({ page: 1, perPage: 1000 })
      ]);
      if (binsError) throw failure('Could not load dustbins.', binsError);
      if (recordsError) throw failure('Could not load cleaning records.', recordsError);
      if (usersResult.error) throw new Error('Could not load user accounts.');
      const codeById = new Map((bins || []).map((b) => [String(b.id), b.bin_code || b.id]));
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
        bins: (bins || []).map(toUi),
        records: (records || []).map((r) => ({ ...r, bin_id: codeById.get(String(r.bin_id)) || r.bin_id })),
        users,
        administrator: session.user.email
      });
    }

    if (req.method === 'POST') {
      const body = jsonBody(req);
      if (body.type === 'bin') {
        const code = clean(body.id, 48);
        const name = clean(body.name, 120);
        const area = clean(body.area, 120);
        const latitude = body.latitude == null || body.latitude === '' ? null : Number(body.latitude);
        const longitude = body.longitude == null || body.longitude === '' ? null : Number(body.longitude);
        const status = normStatus(body.status);
        if (!code || !name || !area || !validCoord(latitude, -90, 90) || !validCoord(longitude, -180, 180) || ((latitude == null) !== (longitude == null))) {
          return res.status(400).json({ message: 'Enter a dustbin ID, name, area and valid coordinate pair.' });
        }
        if (!status) return res.status(400).json({ message: 'Choose a valid status.' });
        const { data, error } = await db.from('bins').insert({ bin_code: code, name, area, latitude, longitude, status }).select(BIN_COLS).single();
        if (error) {
          if (error.code === '23505') return res.status(409).json({ message: 'That dustbin ID is already registered.' });
          throw failure('Could not register this dustbin. Check the bins table fields and permissions.', error);
        }
        return res.status(201).json({ bin: toUi(data) });
      }
      if (body.type === 'record') {
        const binKey = clean(body.bin_id, 64);
        const area = clean(body.area, 120);
        const activity = clean(body.activity || 'Routine cleaning', 120);
        const status = clean(body.status || 'Cleaned', 40);
        const notes = clean(body.notes, 500);
        const cleanedAt = body.cleaned_at ? new Date(body.cleaned_at) : new Date();
        if (!binKey || !area || Number.isNaN(cleanedAt.getTime())) return res.status(400).json({ message: 'Select a dustbin and enter a valid date and location.' });
        const bin = await findBin(db, binKey);
        if (!bin) return res.status(404).json({ message: 'The selected dustbin could not be found.' });
        const { data, error } = await db.from('cleaning_records').insert({
          bin_id: bin.id, area: area || bin.area, cleaned_at: cleanedAt.toISOString(),
          activity, status, notes: notes || null, verified: true
        }).select('id,bin_id,area,cleaned_at,activity,status,notes,verified').single();
        if (error) throw failure('Could not save this cleaning record. Check the cleaning_records table fields.', error);
        return res.status(201).json({ record: { ...data, bin_id: bin.bin_code || bin.id } });
      }
      return res.status(400).json({ message: 'Unknown administrator action.' });
    }

    if (req.method === 'PATCH') {
      const body = jsonBody(req);
      const key = clean(body.id, 64);
      const name = clean(body.name, 120);
      const area = clean(body.area, 120);
      const status = normStatus(body.status);
      const latitude = body.latitude == null || body.latitude === '' ? null : Number(body.latitude);
      const longitude = body.longitude == null || body.longitude === '' ? null : Number(body.longitude);
      if (!key || !name || !area || !validCoord(latitude, -90, 90) || !validCoord(longitude, -180, 180) || ((latitude == null) !== (longitude == null))) {
        return res.status(400).json({ message: 'Enter valid dustbin details and a valid coordinate pair.' });
      }
      if (!status) return res.status(400).json({ message: 'Choose a valid status.' });
      const bin = await findBin(db, key);
      if (!bin) return res.status(404).json({ message: 'That dustbin could not be found.' });
      const { data, error } = await db.from('bins').update({ name, area, latitude, longitude, status }).eq('id', bin.id).select(BIN_COLS).single();
      if (error) throw failure('Could not update this dustbin.', error);
      return res.status(200).json({ bin: toUi(data) });
    }

    if (req.method === 'DELETE') {
      const key = clean(jsonBody(req).id, 64);
      if (!key) return res.status(400).json({ message: 'Dustbin ID is required.' });
      const bin = await findBin(db, key);
      if (!bin) return res.status(404).json({ message: 'That dustbin could not be found.' });
      const { error } = await db.from('bins').delete().eq('id', bin.id);
      if (error) throw failure('Could not delete this dustbin. Check whether cleaning records are linked to it.', error);
      return res.status(200).json({ deleted: true, id: key });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ message: 'Method not allowed.' });
  } catch (error) {
    console.error('[HYSACAM admin management]', error?.message || error, error?.diagnostic || '');
    return res.status(500).json({
      message: error?.message || 'Administrator data could not be loaded.',
      ...(error?.diagnostic ? { diagnostic: error.diagnostic } : {})
    });
  }
}
