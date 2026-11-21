(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prefKey = 'hysacam-device-preferences-v1';
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem(prefKey) || '{}'); } catch { preferences = {}; }
  const panel = $('notification-panel');
  const list = $('notification-list');
  const setNoticeOpen = (open) => { if (panel) panel.hidden = !open; };
  $('notification-close')?.addEventListener('click', () => setNoticeOpen(false));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setNoticeOpen(false); });
  document.addEventListener('click', (event) => {
    if (panel && !panel.hidden && !panel.contains(event.target) && !event.target.closest('[data-open-notifications]')) setNoticeOpen(false);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-notifications]')) { event.preventDefault(); setNoticeOpen(panel?.hidden ?? true); }
  });

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
      location.replace('signin.html');
    } catch (error) {
      if (button) { button.disabled = false; button.dataset.busy = '0'; button.textContent = 'Sign Out'; }
      alert('Could not sign out. Please try again.');
    }
  }
  async function loadAccount() {
    const links = $('menu-links');
    const summary = $('menu-account-summary');
    let authenticated = false, user = null;
    try {
      const response = await fetch('/api/auth/me', {credentials:'include', cache:'no-store', headers:{Accept:'application/json'}});
      if (response.ok) {
        const data = await response.json();
        authenticated = !!data.authenticated;
        user = data.user || data.profile || null;
      }
    } catch (error) { console.warn('[HYSACAM] Session check unavailable', error); }
    // The public header has a single horizontal link row only for visitors.
    // Signed-in users keep the brand and hamburger; account actions live in the drawer.
    document.body.classList.toggle('is-authenticated', authenticated);
    document.body.classList.toggle('is-visitor', !authenticated);
    const publicNav = $('public-nav');
    if (publicNav) publicNav.hidden = authenticated;
    if (links) {
      links.innerHTML = `
        <a href="#home"><span class="nav-item-icon">⌂</span>Home</a>
        <a href="#map"><span class="nav-item-icon">⌖</span>Map</a>
        <a href="#profile"><span class="nav-item-icon">●</span>Profile</a>
        <button type="button" data-open-notifications><span class="nav-item-icon">▣</span>Notifications</button>
        ${authenticated
          ? '<button type="button" class="menu-signout" id="menu-signout"><span class="nav-item-icon">↪</span>Sign Out</button>'
          : '<a class="menu-auth-link" href="signup.html"><span class="nav-item-icon">＋</span>Sign Up</a><a class="menu-auth-link menu-signin" href="signin.html"><span class="nav-item-icon">→</span>Sign In</a>'}`;
      links.querySelector('#menu-signout')?.addEventListener('click', event => signOut(event.currentTarget));
      links.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>document.dispatchEvent(new Event('hysacam:close-menu'))));
    }
    if (summary) {
      if (authenticated) {
        const name = user?.name || user?.full_name || user?.email?.split('@')[0] || 'Signed-in user';
        summary.innerHTML = `<b>${safeText(name)}</b><small>${safeText(user?.email || 'Signed-in account')}</small>`;
      } else summary.innerHTML = '<b>Welcome</b><small>Explore HYSACAM Kumba Tracker</small>';
    }
    if (authenticated && user) {
      const name = user.name || user.full_name || user.email?.split('@')[0] || 'HYSACAM User';
      const email = user.email || 'Email unavailable';
      let role = 'Signed-in account';
      try { const adminResponse = await fetch('/api/admin/me', {credentials:'include',cache:'no-store',headers:{Accept:'application/json'}}); if (adminResponse.ok) { const adminData = await adminResponse.json(); if (adminData.authenticated) role = adminData.role || 'administrator'; } } catch {}
      [['settings-user-name',name],['profile-user-name',name],['settings-user-email',email],['profile-user-email',email],['settings-user-role',role],['profile-user-role',role]].forEach(([id,value])=>{if($(id))$(id).textContent=value;});
    } else {
      ['settings-user-name','profile-user-name'].forEach(id=>{if($(id))$(id).textContent='Sign in to view your profile';});
      ['settings-user-email','profile-user-email'].forEach(id=>{if($(id))$(id).textContent='Your account details will appear here after sign-in';});
    }
  }
  $('profile-signout')?.addEventListener('click', event => signOut(event.currentTarget));
  loadAccount();

  async function loadNotifications() {
    if (!list) return;
    if (preferences.notifications === false) {
      list.innerHTML = '<p class="notification-empty">In-app notifications are turned off in Settings</p>';
      return;
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
    list.innerHTML = recent.length ? recent.map(item=>`<article class="notification-item"><b>${safeText(item.title)}</b><p>${safeText(item.message)}</p><time>${item.time && !Number.isNaN(new Date(item.time).getTime()) ? safeText(new Date(item.time).toLocaleString()) : 'Recently updated'}</time></article>`).join('') : '<p class="notification-empty">No new report or verified cleaning updates are available yet</p>';
  }
  loadNotifications();

  document.addEventListener('hysacam:close-menu',()=>{document.querySelector('#main-nav')?.classList.remove('open');document.body.classList.remove('nav-open');document.querySelector('#menu-toggle')?.setAttribute('aria-expanded','false');document.querySelector('#nav-backdrop')?.classList.remove('open');});
  document.querySelectorAll('[data-open-settings]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#main-nav')?.classList.remove('open');document.body.classList.remove('nav-open');}));
})();
