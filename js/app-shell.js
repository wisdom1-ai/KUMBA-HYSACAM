(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prefKey = 'hysacam-device-preferences-v1';
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem(prefKey) || '{}'); } catch { preferences = {}; }
  const panel = $('notification-panel');
  const toggle = $('notification-toggle');
  const count = $('notification-count');
  const list = $('notification-list');
  const setNoticeOpen = (open) => {
    if (!panel || !toggle) return;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle?.addEventListener('click', () => setNoticeOpen(panel.hidden));
  $('notification-close')?.addEventListener('click', () => setNoticeOpen(false));
  document.addEventListener('click', (event) => {
    if (panel && !panel.hidden && !panel.contains(event.target) && !toggle?.contains(event.target)) setNoticeOpen(false);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setNoticeOpen(false); });

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

  async function loadAccount() {
    try {
      const response = await fetch('/api/auth/me', {credentials:'include', cache:'no-store', headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error('Could not load account details');
      const data = await response.json();
      const user = data.user || data.profile || data;
      const name = user.name || user.full_name || user.email?.split('@')[0] || 'HYSACAM User';
      const email = user.email || 'Email unavailable';
      let role = user.role || 'Signed-in account';
      try { const adminResponse = await fetch('/api/admin/me', {credentials:'include',cache:'no-store',headers:{Accept:'application/json'}}); if (adminResponse.ok) { const adminData = await adminResponse.json(); if (adminData.authenticated) role = adminData.role || 'administrator'; } } catch {}
      [['settings-user-name',name],['profile-user-name',name],['settings-user-email',email],['profile-user-email',email],['settings-user-role',role],['profile-user-role',role]].forEach(([id,value])=>{if($(id))$(id).textContent=value;});
    } catch (error) {
      ['settings-user-name','profile-user-name'].forEach(id=>{if($(id))$(id).textContent='Account details unavailable';});
      ['settings-user-email','profile-user-email'].forEach(id=>{if($(id))$(id).textContent='Please sign in again if this continues';});
      console.warn('[HYSACAM] Account details could not be loaded', error);
    }
  }
  loadAccount();

  async function signOut(button) {
    if (button.dataset.busy === '1') return;
    button.dataset.busy = '1'; button.disabled = true;
    const original = button.textContent; button.textContent = 'Signing out…';
    try {
      const response = await fetch('/api/auth/logout', {method:'POST',credentials:'include',headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error('Sign out failed');
      location.replace('signin.html');
    } catch (error) {
      button.disabled = false; button.dataset.busy = '0'; button.textContent = original;
      alert('Could not sign out. Please try again.');
    }
  }
  $('profile-signout')?.addEventListener('click', event => signOut(event.currentTarget));

  async function loadNotifications() {
    if (!list) return;
    if (preferences.notifications === false) {
      list.innerHTML = '<p class="notification-empty">In-app notifications are turned off in Settings</p>';
      count.hidden = true; return;
    }
    const items = [];
    try {
      const response = await fetch('/api/reports', {credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
      if (response.ok) {
        const data = await response.json();
        (data.reports || []).slice(0,5).forEach(report => items.push({title:`Report ${report.reference_code || ''}`.trim(), message:`${report.issue_type || 'Waste issue'} · ${report.status || 'Submitted'}`, time:report.created_at}));
      }
    } catch (error) { console.warn('[HYSACAM] Report notifications unavailable', error); }
    try {
      if (window.supabaseClient) {
        const {data,error} = await window.supabaseClient.from('cleaning_records').select('id,area,activity,status,cleaned_at').eq('verified',true).order('cleaned_at',{ascending:false}).limit(4);
        if (!error) (data || []).forEach(record => items.push({title:'Verified cleaning update',message:`${record.activity || 'Cleaning'} · ${record.area || 'Kumba'} · ${record.status || 'Recorded'}`,time:record.cleaned_at}));
      }
    } catch (error) { console.warn('[HYSACAM] Cleaning notifications unavailable', error); }
    items.sort((a,b)=>new Date(b.time || 0)-new Date(a.time || 0));
    const recent = items.slice(0,7);
    count.textContent = String(recent.length); count.hidden = !recent.length;
    list.innerHTML = recent.length ? recent.map(item=>`<article class="notification-item"><b>${safeText(item.title)}</b><p>${safeText(item.message)}</p><time>${item.time && !Number.isNaN(new Date(item.time).getTime()) ? safeText(new Date(item.time).toLocaleString()) : 'Recently updated'}</time></article>`).join('') : '<p class="notification-empty">No new report or verified cleaning updates are available yet</p>';
  }
  loadNotifications();

  const nav = document.querySelector('.mobile-bottom-nav');
  function updateActiveNav() {
    const hash = location.hash || '#home';
    nav?.querySelectorAll('a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===hash || (hash==='#directory' && a.getAttribute('href')==='#map')));
  }
  window.addEventListener('hashchange', updateActiveNav); updateActiveNav();
  nav?.addEventListener('click', event => { const link=event.target.closest('a'); if(link){ nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active',a===link)); }});
  document.querySelectorAll('[data-open-settings]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#main-nav')?.classList.remove('open');document.body.classList.remove('nav-open');}));
})();
