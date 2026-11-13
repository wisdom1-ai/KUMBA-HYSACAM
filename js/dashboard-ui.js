"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const main = document.querySelector("main");
  if (!main) return;
  // Keep the existing page sections and their database-backed IDs intact.
  const nav = document.createElement("nav");
  nav.className = "bottom-nav"; nav.setAttribute("aria-label", "Main navigation");
  nav.innerHTML = `<a href="#home" data-tab="home"><span>⌂</span><b>Home</b></a><a href="#map" data-tab="map"><span>♧</span><b>Map</b></a><a href="#report" data-tab="report"><span>▤</span><b>Reports</b></a><a href="#settings" data-tab="settings"><span>⚙</span><b>Settings</b></a><a href="#profile" data-tab="profile"><span>●</span><b>Profile</b></a>`;
  document.body.append(nav);
  const settings = document.createElement("section"); settings.id="settings"; settings.className="page-section app-extra-page"; settings.innerHTML=`<div class="section-head"><div><span class="eyebrow">PREFERENCES & SECURITY</span><h2>Settings</h2><p>Manage your account and application preferences</p></div></div><div class="settings-profile-card"><span class="settings-avatar">●</span><div><b id="settings-user-name">Guest User</b><small id="settings-user-email">Sign in to view account details</small><span class="role-pill">Resident account</span></div></div><div class="settings-list"><a class="settings-item" href="signin.html"><span class="settings-icon">♙</span><span><b>Account Settings</b><small>Manage your account information</small></span><span>›</span></a><button class="settings-item" id="settings-notifications"><span class="settings-icon">♟</span><span><b>Notifications</b><small>Manage notification preferences</small></span><span>›</span></button><button class="settings-item" id="settings-privacy"><span class="settings-icon">♢</span><span><b>Privacy & Security</b><small>Review your account security</small></span><span>›</span></button><button class="settings-item" id="settings-appearance"><span class="settings-icon">⚙</span><span><b>App Preferences</b><small>Appearance and display options</small></span><span>›</span></button><a class="settings-item" href="#about"><span class="settings-icon">ⓘ</span><span><b>About HYSACAM</b><small>Platform information</small></span><span>›</span></a></div><button id="settings-signout" class="signout-button" hidden>↪ Sign Out</button><div class="settings-footer"><span class="footer-recycle">♻</span><b>HYSACAM Kumba Tracker</b><p>Cleaner City. Healthier Community.</p><small>© 2026 HYSACAM. All rights reserved</small></div>`;
  const profile = document.createElement("section"); profile.id="profile"; profile.className="page-section app-extra-page"; profile.innerHTML=`<div class="section-head"><div><span class="eyebrow">YOUR ACCOUNT</span><h2>Profile</h2><p>Manage your HYSACAM Tracker account</p></div></div><div class="profile-card"><span class="profile-avatar">●</span><h2 id="profile-user-name">Guest User</h2><p id="profile-user-email">Not signed in</p><span class="role-pill">Resident</span></div><div class="settings-list"><a class="settings-item" href="signin.html"><span class="settings-icon">♙</span><span><b>Sign In / Account Access</b><small>Access your resident account</small></span><span>›</span></a><a class="settings-item" href="#report"><span class="settings-icon">▤</span><span><b>My Reports</b><small>Track submitted reports</small></span><span>›</span></a><a class="settings-item" href="#settings"><span class="settings-icon">⚙</span><span><b>Settings</b><small>Manage app preferences</small></span><span>›</span></a></div><button id="profile-signout" class="signout-button" hidden>↪ Sign Out</button>`;
  main.append(settings, profile);
  // Header account controls and notification tray.
  const header=document.querySelector(".topbar");
  if(header){
    const brand=header.querySelector(".brand"); if(brand){brand.innerHTML=`<span class="brand-symbol">♻</span><span class="brand-wordmark"><b>HYSACAM</b><small>Kumba Tracker</small></span>`;}
    const actions=document.createElement("div"); actions.className="dashboard-header-actions"; actions.innerHTML=`<button id="notification-toggle" class="header-icon-button" aria-label="Notifications" type="button">♟<span id="notification-count" hidden>0</span></button>`;
    header.append(actions);
    const panel=document.createElement("div");panel.id="notification-panel";panel.className="notification-panel";panel.hidden=true;panel.innerHTML=`<div class="notification-head"><b>Notifications</b></div><p class="notification-empty">No new notifications</p>`;header.append(panel);
    const toggle=$('notification-toggle');toggle?.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});
  }
  // Replace the old hamburger navigation with a compact account/menu panel.
  const menu=$('main-nav'); if(menu){menu.innerHTML=`<div class="mobile-nav-head"><b>HYSACAM Kumba Tracker</b><button id="menu-close" type="button" aria-label="Close menu">×</button></div><a href="#home">⌂ <span>Home</span></a><a href="#map">♧ <span>Dustbin Map</span></a><a href="#directory">▤ <span>Dustbin Directory</span></a><a href="#cleaning">☷ <span>Cleaning Records</span></a><a href="#report">＋ <span>Submit a Report</span></a><a href="#settings">⚙ <span>Settings</span></a><a href="#profile">● <span>Profile</span></a><a href="#about">ⓘ <span>About HYSACAM</span></a>`;menu.classList.add('dashboard-menu');}
  const menuBtn=$('menu-toggle');menuBtn?.addEventListener('click',()=>{menu?.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(menu?.classList.contains('open')));});
  $('menu-close')?.addEventListener('click',()=>menu?.classList.remove('open'));
  // Route visibility: keep every existing section and its original IDs available.
  const routeSections=[...main.querySelectorAll('section[id]')];
  function route(){const raw=(location.hash||'#home').slice(1);let target=raw==='map'?'map':raw;const mapSection=document.getElementById('map');
    routeSections.forEach(s=>{s.classList.toggle('route-hidden',!['home','map','report','directory','cleaning','details','about','settings','profile'].includes(target)?false:(target==='home'?!(s.id==='home'||s.id==='home-services'||s.id==='map'||s.id==='home-recent-reports'):target==='map'?s.id!=='map':s.id!==target));});
    // Sections that belong to a selected page remain accessible via the original navigation/menu.
    if(!document.getElementById(target) && target!=='map') {routeSections.forEach(s=>s.classList.remove('route-hidden'));}
    if(target==='map' && mapSection){mapSection.classList.remove('route-hidden');setTimeout(()=>window.dispatchEvent(new Event('resize')),100);}
    nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active',a.dataset.tab===target));
    menu?.classList.remove('open');
    window.scrollTo({top:0,behavior:'instant'});
  }
  window.addEventListener('hashchange',route); route();
  nav.addEventListener('click',e=>{const a=e.target.closest('a');if(a){nav.querySelectorAll('a').forEach(x=>x.classList.toggle('active',x===a));}});
  // Mirror existing search input to the actual map search field created by map.js.
  $('location-search')?.addEventListener('submit',()=>{});
  $('settings-notifications')?.addEventListener('click',()=>{const panel=$('notification-panel');if(panel){panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'nearest'});}});
  $('settings-privacy')?.addEventListener('click',()=>alert('Your sign-in and account security are managed through the connected HYSACAM authentication service.'));
  $('settings-appearance')?.addEventListener('click',()=>{document.body.classList.toggle('comfortable-view');localStorage.setItem('hysacam-comfortable-view',document.body.classList.contains('comfortable-view')?'on':'off');});
  if(localStorage.getItem('hysacam-comfortable-view')==='on')document.body.classList.add('comfortable-view');
  async function loadRecentReports(){const host=$('home-recent-report-list');if(!host)return;try{const r=await fetch('/api/reports',{credentials:'include',cache:'no-store'});if(!r.ok)throw new Error('Sign in to see your submitted reports');const d=await r.json();const items=(d.reports||[]).slice(0,3);host.innerHTML=items.length?items.map(x=>`<article class="recent-report-card"><span class="recent-report-check">✓</span><div><b>${String(x.reference_code||'Report')}</b><small>${new Date(x.created_at).toLocaleString()}</small></div><span class="recent-report-status">${String(x.status||'Submitted').replaceAll('_',' ')}</span></article>`).join(''):'<p class="empty-state compact">No reports have been submitted yet</p>';}catch(e){host.innerHTML='<p class="empty-state compact">Sign in to view your submitted reports</p>';}}
  loadRecentReports();
  async function loadAccount(){try{const r=await fetch('/api/auth/me',{credentials:'include',cache:'no-store'});const d=await r.json();if(!r.ok||!d.authenticated)return;const u=d.user||d.profile||{};const name=u.full_name||u.name||u.email||'Resident';const email=u.email||'';['settings-user-name','profile-user-name'].forEach(id=>{if($(id))$(id).textContent=name;});['settings-user-email','profile-user-email'].forEach(id=>{if($(id))$(id).textContent=email;});['settings-signout','profile-signout'].forEach(id=>{if($(id))$(id).hidden=false;});}catch(e){console.info('Account details are not available while signed out');}}
  async function signOut(){try{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}});if(!r.ok)throw new Error('Sign out failed');location.href='signin.html';}catch(e){alert('Unable to sign out right now. Please try again.');}}
  ['settings-signout','profile-signout'].forEach(id=>$(id)?.addEventListener('click',signOut));loadAccount();
});
