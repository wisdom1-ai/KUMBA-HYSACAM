import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { createHash, createHmac, randomBytes, randomInt, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const APP_ORIGIN = process.env.APP_ORIGIN;
const ENC_KEY = process.env.SESSION_ENCRYPTION_KEY;

export function adminClient() {
  if (!URL || !SERVICE) {
    console.error('[HYSACAM auth] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Server configuration is incomplete.');
  }
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient() {
  if (!URL || !ANON) {
    console.error('[HYSACAM auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    throw new Error('Server configuration is incomplete.');
  }
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.method === 'GET';
  const allowed = [APP_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean);
  return allowed.includes(origin);
}

export function guard(req, res) {
  if (!allowedOrigin(req)) {
    res.status(403).json({ message: 'Request not allowed.' });
    return false;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  return true;
}

export function method(req, res, expected) {
  if (req.method !== expected) {
    res.setHeader('Allow', expected);
    res.status(405).json({ message: 'Method not allowed.' });
    return false;
  }
  return true;
}

export function jsonBody(req) {
  return req.body && typeof req.body === 'object' ? req.body : {};
}

export function normalEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function encryptionKey() {
  if (!ENC_KEY) {
    console.error('[HYSACAM auth] SESSION_ENCRYPTION_KEY is missing');
    throw new Error('Session encryption is not configured.');
  }
  const key = Buffer.from(ENC_KEY, 'hex');
  if (key.length !== 32) {
    console.error('[HYSACAM auth] SESSION_ENCRYPTION_KEY must be 64 hexadecimal characters');
    throw new Error('Session encryption configuration is invalid.');
  }
  return key;
}

export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
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
  if (!ENC_KEY) {
    console.error('[HYSACAM auth] SESSION_ENCRYPTION_KEY is missing for OTP signing');
    throw new Error('OTP signing is not configured.');
  }
  return createHmac('sha256', encryptionKey()).update(${email}|${purpose}|${code}).digest('hex');
}

export async function consumeLimit(key, max, seconds) {
  const db = adminClient();
  const { data…