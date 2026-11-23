(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prefKey = 'hysacam-device-preferences-v1';
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem(prefKey) || '{}'); } catch { preferences = {}; }

  // ---- Bottom tab bar: one place for every page (Home, Map, Reports, Cleaning Records, Settings) ----
  (function buildTabbar() {
    const bar = document.querySelector('.app-tabbar');
    const page = location.pathname.split('/').pop() || 'index.html';
    if (page === 'cleaning.html') document.body.classList.add('is-cleaning');
    if (!bar) return;
    const icons = {
      home: '<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
      map: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
      reports: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>',
      cleaning: '<path d="M9 4h6v3H9zM7 5H5v16h14V5h-2"/><path d="m9 14 2 2 4-4"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    };
    const tabs = [
      ['index.html', 'Home', 'home', 'Home'],
      ['map.html', 'Map', 'map', 'Map'],
      ['report.html', 'Reports', 'reports', 'Reports'],
      ['cleaning.html', 'Cleaning', 'cleaning', 'Cleaning Records'],
      ['settings.html', 'Settings', 'settings', 'Settings']
    ];
    const current = page === 'profile.html' ? 'settings.html' : page;
    bar.innerHTML = tabs.map(([href, label, icon, full]) => {
      const on = href === current;
      return `<a href="${href}" aria-label="${full}"${on ? ' class="active" aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[icon]}</svg><span>${label}</span></a>`;
    }).join('');
  })();

  // ---- Cleaning Records page: no Sign In / Sign Up buttons inside the page ----
  (function cleanRecords() {
    if (!document.body.classList.contains('is-cleaning')) return;
    const strip = () => {
      document.querySelectorAll('main a[href*="signin"], main a[href*="signup"]').forEach(a => {
        const box = a.closest('.join-actions, .gate-actions, .menu-auth-row') || a;
        box.remove();
      });
    };
    strip();
    document.addEventListener('DOMContentLoaded', strip);
    const main = document.querySelector('main');
    if (main) new MutationObserver(strip).observe(main, {childList: true, subtree: true});
  })();

  function savePrefs() {
    preferences = {
      notifications: $('pref-notifications')?.checked ?? true,
      reduceMotion: $('pref-reduce-motion')?.checked ?? false,
      compact: $('pref-compact')?.checked ?? false
    };
    try { localStorage.setItem(prefKey, JSON.stringify(preferences)); } catch {}
    document.body.classList.toggle('reduce-motion', !!preferences.reduceMotion);
    document.body.classList.toggle('compact-layout', !!preferences.compact);
    const note = $('settings-save-message');
    if (note) note.textContent = 'Preferences saved on this device';
  }
  if ($('pref-notifications')) $('pref-notifications').checked = preferences.notifications !== false;
  if ($('pref-reduce-motion')) $('pref-reduce-motion').checked = !!preferences.reduceMotion;
  if ($('pref-compact')) $('pref-compact').checked = !!preferences.compact;
  ['pref-notifications','pref-reduce-motion','pref-compact'].forEach(id => $(id)?.addEventListener('change', savePrefs));
  document.body.classList.toggle('reduce-motion', !!preferences.reduceMotion);
  document.body.classList.toggle('compact-layout', !!preferences.compact);

  async function signOut(button) {
    if (button?.dataset.busy === '1') return;
    if (button) { button.dataset.busy = '1'; button.disabled = true; button.textContent = 'Signing out…'; }
    try {
      const response = await fetch('/api/auth/logout', {method:'POST',credentials:'include',headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error('Sign out failed');
      try { localStorage.removeItem('hysacam-auth-cache'); } catch {}
      window.Hys?.clearPrivate();
      location.replace('signin.html');
    } catch (error) {
      if (button) { button.disabled = false; button.dataset.busy = '0'; button.textContent = 'Sign Out'; }
      alert('Could not sign out. Please try again.');
    }
  }
  // ---- Account state: remembered between pages so signed-in users never see Sign In / Sign Up flash ----
  const CACHE = 'hysacam-auth-cache';
  const readCache = () => { try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.a === 1 ? c : null; } catch { return null; } };
  const writeCache = value => { try { value ? localStorage.setItem(CACHE, JSON.stringify(value)) : localStorage.removeItem(CACHE); } catch {} };
  const setAuthClass = state => { const r = document.documentElement; r.classList.remove('auth-yes','auth-no','auth-pending'); r.classList.add('auth-' + state); };
  const displayName = user => user?.name || user?.full_name || user?.email?.split('@')[0] || 'HYSACAM User';

  function paint(authenticated, user, role) {
    setAuthClass(authenticated ? 'yes' : 'no');
    document.body.classList.toggle('is-authenticated', authenticated);
    document.body.classList.toggle('is-visitor', !authenticated);
    const links = $('menu-links');
    const summary = $('menu-account-summary');
    if (links) {
      const authTop = authenticated ? '' : '<div class="menu-auth-row"><a class="menu-auth-link" href="signup.html">Sign Up</a><a class="menu-auth-link menu-signin" href="signin.html">Sign In</a></div>';
      links.innerHTML = `
        ${authTop}
        <a href="index.html"><span class="nav-item-icon">⌂</span>Home</a>
        <a href="map.html"><span class="nav-item-icon">⌖</span>Map</a>
        <a href="directory.html"><span class="nav-item-icon">☷</span>Directory</a>
        <a href="cleaning.html"><span class="nav-item-icon">✓</span>Cleaning Records</a>
        <a href="report.html"><span class="nav-item-icon">⚑</span>Report</a>
        <a href="settings.html"><span class="nav-item-icon">⚙</span>Settings</a>
        <button type="button" data-open-notifications><span class="nav-item-icon">▣</span>Notifications</button>
        ${authenticated ? '<button type="button" class="menu-signout" id="menu-signout"><span class="nav-item-icon">↪</span>Sign Out</button>' : ''}`;
      const here = (location.pathname.split('/').pop() || 'index.html');
      links.querySelectorAll('a[href]').forEach(l => { if (l.getAttribute('href') === here) l.setAttribute('aria-current','page'); });
      links.querySelector('#menu-signout')?.addEventListener('click', event => signOut(event.currentTarget));
      links.querySelectorAll('a').forEach(link => link.addEventListener('click', () => document.dispatchEvent(new Event('hysacam:close-menu'))));
    }
    if (summary) {
      summary.innerHTML = authenticated
        ? `<b>${safeText(displayName(user))}</b><small>${safeText(user?.email || 'Signed-in account')}</small>`
        : '<b>Welcome</b><small>Explore HYSACAM Kumba Tracker</small>';
    }
    const initials = n => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
    document.querySelectorAll('.avatar').forEach(a => { const t = authenticated ? initials(displayName(user)) : ''; a.dataset.initials = t; a.classList.toggle('has-initials', !!t); });
    const set = (id, value) => { if ($(id)) $(id).textContent = value; };
    if (authenticated && user) {
      const name = displayName(user), email = user.email || 'Email unavailable', r = role || 'Resident';
      [['settings-user-name',name],['profile-user-name',name],['settings-user-email',email],['profile-user-email',email],['settings-user-role',r],['profile-user-role',r]].forEach(([id,v]) => set(id,v));
    } else if (!authenticated) {
      ['settings-user-name','profile-user-name'].forEach(id => set(id,'Welcome to HYSACAM'));
      ['settings-user-email','profile-user-email'].forEach(id => set(id,'Sign in or create an account to manage your profile and reports'));
      ['settings-user-role','profile-user-role'].forEach(id => set(id,'Visitor'));
    }
  }

  async function loadAccount() {
    const cached = readCache();
    if (cached) paint(true, cached.user, cached.role);   // instant: no Sign In flash for signed-in users
    let authenticated = false, user = null, unknown = false;
    try {
      const response = await fetch('/api/auth/me', {credentials:'include', cache:'no-store', headers:{Accept:'application/json'}});
      if (response.ok) {
        const data = await response.json();
        authenticated = !!data.authenticated;
        user = data.user || data.profile || null;
      } else if (response.status !== 401) unknown = true;
    } catch (error) { unknown = true; console.warn('[HYSACAM] Session check unavailable', error); }
    if (unknown && cached) return;                        // network hiccup: keep what the user already sees
    if (!authenticated) { writeCache(null); window.Hys?.clearPrivate(); paint(false, null); document.dispatchEvent(new Event('hys:account')); return; }
    let role = cached?.role || 'Resident';
    paint(true, user, role);
    try {
      const adminResponse = await fetch('/api/admin/me', {credentials:'include', cache:'no-store', headers:{Accept:'application/json'}});
      if (adminResponse.ok) { const adminData = await adminResponse.json(); if (adminData.authenticated) role = adminData.role || 'administrator'; else role = 'Resident'; }
    } catch {}
    const hadEmail = readCache()?.user?.email || '';
    writeCache({a:1, user:{name:displayName(user), email:user?.email || ''}, role});
    paint(true, user, role);
    if (hadEmail.toLowerCase() !== (user?.email || '').toLowerCase()) document.dispatchEvent(new Event('hys:account'));
  }
  $('profile-signout')?.addEventListener('click', event => signOut(event.currentTarget));
  loadAccount();

  document.addEventListener('hysacam:close-menu',()=>{document.querySelector('#main-nav')?.classList.remove('open');document.body.classList.remove('nav-open');document.querySelector('#menu-toggle')?.setAttribute('aria-expanded','false');document.querySelector('#nav-backdrop')?.classList.remove('open');});
  document.querySelectorAll('[data-open-settings]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#main-nav')?.classList.remove('open');document.body.classList.remove('nav-open');}));

  // Hamburger menu: open, close, backdrop, Escape key and link taps
  (function(){
    const toggle=$('menu-toggle'),nav=$('main-nav'),backdrop=$('nav-backdrop'),closeBtn=$('menu-close');
    if(!toggle||!nav)return;
    const setOpen=open=>{
      nav.classList.toggle('open',open);
      backdrop?.classList.toggle('open',open);
      document.body.classList.toggle('nav-open',open);
      toggle.setAttribute('aria-expanded',String(open));
    };
    toggle.addEventListener('click',e=>{e.stopPropagation();setOpen(!nav.classList.contains('open'));});
    closeBtn?.addEventListener('click',()=>setOpen(false));
    backdrop?.addEventListener('click',()=>setOpen(false));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
    nav.addEventListener('click',e=>{if(e.target.closest('a[href]'))setOpen(false);});
    document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target)&&!toggle.contains(e.target))setOpen(false);});
    document.addEventListener('click',e=>{if(e.target.closest('[data-open-notifications]'))setOpen(false);});
  })();
})();
