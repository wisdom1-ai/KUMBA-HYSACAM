import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readSession } from './auth/_lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end('Method not allowed'); }
  try {
    const session = await readSession(req);
    if (!session) { res.setHeader('Cache-Control', 'no-store'); res.writeHead(302, { Location: '/signin.html' }); return res.end(); }
    const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(html);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send('Dashboard temporarily unavailable. Please try again.');
  }
}
