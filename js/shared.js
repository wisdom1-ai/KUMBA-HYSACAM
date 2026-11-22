/* HYSACAM shared helpers: instant (cached) report data, toasts, time formatting.
   Loaded before reports.js and app-shell.js so data requests start immediately,
   without waiting for the map / database libraries. */
(() => {
  'use strict';
  if (window.Hys) return;

  const AUTH_KEY = 'hysacam-auth-cache';
  const REPORTS_KEY = 'hysacam-reports-cache-v1';
  const FRESH_MS = 15000; // reuse a result this young instead of calling the server again

  const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const write = (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {} };

  const authCache = () => { const c = read(AUTH_KEY); return c && c.a === 1 ? c : null; };
  const userKey = () => (authCache()?.user?.email || '').toLowerCase();

  /* ---------- Reports: show the last known list at once, refresh quietly ---------- */
  let inflight = null;
  const lastSaved = () => (read(REPORTS_KEY) || {}).at || 0;

  function cachedReports() {
    const auth = authCache();
    const c = read(REPORTS_KEY);
    if (!auth || !c || !Array.isArray(c.reports)) return undefined;
    // Only trust the cache for the same account that saved it
    if (c.user && auth.user?.email && c.user !== auth.user.email.toLowerCase()) return undefined;
    return c.reports;
  }

  function reports({ force = false } = {}) {
    if (inflight) return inflight;
    if (!force && Date.now() - lastSaved() < FRESH_MS) {
      const hit = cachedReports();
      if (hit) return Promise.resolve(hit);
    }
    inflight = fetch('/api/reports', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (response.status === 401) { write(REPORTS_KEY, null); return null; }      // visitor
        if (!response.ok) throw new Error('Reports unavailable');
        const data = await response.json();
        const list = Array.isArray(data.reports) ? data.reports : [];
        saveReports(list);
        return list;
      })
      .catch(() => { const hit = cachedReports(); return hit === undefined ? undefined : hit; }) // offline: keep what we have
      .finally(() => { inflight = null; });
    return inflight;
  }

  function saveReports(list) {
    write(REPORTS_KEY, { user: userKey(), at: Date.now(), reports: list });
    document.dispatchEvent(new CustomEvent('hys:reports', { detail: list }));
  }

  function clearPrivate() { write(REPORTS_KEY, null); write('hysacam-notif-cache-v1', null); }

  /* ---------- Time ---------- */
  const valid = (x) => x && !Number.isNaN(new Date(x).getTime());
  function ago(x) {
    if (!valid(x)) return 'Recently';
    const s = Math.max(0, (Date.now() - new Date(x).getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 604800) return Math.floor(s / 86400) + ' day' + (s >= 172800 ? 's' : '') + ' ago';
    return new Date(x).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function full(x) {
    if (!valid(x)) return 'Not available';
    const d = new Date(x);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ' • ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- Toast ---------- */
  function toast(message, kind) {
    let host = document.getElementById('hys-toast');
    if (!host) {
      host = document.createElement('div');
      host.id = 'hys-toast';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    host.textContent = message;
    host.className = 'is-visible' + (kind ? ' ' + kind : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { host.className = ''; }, 3200);
  }

  window.Hys = { read, write, authCache, userKey, reports, cachedReports, saveReports, clearPrivate, ago, full, valid, toast };
})();
