import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac, randomBytes, randomInt, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM;
const APP_ORIGIN = process.env.APP_ORIGIN;
const ENC_KEY = process.env.SESSION_ENCRYPTION_KEY;

export function adminClient() {
  if (!URL || !SERVICE) throw new Error('Server configuration is incomplete.');
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function anonClient() {
  if (!URL || !ANON) throw new Error('Server configuration is incomplete.');
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.method === 'GET';
  const allowed = [APP_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean);
  return allowed.includes(origin);
}
export function guard(req, res) {
  if (!allowedOrigin(req)) { res.status(403).json({ message: 'Request not allowed.' }); return false; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  return true;
}
export function method(req, res, expected) {
  if (req.method !== expected) { res.setHeader('Allow', expected); res.status(405).json({ message: 'Method not allowed.' }); return false; }
  return true;
}
export function jsonBody(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }
export function normalEmail(value) { return String(value || '').trim().toLowerCase(); }
export function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function encryptionKey() {
  if (!ENC_KEY) throw new Error('Session encryption is not configured.');
  const key = Buffer.from(ENC_KEY, 'hex');
  if (key.length !== 32) throw new Error('SESSION_ENCRYPTION_KEY must be 64 hexadecimal characters.');
  return key;
}
export function encrypt(value) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join('.');
}
export function decrypt(value) {
  const [iv, tag, data] = String(value).split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}
function otpHash(email, purpose, code) {
  if (!ENC_KEY) throw new Error('OTP signing is not configured.');
  return createHmac('sha256', encryptionKey()).update(`${email}|${purpose}|${code}`).digest('hex');
}
export async function consumeLimit(key, max, seconds) {
  const db = adminClient();
  const { data, error } = await db.rpc('hysacam_consume_rate_limit', { p_key_hash: hash(key), p_max: max, p_window_seconds: seconds });
  if (error) throw new Error('Rate limiting is not configured. Run the supplied SQL setup first.');
  return data === true;
}
export async function sendCode(email, purpose, userId, encryptedRefreshToken = null) {
  if (!RESEND || !FROM) throw new Error('Email delivery is not configured yet.');
  const db = adminClient();
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await db.from('hysacam_auth_challenges').upsert({
    email, purpose, user_id: userId, code_hash: otpHash(email, purpose, code),
    expires_at: expires, attempts: 0, sent_at: new Date().toISOString(),
    encrypted_refresh_token: encryptedRefreshToken
  }, { onConflict: 'email,purpose' });
  if (error) throw new Error('Could not prepare verification. Please try again.');
  const subject = purpose === 'signup' ? 'Verify your HYSACAM account' : 'Your HYSACAM sign-in code';
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#18352a"><h2>HYSACAM Kumba Tracker</h2><p>Your verification code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. Do not share it with anyone.</p></div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [email], subject, html })
  });
  if (!response.ok) {
    await db.from('hysacam_auth_challenges').delete().eq('email', email).eq('purpose', purpose);
    throw new Error('We could not send the email code. Email delivery still needs configuration.');
  }
}
export async function verifyCode(email, purpose, code) {
  const db = adminClient();
  const { data: row, error } = await db.from('hysacam_auth_challenges').select('*').eq('email', email).eq('purpose', purpose).maybeSingle();
  if (error || !row) throw new Error('The code is invalid or has expired. Request a new code.');
  if (new Date(row.expires_at).getTime() < Date.now()) { await db.from('hysacam_auth_challenges').delete().eq('id', row.id); throw new Error('The code has expired. Request a new code.'); }
  if (row.attempts >= 5) { await db.from('hysacam_auth_challenges').delete().eq('id', row.id); throw new Error('Too many attempts. Request a new code.'); }
  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(otpHash(email, purpose, code), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const attempts = row.attempts + 1;
    await db.from('hysacam_auth_challenges').update({ attempts }).eq('id', row.id);
    throw new Error('The code is invalid or has expired.');
  }
  await db.from('hysacam_auth_challenges').delete().eq('id', row.id);
  return row;
}
export function setSessionCookie(req, res, value, maxAge = 7 * 24 * 60 * 60) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `hysacam_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
export function clearSessionCookie(req, res) { setSessionCookie(req, res, '', 0); }
export function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return decodeURIComponent(v.join('=')); }
  return null;
}
export async function createSession(userId, encryptedRefreshToken) {
  const db = adminClient(); const token = randomBytes(32).toString('base64url');
  const { error } = await db.from('hysacam_auth_sessions').insert({ session_hash: hash(token), user_id: userId, encrypted_refresh_token: encryptedRefreshToken, expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() });
  if (error) throw new Error('Could not create a secure session. Please sign in again.');
  return token;
}
export async function readSession(req) {
  const token = getCookie(req, 'hysacam_session'); if (!token) return null;
  const db = adminClient();
  const { data: row, error } = await db.from('hysacam_auth_sessions').select('*').eq('session_hash', hash(token)).maybeSingle();
  if (error || !row || new Date(row.expires_at).getTime() < Date.now()) return null;
  const client = anonClient();
  const { data, error: refreshError } = await client.auth.refreshSession({ refresh_token: decrypt(row.encrypted_refresh_token) });
  if (refreshError || !data.session || !data.user) { await db.from('hysacam_auth_sessions').delete().eq('session_hash', hash(token)); return null; }
  await db.from('hysacam_auth_sessions').update({ encrypted_refresh_token: encrypt(data.session.refresh_token), expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() }).eq('session_hash', hash(token));
  return { user: data.user, row, token };
}
export async function createSessionFromChallenge(row, req, res) {
  if (!row.encrypted_refresh_token) throw new Error('Your sign-in has expired. Please sign in again.');
  const token = await createSession(row.user_id, row.encrypted_refresh_token);
  setSessionCookie(req, res, token);
}
export function fail(res, error, status = 400) { res.status(status).json({ message: error?.message || 'We could not complete that request. Please try again.' }); }
