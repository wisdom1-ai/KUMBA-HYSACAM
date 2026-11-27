/* HYSACAM notifications (v3)
   - Read state survives sign-out / sign-in, "Clear saved data" and other devices
     (saved on this device AND in Supabase table notification_reads, see notification_reads.sql).
   - Unread badge, All / Unread filter, day groups, tap to read, mark all as read.
   - Live: checks for new updates every minute and when the app comes back to the foreground,
     then shows a toast (and a browser alert if the person allowed them and the app is in the background).
   - Follows the "In-app notifications" switch in Settings on every page.
   - Self-contained: injects its own styles, so no extra CSS file is needed.
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
  const PREF_KEY = 'hysacam-device-preferences-v1';       // older versions of the switch
  const PREF_NEW = 'hysacam-pref-notifications';          // Settings page (prefs.js)
  const TABLE = 'notification_reads';
  const MAX_REPORTS = 8, MAX_CLEANING = 3, MAX_TOTAL = 10, MAX_READ_IDS = 400, POLL_MS = 60000;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const signedIn = () => !!H.authCache();
  const scope = () => H.userKey() || 'visitor';
  function prefOn() {
    try { const v = localStorage.getItem(PREF_NEW); if (v !== null) return v === 'true'; } catch (e) {}
    return (H.read(PREF_KEY) || {}).notifications !== false;
  }
  const enabled = () => signedIn() && prefOn();

  /* ---------- styles (injected so every page looks the same) ---------- */
  const CSS = `
body.notif-open{overflow:hidden}
.notification-backdrop{position:fixed;top:0;right:0;bottom:0;left:0;z-index:1190;background:rgba(8,26,17,.45);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);animation:nFade .2s ease}
.notification-backdrop.closing{animation:nFadeOut .18s ease forwards}
.notification-backdrop[hidden]{display:none}
aside#notification-panel.notification-panel{position:fixed;z-index:1210;top:50%;left:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 28px));max-height:min(82vh,700px);padding:0;display:flex;flex-direction:column;overflow:hidden;background:#fff;border:1px solid #e1ebe4;border-radius:24px;box-shadow:0 28px 80px rgba(8,40,24,.32);animation:nIn .22s cubic-bezier(.22,.8,.3,1)}
aside#notification-panel.notification-panel.closing{animation:nOut .18s ease forwards}
aside#notification-panel.notification-panel[hidden]{display:none}
#notification-panel .n-grab{display:none;flex:0 0 auto;width:44px;height:5px;margin:9px auto 0;border-radius:5px;background:#d3ddd7}
#notification-panel .notification-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:14px 14px 12px 18px;border-bottom:1px solid #edf2ee;background:#fff}
#notification-panel .notif-titles{flex:1;min-width:0}
#notification-panel .notification-head h3{margin:3px 0 0;font-size:21px;line-height:1.15}
#notification-panel .notification-head button{flex:0 0 38px;width:38px;height:38px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:#eef5f0;color:#17231d;font-size:22px;line-height:1;cursor:pointer}
#notification-panel .notification-head button:active{background:#dcebe1}
#notification-panel .notif-back svg{width:22px;height:22px;stroke:#075f3d}
#notification-panel .notif-back[hidden]{display:none}

#notification-panel .notif-toolbar{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 18px;border-bottom:1px solid #f0f5f1;background:#fff}
#notification-panel .notif-toolbar[hidden]{display:none}
#notification-panel .notif-tabs{display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:#eef5f0}
#notification-panel .notif-tabs button{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:9px;padding:7px 13px;background:transparent;font:inherit;font-size:13px;font-weight:700;color:#45544b;cursor:pointer}
#notification-panel .notif-tabs button[aria-pressed="true"]{background:#fff;color:#075f3d;box-shadow:0 1px 6px rgba(13,59,35,.14)}
#notification-panel .notif-tabs em{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#d83b3b;color:#fff;font-style:normal;font-size:10.5px;font-weight:800;line-height:1}
#notification-panel .notif-tabs em[hidden]{display:none}
#notification-panel #notif-markall{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:8px 2px;font:inherit;font-size:13px;font-weight:800;color:#087747;cursor:pointer}
#notification-panel #notif-markall[hidden]{display:none}
#notification-panel #notif-markall svg{width:16px;height:16px}

#notification-panel .notification-list,#notification-panel .notification-detail{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
#notification-panel .notification-list[hidden],#notification-panel .notification-detail[hidden]{display:none}
#notification-panel .n-group{position:sticky;top:0;z-index:2;margin:0;padding:9px 18px;background:rgba(244,248,245,.96);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6a796f}
#notification-panel .notification-item{position:relative;display:flex;align-items:flex-start;gap:12px;width:100%;padding:14px 18px;border:0;border-bottom:1px solid #edf2ee;background:#fff;text-align:left;font:inherit;color:inherit;cursor:pointer;-webkit-appearance:none;appearance:none;transition:background .15s}
#notification-panel .notification-item:hover{background:#f6faf7}
#notification-panel .notification-item:active{background:#eaf4ee}
#notification-panel .notification-item.unread{background:#f3faf6}
#notification-panel .notification-item.unread::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:#087747}
#notification-panel .n-ico{flex:0 0 42px;width:42px;height:42px;display:grid;place-items:center;border-radius:14px}
#notification-panel .n-ico svg{width:21px;height:21px}
#notification-panel .n-ico.big{flex-basis:52px;width:52px;height:52px;border-radius:16px}
#notification-panel .n-ico.big svg{width:26px;height:26px}
.tone-green{background:#e0f3e7;color:#0b7a3e}
.tone-blue{background:#e1ecfb;color:#1d4ed8}
.tone-deep{background:#0b7a3e;color:#fff}
.tone-gray{background:#eceff1;color:#4b5563}
.tone-teal{background:#dcf3f0;color:#0f766e}
#notification-panel .n-body{flex:1;min-width:0}
#notification-panel .n-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
#notification-panel .notification-item b{display:block;font-size:14.5px;font-weight:600;color:#17231d;line-height:1.3}
#notification-panel .notification-item.unread b{font-weight:800}
#notification-panel .notification-item time{flex:0 0 auto;margin:0;font-size:11.5px;color:#7a897f;white-space:nowrap}
#notification-panel .n-msg{display:block;margin-top:2px;font-size:13px;line-height:1.4;color:#56665c;overflow-wrap:anywhere}
#notification-panel .n-preview{display:block;margin-top:7px;padding:7px 10px;border-radius:10px;background:#eaf6ef;font-size:12.5px;line-height:1.4;color:#33453a;overflow-wrap:anywhere}
#notification-panel .n-preview strong{color:#075f3d}
#notification-panel .n-dot{flex:0 0 9px;width:9px;height:9px;margin-top:6px;border-radius:50%;background:#087747}

#notification-panel .notification-empty{padding:40px 24px;text-align:center}
#notification-panel .notification-empty b{display:block;font-size:16px;color:#17231d}
#notification-panel .notification-empty p{margin:6px 0 0;font-size:13px;line-height:1.5;color:var(--muted,#5c6b62)}
#notification-panel .notification-empty a{color:var(--green,#087747);font-weight:700}
#notification-panel .n-empty-ico{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 14px;border-radius:50%;background:#e9f5ee;color:var(--green,#087747)}
#notification-panel .n-empty-ico svg{width:27px;height:27px}
#notification-panel .n-sk{display:flex;gap:12px;align-items:center;padding:16px 18px;border-bottom:1px solid #edf2ee}
#notification-panel .n-sk .sk-dot{flex:0 0 42px;width:42px;height:42px;border-radius:14px}
#notification-panel .n-sk .sk-lines{flex:1}

#notification-panel .notification-detail{padding:18px}
#notification-panel .n-detail-top{display:flex;align-items:center;gap:12px}
#notification-panel .n-detail-top>div{flex:1;min-width:0}
#notification-panel .n-detail-top h4{margin:0;font-size:17px;color:#17231d;line-height:1.25}
#notification-panel .n-detail-top time{display:block;margin-top:3px;font-size:12px;color:#7a897f}
#notification-panel .n-pill{flex:0 0 auto;padding:5px 11px;border-radius:999px;font-size:11.5px;font-weight:800;white-space:nowrap}
#notification-panel .n-detail-summary{margin:14px 0 4px;font-size:14px;line-height:1.55;color:#33453a}
#notification-panel .n-detail-rows{display:grid;grid-template-columns:96px minmax(0,1fr);gap:9px 12px;margin:14px 0 0;padding:14px;background:#f5f9f6;border-radius:14px;font-size:13px}
#notification-panel .n-detail-rows dt{color:#6a796f;font-weight:600}
#notification-panel .n-detail-rows dd{margin:0;color:#17231d;overflow-wrap:anywhere}
#notification-panel .n-detail-note{margin-top:14px;padding:14px;background:#eaf6ef;border:1px solid #cfe6d7;border-radius:14px}
#notification-panel .n-detail-note b{font-size:13px;color:var(--deep,#064e35)}
#notification-panel .n-detail-note p{margin:5px 0 0;font-size:13px;line-height:1.5;color:#33453a;overflow-wrap:anywhere}
#notification-panel .n-detail-actions{display:flex;gap:10px;margin-top:18px}
#notification-panel .n-detail-actions .button{flex:1;display:flex;align-items:center;justify-content:center;min-height:48px;margin:0;padding:0 12px;text-align:center}

#notification-panel .n-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 18px;border-top:1px solid #edf2ee;background:#fafcfb;font-size:12px;color:#6a796f}
#notification-panel .n-foot[hidden]{display:none}
#notification-panel .n-foot-actions{display:flex;align-items:center;gap:14px;flex:0 0 auto}
#notification-panel .n-foot button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:6px 0;font:inherit;font-size:12.5px;font-weight:800;color:#087747;cursor:pointer}
#notification-panel .n-foot button[hidden]{display:none}
#notification-panel .n-foot button svg{width:15px;height:15px}
#notification-panel .n-foot button.busy svg{animation:nSpin 1s linear infinite}

.notification-toggle.n-ring svg{transform-origin:50% 12%;animation:nRing 1.1s ease}

@keyframes nIn{from{opacity:0;transform:translate(-50%,-47%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes nOut{from{opacity:1;transform:translate(-50%,-50%) scale(1)}to{opacity:0;transform:translate(-50%,-48%) scale(.98)}}
@keyframes nSheetIn{from{transform:translateY(100%)}to{transform:none}}
@keyframes nSheetOut{from{transform:none}to{transform:translateY(100%)}}
@keyframes nFade{from{opacity:0}to{opacity:1}}
@keyframes nFadeOut{from{opacity:1}to{opacity:0}}
@keyframes nSpin{to{transform:rotate(360deg)}}
@keyframes nRing{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-12deg)}45%{transform:rotate(9deg)}60%{transform:rotate(-6deg)}75%{transform:rotate(3deg)}}

@media(max-width:600px){
  aside#notification-panel.notification-panel{top:auto;left:0;right:0;bottom:0;transform:none;width:100%;max-height:88vh;max-height:88dvh;border-radius:26px 26px 0 0;border-bottom:0;padding-bottom:env(safe-area-inset-bottom);animation:nSheetIn .28s cubic-bezier(.22,.8,.3,1)}
  aside#notification-panel.notification-panel.closing{animation:nSheetOut .2s ease forwards}
  #notification-panel .n-grab{display:block}
  #notification-panel .notification-head{padding-top:8px}
}
@media(prefers-reduced-motion:reduce){
  aside#notification-panel.notification-panel,.notification-backdrop,.notification-toggle.n-ring svg{animation-duration:.001ms!important}
}`;
  if (!document.getElementById('hys-notif-style')) {
    const st = document.createElement('style');
    st.id = 'hys-notif-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- icons ---------- */
  const svg = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const ICON = {
    doc: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    tool: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
    check: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>'),
    x: svg('<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>'),
    cleaning: svg('<path d="M9 4h6v3H9zM7 5H5v16h14V5h-2"/><path d="m9 14 2 2 4-4"/>'),
    back: svg('<path d="m15 6-6 6 6 6"/>'),
    bell: svg('<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    checks: svg('<path d="m3 12.5 4 4L15 8"/><path d="m11 14.5 2 2L21 8"/>'),
    refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    alert: svg('<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/><path d="M12 2v1"/>')
  };

  const STATUS = {
    submitted:    { tone: 'green', icon: 'doc',   label: 'Submitted',   title: 'Report received',     text: 'Your report has been received by the HYSACAM team' },
    under_review: { tone: 'blue',  icon: 'eye',   label: 'In Review',   title: 'Report under review', text: 'Our team is reviewing your report' },
    assigned:     { tone: 'blue',  icon: 'user',  label: 'Assigned',    title: 'Report assigned',     text: 'A crew has been assigned to your report' },
    in_progress:  { tone: 'blue',  icon: 'tool',  label: 'In Progress', title: 'Work in progress',    text: 'A crew is working on the issue you reported' },
    resolved:     { tone: 'deep',  icon: 'check', label: 'Resolved',    title: 'Report resolved',     text: 'The issue you reported has been resolved' },
    rejected:     { tone: 'gray',  icon: 'x',     label: 'Closed',      title: 'Report closed',       text: 'Your report has been closed by the team' }
  };
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

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

  /* ---------- state ---------- */
  const parts = { report: [], cleaning: [] };
  let items = [];
  let view = 'list';            // 'list' | 'detail'
  let filter = 'all';           // 'all' | 'unread'
  let isOpen = false;
  let lastTrigger = null;
  let known = new Set();        // ids already seen, so only truly new updates are announced
  let primed = false;
  let loading = true;           // true until the first load finishes (and nothing is cached)
  let offline = false;
  let refreshing = false;
  let lastUpdated = 0;
  let closeTimer = null;
  const baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, '');

  function merge() {
    items = [...parts.report, ...parts.cleaning]
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
      .slice(0, MAX_TOTAL);
    if (signedIn()) H.write(CACHE_KEY, { scope: scope(), items, t: Date.now() });
  }

  function reportItems(list) {
    return (list || []).slice(0, MAX_REPORTS).map(r => {
      const s = STATUS[r.status] || STATUS.submitted;
      const notes = String(r.admin_notes || '').trim();
      const rows = [
        ['Reference', r.reference_code], ['Status', s.label], ['Issue', r.issue_type],
        ['Area', r.area], ['Location', r.location_description], ['Description', r.description],
        ['Submitted', H.full(r.created_at)], ['Last update', H.valid(r.updated_at) ? H.full(r.updated_at) : '']
      ].filter(([, v]) => v);
      return {
        id: `r:${r.id}:${r.status}` + (notes ? ':' + hash(notes) : ''),   // a new team note counts as a new update
        kind: 'report', tone: s.tone, icon: s.icon, statusLabel: s.label,
        title: s.title, message: `${r.reference_code || 'Report'} · ${r.issue_type || 'Waste issue'}`,
        preview: notes.length > 90 ? notes.slice(0, 88).trimEnd() + '…' : notes,
        summary: s.text, time: r.updated_at || r.created_at, rows,
        note: notes, href: `report.html#${encodeURIComponent(r.reference_code || '')}`, cta: 'Open report'
      };
    });
  }
  function cleaningItems(list) {
    return (list || []).map(c => ({
      id: `c:${c.id}`, kind: 'cleaning', tone: 'teal', icon: 'cleaning', statusLabel: '',
      title: 'Verified cleaning update', message: `${c.activity || 'Cleaning'} · ${c.area || 'Kumba'}`,
      preview: '', summary: 'HYSACAM staff recorded a verified cleaning activity',
      time: c.cleaned_at,
      rows: [['Activity', c.activity || 'Cleaning'], ['Area', c.area || 'Kumba'], ['Status', c.status || 'Recorded'], ['Completed', H.full(c.cleaned_at)]].filter(([, v]) => v),
      note: c.notes || '', href: 'cleaning.html', cta: 'View records'
    }));
  }

  /* ---------- new update announcements ---------- */
  function ringBell() {
    document.querySelectorAll('.notification-toggle').forEach(b => {
      b.classList.remove('n-ring'); void b.offsetWidth; b.classList.add('n-ring');
      setTimeout(() => b.classList.remove('n-ring'), 1200);
    });
  }
  function announceNew() {
    if (!primed) { primed = true; items.forEach(i => known.add(i.id)); return; }
    const set = readIds();
    const fresh = items.filter(i => !known.has(i.id) && !set.has(i.id));
    items.forEach(i => known.add(i.id));
    if (!fresh.length || !enabled()) return;
    const first = fresh[0];
    const text = fresh.length === 1 ? first.title : `${fresh.length} new updates`;
    ringBell();
    if (typeof H.toast === 'function') { try { H.toast(text, 'ok'); } catch (e) {} }
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(first.title, { body: fresh.length === 1 ? first.message : 'Open HYSACAM Kumba Tracker to read them', icon: 'images/hysacam-symbol.svg', tag: 'hysacam-' + first.id }); } catch (e) {}
    }
  }

  /* ---------- badge ---------- */
  function updateBadge() {
    const set = readIds();
    const unread = enabled() ? items.filter(i => !set.has(i.id)).length : 0;
    document.querySelectorAll('.notification-count').forEach(el => {
      el.textContent = unread > 9 ? '9+' : String(unread);
      el.hidden = unread === 0;
    });
    document.querySelectorAll('[data-open-notifications].notification-toggle').forEach(btn => {
      btn.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    });
    document.title = unread ? `(${unread > 9 ? '9+' : unread}) ${baseTitle}` : baseTitle;
    try {
      if (unread && navigator.setAppBadge) navigator.setAppBadge(unread);
      else if (navigator.clearAppBadge) navigator.clearAppBadge();
    } catch (e) { /* not supported */ }
    return unread;
  }

  /* ---------- panel markup ---------- */
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'notif-heading');
  panel.innerHTML = `
    <span class="n-grab" aria-hidden="true"></span>
    <div class="notification-head">
      <button type="button" class="notif-back" id="notif-back" aria-label="Back to notifications" hidden>${ICON.back}</button>
      <div class="notif-titles"><span class="eyebrow" id="notif-eyebrow">LATEST UPDATES</span><h3 id="notif-heading">Notifications</h3></div>
      <button id="notification-close" type="button" aria-label="Close notifications">×</button>
    </div>
    <div class="notif-toolbar" id="notif-toolbar">
      <div class="notif-tabs" role="group" aria-label="Filter notifications">
        <button type="button" data-filter="all" aria-pressed="true">All</button>
        <button type="button" data-filter="unread" aria-pressed="false">Unread <em id="notif-unread-n" hidden></em></button>
      </div>
      <button type="button" id="notif-markall" hidden>${ICON.checks}Mark all read</button>
    </div>
    <div id="notification-list" class="notification-list"></div>
    <div id="notification-detail" class="notification-detail" hidden></div>
    <div class="n-foot" id="notif-foot">
      <span id="notif-status">Checking for updates…</span>
      <span class="n-foot-actions">
        <button type="button" id="notif-alerts" hidden>${ICON.alert}Turn on alerts</button>
        <button type="button" id="notif-refresh">${ICON.refresh}Refresh</button>
      </span>
    </div>`;

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

  function renderFoot() {
    const show = signedIn() && enabled() && view === 'list';
    $('notif-foot').hidden = !show;
    if (!show) return;
    let text;
    if (refreshing) text = 'Checking for updates…';
    else if (offline) text = lastUpdated ? 'Offline · showing saved updates' : 'Offline · could not load updates';
    else if (lastUpdated) text = 'Updated ' + H.ago(new Date(lastUpdated).toISOString());
    else text = 'Checking for updates…';
    $('notif-status').textContent = text;
    $('notif-refresh').classList.toggle('busy', refreshing);
    $('notif-refresh').disabled = refreshing;
    $('notif-alerts').hidden = !('Notification' in window && Notification.permission === 'default');
  }

  function renderList() {
    const list = $('notification-list');
    const scrollTop = list.scrollTop;
    if (!signedIn()) {
      list.innerHTML = `<div class="notification-empty"><span class="n-empty-ico">${ICON.bell}</span><b>Sign in to see your updates</b><p>Report updates and cleaning activity appear here after you sign in</p><div class="gate-actions"><a class="button" href="signin.html">Sign In</a><a class="button outline" href="signup.html">Sign Up</a></div></div>`;
      $('notif-toolbar').hidden = true; renderFoot();
      return;
    }
    if (!enabled()) {
      list.innerHTML = '<div class="notification-empty"><span class="n-empty-ico">' + ICON.bell + '</span><b>Notifications are turned off</b><p>You can turn them back on in <a href="settings.html#notifications-section">Settings</a></p></div>';
      $('notif-toolbar').hidden = true; renderFoot();
      return;
    }
    $('notif-toolbar').hidden = false;
    const readSet = readIds();
    const unreadItems = items.filter(i => !readSet.has(i.id));
    const badge = $('notif-unread-n');
    badge.textContent = unreadItems.length > 9 ? '9+' : String(unreadItems.length);
    badge.hidden = unreadItems.length === 0;
    $('notif-markall').hidden = unreadItems.length === 0;
    document.querySelectorAll('#notification-panel [data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));

    if (loading && !items.length) {
      list.innerHTML = '<div class="n-sk"><span class="sk-dot"></span><div class="sk-lines"><i></i><i></i></div></div>'.repeat(3);
      renderFoot();
      return;
    }
    const shown = filter === 'unread' ? unreadItems : items;
    if (!shown.length) {
      list.innerHTML = filter === 'unread'
        ? `<div class="notification-empty"><span class="n-empty-ico">${ICON.checks}</span><b>You are all caught up</b><p>No unread updates right now</p></div>`
        : offline
          ? `<div class="notification-empty"><span class="n-empty-ico">${ICON.bell}</span><b>Could not load updates</b><p>Check your connection, then tap Refresh below</p></div>`
          : `<div class="notification-empty"><span class="n-empty-ico">${ICON.bell}</span><b>No updates yet</b><p>Report updates and verified cleaning activity will appear here</p></div>`;
      renderFoot();
      return;
    }
    let out = '', lastGroup = '';
    shown.forEach(i => {
      const g = dayLabel(i.time);
      if (g !== lastGroup) { out += `<h4 class="n-group">${g}</h4>`; lastGroup = g; }
      const un = !readSet.has(i.id);
      out += `<button type="button" class="notification-item${un ? ' unread' : ''}" data-notif="${esc(i.id)}">
        <span class="n-ico tone-${i.tone}">${ICON[i.icon] || ICON.doc}</span>
        <span class="n-body"><span class="n-row"><b>${esc(i.title)}</b><time>${esc(H.ago(i.time))}</time></span><span class="n-msg">${esc(i.message)}</span>${i.preview ? `<span class="n-preview"><strong>Team:</strong> ${esc(i.preview)}</span>` : ''}</span>
        ${un ? '<span class="n-dot" aria-label="Unread"></span>' : ''}</button>`;
    });
    list.innerHTML = out;
    list.scrollTop = scrollTop;
    renderFoot();
  }

  function renderDetail(item) {
    const pill = item.kind === 'report' && item.statusLabel ? `<span class="n-pill tone-${item.tone}">${esc(item.statusLabel)}</span>` : '';
    $('notification-detail').innerHTML = `
      <div class="n-detail-top"><span class="n-ico big tone-${item.tone}">${ICON[item.icon] || ICON.doc}</span>
        <div><h4>${esc(item.title)}</h4><time>${esc(H.full(item.time))}</time></div>${pill}</div>
      <p class="n-detail-summary">${esc(item.summary)}</p>
      <dl class="n-detail-rows">${item.rows.filter(r => !(r[0] === 'Status' && item.kind === 'report')).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${item.note ? `<div class="n-detail-note"><b>${item.kind === 'report' ? 'Team update' : 'Notes'}</b><p>${esc(item.note)}</p></div>` : ''}
      <div class="n-detail-actions"><a class="button" href="${esc(item.href)}">${esc(item.cta)}</a><button type="button" class="button outline" data-notif-back>Back</button></div>`;
  }

  function setView(next) {
    view = next;
    const detail = next === 'detail';
    $('notification-list').hidden = detail;
    $('notif-toolbar').hidden = detail || !enabled();
    $('notification-detail').hidden = !detail;
    $('notif-back').hidden = !detail;
    $('notif-eyebrow').textContent = detail ? 'UPDATE' : 'LATEST UPDATES';
    $('notif-heading').textContent = detail ? 'Details' : 'Notifications';
    renderFoot();
    panel.scrollTop = 0;
    $('notification-detail').scrollTop = 0;
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
    if (!isOpen) return;
    if (view === 'list') renderList(); else renderFoot();
  }

  /* ---------- open / close ---------- */
  function setOpen(open) {
    if (open === isOpen) return;
    isOpen = open;
    clearTimeout(closeTimer);
    panel.style.transform = ''; panel.style.transition = '';
    document.body.classList.toggle('notif-open', open);
    if (open) {
      panel.classList.remove('closing'); backdrop.classList.remove('closing');
      panel.hidden = false; backdrop.hidden = false;
      setView('list'); renderList();
      $('notification-close').focus({ preventScroll: true });
      refresh(true);
    } else {
      panel.classList.add('closing'); backdrop.classList.add('closing');
      closeTimer = setTimeout(() => {
        panel.hidden = true; backdrop.hidden = true;
        panel.classList.remove('closing'); backdrop.classList.remove('closing');
      }, 190);
      lastTrigger?.focus?.({ preventScroll: true });
    }
  }
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-notifications]');
    if (trigger) { event.preventDefault(); lastTrigger = trigger; setOpen(!isOpen); return; }
    if (isOpen && event.target === backdrop) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      if (view === 'detail') { setView('list'); renderList(); } else setOpen(false);
      return;
    }
    if (event.key === 'Tab') {                                   // keep keyboard focus inside the panel
      const f = [...panel.querySelectorAll('button:not([hidden]):not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!panel.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    }
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('#notification-close')) return setOpen(false);
    if (event.target.closest('#notif-back, [data-notif-back]')) { setView('list'); renderList(); return; }
    if (event.target.closest('.n-detail-actions a, .notification-empty a')) { setOpen(false); return; }   // let the link work, then close
    if (event.target.closest('#notif-markall')) { markRead(items.map(i => i.id)); render(); return; }
    if (event.target.closest('#notif-refresh')) { refresh(true); return; }
    if (event.target.closest('#notif-alerts')) {
      try {
        Notification.requestPermission().then((p) => {
          renderFoot();
          if (p === 'granted' && typeof H.toast === 'function') { try { H.toast('Alerts turned on', 'ok'); } catch (e) {} }
        });
      } catch (e) {}
      return;
    }
    const tab = event.target.closest('[data-filter]');
    if (tab) { filter = tab.dataset.filter; renderList(); return; }
    const row = event.target.closest('[data-notif]');
    if (row) openItem(row.dataset.notif);
  });

  /* ---------- swipe down to close (phones) ---------- */
  (() => {
    let startY = null, dy = 0, dragging = false;
    panel.addEventListener('touchstart', (e) => {
      if (window.innerWidth > 600) { startY = null; return; }
      const t = e.target;
      const onHead = t.closest('.n-grab, .notification-head');
      const scroller = t.closest('.notification-list, .notification-detail');
      startY = (onHead || (scroller && scroller.scrollTop <= 0)) ? e.touches[0].clientY : null;
      dy = 0; dragging = false;
    }, { passive: true });
    panel.addEventListener('touchmove', (e) => {
      if (startY === null) return;
      dy = e.touches[0].clientY - startY;
      if (dy > 8) { dragging = true; panel.style.transition = 'none'; panel.style.transform = `translateY(${dy}px)`; }
    }, { passive: true });
    panel.addEventListener('touchend', () => {
      if (startY === null || !dragging) { startY = null; return; }
      const close = dy > 90;
      startY = null; dragging = false;
      if (close) { setOpen(false); return; }
      panel.style.transition = 'transform .2s ease';
      panel.style.transform = '';
      setTimeout(() => { panel.style.transition = ''; }, 220);
    }, { passive: true });
  })();

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
      merge(); announceNew();
    } catch (error) { console.warn('[HYSACAM] Cleaning updates unavailable', error); }
  }
  async function loadReports() {
    if (!signedIn()) return;
    let list;
    try { list = await H.reports(); } catch (e) { list = undefined; }
    if (!signedIn()) return;
    if (list === undefined) { offline = true; return; }          // offline or failed: keep what is shown
    offline = false; lastUpdated = Date.now();
    parts.report = reportItems(list || []);
    merge(); announceNew();
  }
  async function refresh(force) {
    if (!enabled()) { render(); return; }
    if (refreshing) return;
    refreshing = true; renderFoot();
    try { await Promise.all([loadReports(), loadCleaning(force)]); }
    finally { refreshing = false; loading = false; render(); }
  }

  /* ---------- wiring ---------- */
  document.addEventListener('hys:reports', (event) => {
    if (!enabled() || !Array.isArray(event.detail)) return;
    offline = false; lastUpdated = Date.now(); loading = false;
    parts.report = reportItems(event.detail);
    merge(); announceNew(); render();
  });
  let lastScope = scope();
  document.addEventListener('hys:account', () => {
    if (scope() === lastScope) return;          // same account as before: nothing to reload
    lastScope = scope();
    serverReads = new Set(); primed = false; known = new Set(); lastUpdated = 0; offline = false;
    loadFromCache(); render();
    syncReads().then(() => refresh(true));      // read marks first, so nothing old flashes as unread
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncReads(); refresh(); } });
  window.addEventListener('online', () => { syncReads(); refresh(true); });
  window.addEventListener('offline', () => { offline = true; render(); });
  window.addEventListener('storage', (event) => { if ([READ_KEY, PREF_KEY, PREF_NEW].includes(event.key)) render(); });
  const onPref = () => { render(); if (enabled()) refresh(true); };
  document.addEventListener('hysacam:prefs-changed', onPref);                            // Settings page (prefs.js)
  $('pref-notifications')?.addEventListener('change', () => setTimeout(onPref, 0));
  setInterval(() => { if (document.visibilityState === 'visible' && enabled()) refresh(); }, POLL_MS);
  setInterval(() => { if (isOpen && view === 'list') renderList(); }, 30000);           // keeps "5m ago" fresh while open

  function loadFromCache() {
    if (!signedIn()) { items = []; parts.report = []; parts.cleaning = []; loading = false; return; }
    const cache = H.read(CACHE_KEY);
    const ok = cache && cache.scope === scope() && Array.isArray(cache.items);
    items = ok ? cache.items : [];
    parts.report = items.filter(i => i.kind === 'report');
    parts.cleaning = items.filter(i => i.kind === 'cleaning');
    items.forEach(i => known.add(i.id));
    if (ok && cache.t) lastUpdated = cache.t;
    loading = !items.length;
  }

  loadFromCache();
  render();                  // badge appears immediately from the last known updates (never for visitors)
  syncReads().then(() => refresh());
})();
