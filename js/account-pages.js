/* Profile + Settings behaviour: edit profile, clear device data */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const CACHE = 'hysacam-auth-cache';
  const readCache = () => { try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.a === 1 ? c : null; } catch { return null; } };
  const initials = n => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };

  const form = $('profile-form');
  if (form) {
    const msg = (text, ok = false) => { const el = $('pf-msg'); if (el) { el.textContent = text; el.className = 'auth-message' + (ok ? ' success' : ''); } };
    const fill = u => {
      if (!u) return;
      if (u.name != null && document.activeElement !== $('pf-name')) $('pf-name').value = u.name || '';
      if (u.email) $('pf-email').value = u.email;
      if (u.phone != null && document.activeElement !== $('pf-phone')) $('pf-phone').value = u.phone || '';
      if (u.created_at && $('pf-since')) $('pf-since').textContent = new Date(u.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };
    fill(readCache()?.user);
    const role = readCache()?.role;
    if (role && $('pf-role')) $('pf-role').textContent = role.charAt(0).toUpperCase() + role.slice(1);
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.authenticated) fill(d.user); }).catch(() => {});

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const name = $('pf-name').value.replace(/\s+/g, ' ').trim();
      const phone = $('pf-phone').value.trim();
      if (name.length < 2) { msg('Enter your full name'); $('pf-name').focus(); return; }
      if (phone && !/^[+\d\s().-]{6,25}$/.test(phone)) { msg('Enter a valid phone number or leave it empty'); $('pf-phone').focus(); return; }
      const button = $('pf-save'); button.disabled = true; button.textContent = 'Saving…'; msg('');
      try {
        const response = await fetch('/api/auth/profile', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, phone }) });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) { location.href = 'signin.html?next=profile.html'; return; }
        if (!response.ok) throw new Error(data.message || 'Could not save your changes. Please try again');
        const cache = readCache();
        if (cache) { cache.user = { ...(cache.user || {}), name }; try { localStorage.setItem(CACHE, JSON.stringify(cache)); } catch {} }
        ['profile-user-name', 'settings-user-name'].forEach(id => { if ($(id)) $(id).textContent = name; });
        document.querySelectorAll('.avatar').forEach(a => { a.dataset.initials = initials(name); a.classList.add('has-initials'); });
        const sum = document.querySelector('#menu-account-summary b'); if (sum) sum.textContent = name;
        msg('Profile saved', true);
      } catch (error) {
        msg(/fetch|network/i.test(error.message) ? 'No internet connection. Please try again' : error.message);
      } finally { button.disabled = false; button.textContent = 'Save changes'; }
    });
  }

  $('clear-local-data')?.addEventListener('click', () => {
    if (!confirm('Clear cached reports and read updates on this device? You will stay signed in.')) return;
    try { window.Hys?.clearPrivate?.(); } catch {}
    ['hysacam-notif-read-v1', 'hysacam-notif-cache-v1', 'hysacam-reports-cache-v1'].forEach(k => { try { localStorage.removeItem(k); } catch {} });
    const el = $('clear-data-message'); if (el) el.textContent = 'Saved data on this device was cleared';
  });
})();
