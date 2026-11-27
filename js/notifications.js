/* HYSACAM notifications
   - Read state survives sign-out / sign-in, "Clear saved data" and other devices
     (saved on this device AND in Supabase table notification_reads, see notification_reads.sql).
   - Unread badge, All / Unread filter, day groups, tap to read, mark all as read.
   - Live: checks for new updates every minute and when the app comes back to the foreground,
     then shows a toast (and a browser alert if the person allowed them and the app is in the background).
   Visitors never get a badge or updates; they see a Sign In / Sign Up prompt. */
(() => {
  'use strict';
  const H = window.Hys;
  const panel = document.getElementById('notification-panel');
  if (!H || !panel) return;

  /* "hysacam-pref-" keys are kept by Clear saved data, so read marks are not wiped by it */
  const READ_KEY = 'hysacam-pref-notif-read-v2';
  const OLD_READ_KEY = 'hysacam-notif-read-v1';
  const CACHE_KEY = 'hysacam-notif-cache-v1';
  const PREF_KEY = 'hysacam-device-preferences-v1';
  const TABLE = 'notification_reads';
  const MAX_REPORTS = 8, MAX_CLEANING = 3, MAX_TOTAL = 10, MAX_READ_IDS = 400, POLL_MS = 60000;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const signedIn = () => !!H.authCache();
  const enabled = () => signedIn() && (H.read(PREF_KEY) || {}).notifications !== false;
  const scope = () => H.userKey() || 'visitor';

  const ICON = {
    report: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/></svg>',
    cleaning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6v3H9zM7 5H5v16h14V5h-2"/><path d="m9 14 2 2 4-4"/></svg>',
    chev: '<svg class="n-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>'
  };

  const REPORT_TEXT = {
    submitted:   ['Report received', 'Your report has been received by the HYSACAM team'],
    under_review:['Report under review', 'Our team is reviewing your report'],
    assigned:    ['Report assigned', 'A crew has been assigned to your report'],
    in_progress: ['Work in progress', 'A crew is working on the issue you reported'],
    resolved:    ['Report resolved', 'The issue you reported has been resolved'],
    rejected:    ['Report closed', 'Your report has been closed by the team']
  };
  const STATUS_LABEL = { submitted: 'Submitted', under_review: 'In Review', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', rejected: 'Closed' };

  /* ---------- read / unread ---------- */
  let serverReads = new Set();      // ids known to be saved on the server for this account
  let serverOk = true;              // false once the table is found missing, so we stop trying

  function readIds() {
    const set = new Set(((H.read(READ_KEY) || {})[scope()]) || []);
    ((H.read(OLD_READ_KEY) || {})[scope()] || []).forEach(id => set.add(id));   // older versions
    serverReads.forEach(id => set.add(id));
    return set;
  }
  function saveLocal(set) {
    const all = H.read(READ_KEY) || {};
    all[scope()] = [...set].slice(-MAX_READ_IDS);
    H.write(READ_KEY, all);
  }
  function markRead(ids) {
    const set = readIds();
    const fresh = ids.filter(id => !set.has(id));
    ids.forEach(id => set.add(id));
    saveLocal(set);
    if (fresh.length) pushReads(fresh);
  }
  const isUnread = (item) => !readIds().has(item.id);

  let client = null;
  function whenDatabase() {
    if (client) return Promise.resolve(client);
    return new Promise((resolve) => {
      const check = () => window.supabaseClient || null;
      if (check()) return resolve((client = check()));
      let tries = 0;
      const wait = () => { const c = check(); if (c || ++tries > 40) resolve((client = c)); else setTimeout(wait, 150); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait, { once: true }); else wait();
    });
  }
  function tableMissing(error) { return error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '')); }

  async function pushReads(ids) {
    if (!serverOk || !signedIn() || !ids.length) return;
    const c = await whenDatabase();
    if (!c) return;
    try {
      const { error } = await c.from(TABLE).upsert(ids.map(item_id => ({ item_id })), { onConflict: 'user_id,item_id', ignoreDuplicates: true });
      if (error) { if (tableMissing(error)) { serverOk = false; console.info('[HYSACAM] notification_reads table not found; read marks stay on this device'); } return; }
      ids.forEach(id => serverReads.add(id));
    } catch (e) { /* offline: syncReads retries later */ }
  }
  /* Pull what the server knows, push what only this device knows */
  async function syncReads() {
    if (!serverOk || !signedIn()) return;
    const c = await whenDatabase();
    if (!c || !signedIn()) return;
    try {
      const { data, error } = await c.from(TABLE).select('item_id').order('read_at', { ascending: false }).limit(500);
      if (error) { if (tableMissing(error)) serverOk = false; return; }
      serverReads = new Set((data || []).map(r => r.item_id));
      const local = new Set(((H.read(READ_KEY) || {})[scope()]) || []);
      const missing = [...local].filter(id => !serverReads.has(id));
      if (missing.length) await pushReads(missing);
      saveLocal(readIds());
      render();
    } catch (e) { /* offline */ }
  }

  /* ---------- items ---------- */
  const parts = { report: [], cleaning: [] };
  let items = [];
  let view = 'list';          // 'list' | 'detail'
  let filter = 'all';         // 'all' | 'unread'
  let lastTrigger = null;
  let known = new Set();      // ids already seen, so only truly new updates are announced
  let primed = false;

  function merge() {
    items = [...parts.report, ...parts.cleaning]
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
      .slice(0, MAX_TOTAL);
    if (signedIn()) H.write(CACHE_KEY, { scope: scope(), items });
  }

  function reportItems(list) {
    return (list || []).slice(0, MAX_REPORTS).map(r => {
      const text = REPORT_TEXT[r.status] || REPORT_TEXT.submitted;
      const rows = [
        ['Reference', r.reference_code], ['Status', STATUS_LABEL[r.status] || r.status], ['Issue', r.issue_type],
        ['Area', r.area], ['Location', r.location_description], ['Description', r.description],
        ['Submitted', H.full(r.created_at)], ['Last update', H.valid(r.updated_at) ? H.full(r.updated_at) : '']
      ].filter(([, v]) => v);
      return {
        id: `r:${r.id}:${r.status}`, kind: 'report',
        title: text[0], message: `${r.reference_code || 'Report'} · ${r.issue_type || 'Waste issue'}`,
        summary: text[1], time: r.updated_at || r.created_at, rows,
        note: r.admin_notes || '', href: `report.html#${encodeURIComponent(r.reference_code || '')}`, cta: 'Open report'
      };
    });
  }
  function cleaningItems(list) {
    return (list || []).map(c => ({
      id: `c:${c.id}`, kind: 'cleaning',
      title: 'Verified cleaning update', message: `${c.activity || 'Cleaning'} · ${c.area || 'Kumba'}`,
      summary: 'HYSACAM staff recorded a verified cleaning activity',
      time: c.cleaned_at,
      rows: [['Activity', c.activity || 'Cleaning'], ['Area', c.area || 'Kumba'], ['Status', c.status || 'Recorded'], ['Completed', H.full(c.cleaned_at)]].filter(([, v]) => v),
      note: c.notes || '', href: 'cleaning.html', cta: 'View records'
    }));
  }

  /* ---------- new update announcements ---------- */
  function announceNew() {
    if (!primed) { primed = true; items.forEach(i => known.add(i.id)); return; }
    const fresh = items.filter(i => !known.has(i.id) && isUnread(i));
    items.forEach(i => known.add(i.id));
    if (!fresh.length || !enabled()) return;
    const first = fresh[0];
    const text = fresh.length === 1 ? first.title : `${fresh.length} new updates`;
    if (typeof H.toast === 'function') { try { H.toast(text, 'ok'); } catch (e) {} }
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(first.title, { body: fresh.length === 1 ? first.message : 'Open HYSACAM Kumba Tracker to read them', icon: 'images/hysacam-symbol.svg', tag: 'hysacam-' + first.id }); } catch (e) {}
    }
  }

  /* ---------- badge ---------- */
  function updateBadge() {
    const unread = enabled() ? items.filter(isUnread).length : 0;
    document.querySelectorAll('.notification-count').forEach(el => {
      el.textContent = unread > 9 ? '9+' : String(unread);
      el.hidden = unread === 0;
    });
    document.querySelectorAll('[data-open-notifications].notification-toggle').forEach(btn => {
      btn.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    });
    return unread;
  }

  /* ---------- panel markup ---------- */
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'notif-heading');
  panel.innerHTML = `
    <div class="notification-head">
      <button type="button" class="notif-back" id="notif-back" aria-label="Back to notifications" hidden>${ICON.back}</button>
      <div class="notif-titles"><span class="eyebrow" id="notif-eyebrow">LATEST UPDATES</span><h3 id="notif-heading">Notifications</h3></div>
      <button id="notification-close" type="button" aria-label="Close notifications">×</button>
    </div>
    <div class="notif-toolbar" id="notif-toolbar">
      <div class="notif-tabs" role="group" aria-label="Filter notifications">
        <button type="button" data-filter="all" aria-pressed="true">All</button>
        <button type="button" data-filter="unread" aria-pressed="false">Unread <span id="notif-unread-n"></span></button>
      </div>
      <button type="button" id="notif-markall" hidden>Mark all as read</button>
    </div>
    <div id="notification-list" class="notification-list"></div>
    <div id="notification-detail" class="notification-detail" hidden></div>
    <p class="notification-foot" id="notif-foot">Tap an update to read it</p>`;

  const backdrop = document.createElement('div');
  backdrop.className = 'notification-backdrop';
  backdrop.hidden = true;
  document.body.appendChild(backdrop);

  const $ = (id) => document.getElementById(id);

  function dayLabel(time) {
    const d = new Date(time);
    if (isNaN(d.getTime())) return 'Earlier';
    const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(new Date()) - start(d)) / 86400000);
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return 'This week';
    return 'Earlier';
  }

  function renderList() {
    const list = $('notification-list');
    if (!signedIn()) {
      list.innerHTML = `<div class="notification-empty"><span class="n-empty-ico">${ICON.bell}</span><b>Sign in to see your updates</b><p>Report updates and cleaning activity appear here after you sign in</p><div class="gate-actions"><a class="button" href="signin.html">Sign In</a><a class="button outline" href="signup.html">Sign Up</a></div></div>`;
      $('notif-toolbar').hidden = true; $('notif-foot').hidden = true;
      return;
    }
    $('notif-toolbar').hidden = false; $('notif-foot').hidden = false;
    if (!enabled()) {
      list.innerHTML = '<div class="notification-empty"><b>Notifications are turned off</b><p>You can turn them back on in <a href="settings.html">Settings</a></p></div>';
      $('notif-toolbar').hidden = true;
      return;
    }
    const unreadSet = new Set(items.filter(isUnread).map(i => i.id));
    $('notif-unread-n').textContent = unreadSet.size ? `(${unreadSet.size})` : '';
    $('notif-markall').hidden = unreadSet.size === 0;
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));

    const shown = filter === 'unread' ? items.filter(i => unreadSet.has(i.id)) : items;
    if (!shown.length) {
      list.innerHTML = filter === 'unread'
        ? `<div class="notification-empty"><span class="n-empty-ico">${ICON.bell}</span><b>You are all caught up</b><p>No unread updates right now</p></div>`
        : `<div class="notification-empty"><span class="n-empty-ico">${ICON.bell}</span><b>No updates yet</b><p>Report updates and verified cleaning activity will appear here</p></div>`;
      return;
    }
    let html = '', lastGroup = '';
    shown.forEach(i => {
      const g = dayLabel(i.time);
      if (g !== lastGroup) { html += `<h4 class="n-group">${g}</h4>`; lastGroup = g; }
      const un = unreadSet.has(i.id);
      html += `<button type="button" class="notification-item${un ? ' unread' : ''}" data-notif="${esc(i.id)}">
        <span class="n-ico k-${i.kind}">${ICON[i.kind]}</span>
        <span class="n-body"><b>${esc(i.title)}</b><span class="n-msg">${esc(i.message)}</span><time>${esc(H.ago(i.time))}</time></span>
        ${un ? '<span class="n-dot" aria-label="Unread"></span>' : ''}${ICON.chev}</button>`;
    });
    list.innerHTML = html;
  }

  function statusKey(item) {
    const label = item.rows.find(r => r[0] === 'Status')?.[1];
    const key = Object.keys(STATUS_LABEL).find(k => STATUS_LABEL[k] === label) || 'submitted';
    return { submitted: 'submitted', under_review: 'review', assigned: 'review', in_progress: 'review', resolved: 'resolved', rejected: 'closed' }[key];
  }
  function renderDetail(item) {
    const pill = item.kind === 'report' ? `<span class="pill st-${statusKey(item)}">${esc(item.rows.find(r => r[0] === 'Status')?.[1] || '')}</span>` : '';
    $('notification-detail').innerHTML = `
      <div class="n-detail-top"><span class="n-ico big k-${item.kind}">${ICON[item.kind]}</span>
        <div><h4>${esc(item.title)}</h4><time>${esc(H.full(item.time))}</time></div>${pill}</div>
      <p class="n-detail-summary">${esc(item.summary)}</p>
      <dl class="n-detail-rows">${item.rows.filter(r => r[0] !== 'Status' || item.kind !== 'report').map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${item.note ? `<div class="n-detail-note"><b>${item.kind === 'report' ? 'Team update' : 'Notes'}</b><p>${esc(item.note)}</p></div>` : ''}
      <div class="n-detail-actions"><a class="button" href="${esc(item.href)}">${esc(item.cta)}</a><button type="button" class="button outline" data-notif-back>Back</button></div>`;
  }

  function setView(next) {
    view = next;
    const detail = next === 'detail';
    $('notification-list').hidden = detail;
    $('notif-toolbar').hidden = detail || !enabled();
    $('notif-foot').hidden = detail || !signedIn();
    $('notification-detail').hidden = !detail;
    $('notif-back').hidden = !detail;
    $('notif-eyebrow').textContent = detail ? 'UPDATE' : 'LATEST UPDATES';
    $('notif-heading').textContent = detail ? 'Details' : 'Notifications';
    panel.scrollTop = 0;
  }

  function openItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    markRead([id]);                 // viewing it clears it from the badge, for good
    updateBadge();
    renderDetail(item);
    setView('detail');
    $('notif-back').focus({ preventScroll: true });
  }

  function render() {
    updateBadge();
    if (view === 'list') renderList();
  }

  /* ---------- open / close ---------- */
  function setOpen(open) {
    if (open === !panel.hidden) return;
    panel.hidden = !open;
    backdrop.hidden = !open;
    document.body.classList.toggle('notif-open', open);
    if (open) {
      setView('list'); renderList();
      $('notification-close').focus({ preventScroll: true });
      refresh(true);
    } else {
      lastTrigger?.focus?.({ preventScroll: true });
    }
  }
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-notifications]');
    if (trigger) { event.preventDefault(); lastTrigger = trigger; setOpen(panel.hidden); return; }
    if (!panel.hidden && event.target === backdrop) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return;
    if (view === 'detail') { setView('list'); renderList(); } else setOpen(false);
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('#notification-close')) return setOpen(false);
    if (event.target.closest('#notif-back, [data-notif-back]')) { setView('list'); renderList(); return; }
    if (event.target.closest('#notif-markall')) { markRead(items.map(i => i.id)); render(); return; }
    const tab = event.target.closest('[data-filter]');
    if (tab) { filter = tab.dataset.filter; renderList(); return; }
    const row = event.target.closest('[data-notif]');
    if (row) openItem(row.dataset.notif);
  });

  /* ---------- data (signed-in accounts only) ---------- */
  let cleaningAt = 0;
  async function loadCleaning(force) {
    if (!signedIn()) return;
    if (!force && Date.now() - cleaningAt < 30000) return;
    const c = await whenDatabase();
    if (!c || !signedIn()) return;
    try {
      const { data, error } = await c.from('cleaning_records').select('id,area,activity,status,notes,cleaned_at').eq('verified', true).order('cleaned_at', { ascending: false }).limit(MAX_CLEANING);
      if (error || !signedIn()) return;
      cleaningAt = Date.now();
      parts.cleaning = cleaningItems(data);
      merge(); announceNew(); render();
    } catch (error) { console.warn('[HYSACAM] Cleaning updates unavailable', error); }
  }
  async function loadReports() {
    if (!signedIn()) return;
    const list = await H.reports();
    if (list === undefined || !signedIn()) return;          // offline or signed out: keep what is shown
    parts.report = reportItems(list || []);
    merge(); announceNew(); render();
  }
  function refresh(force) {
    if (!enabled()) { render(); return; }
    loadReports();
    loadCleaning(force);
  }

  /* ---------- wiring ---------- */
  document.addEventListener('hys:reports', (event) => {
    if (!enabled() || !Array.isArray(event.detail)) return;
    parts.report = reportItems(event.detail);
    merge(); announceNew(); render();
  });
  let lastScope = scope();
  document.addEventListener('hys:account', () => {
    if (scope() === lastScope) return;          // same account as before: nothing to reload
    lastScope = scope();
    serverReads = new Set(); primed = false; known = new Set();
    loadFromCache(); render();
    syncReads().then(() => refresh(true));      // read marks first, so nothing old flashes as unread
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncReads(); refresh(); } });
  window.addEventListener('online', () => { syncReads(); refresh(true); });
  window.addEventListener('storage', (event) => { if ([READ_KEY, PREF_KEY].includes(event.key)) render(); });
  $('pref-notifications')?.addEventListener('change', () => setTimeout(() => { render(); if (enabled()) refresh(true); }, 0));
  setInterval(() => { if (document.visibilityState === 'visible' && enabled()) refresh(); }, POLL_MS);

  function loadFromCache() {
    if (!signedIn()) { items = []; parts.report = []; parts.cleaning = []; return; }
    const cache = H.read(CACHE_KEY);
    items = cache && cache.scope === scope() && Array.isArray(cache.items) ? cache.items : [];
    parts.report = items.filter(i => i.kind === 'report');
    parts.cleaning = items.filter(i => i.kind === 'cleaning');
    items.forEach(i => known.add(i.id));
  }

  loadFromCache();
  render();                  // badge appears immediately from the last known updates (never for visitors)
  syncReads().then(() => refresh());
})();
