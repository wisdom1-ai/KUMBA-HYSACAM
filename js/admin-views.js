/* HYSACAM administrator portal: presentation layer only (does not change admin-dashboard.js)
   - one section at a time, app-style tab bar + header on phones
   - removes the duplicated verification heading on sign-in
   - status colours, pending-reports badge, quick actions, phone-friendly tables */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ICON = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

  /* ---------- sign-in: show the verification heading only once ---------- */
  const loginForm = $('admin-login-form'), codeStage = $('admin-code-stage');
  if (loginForm && codeStage) {
    const sync = () => loginForm.classList.toggle('admin-verifying', !codeStage.hidden);
    new MutationObserver(sync).observe(codeStage, { attributes: true, attributeFilter: ['hidden'] });
    sync();
  }

  const portal = $('admin-portal'), main = document.querySelector('.admin-main');
  if (!portal || !main) return;

  /* ---------- inject the phone header pieces and tab bar (so admin.html needs no markup changes) ---------- */
  const header = main.querySelector(':scope > .admin-title');
  if (header && !header.querySelector('.admin-top-logo')) {
    header.insertAdjacentHTML('afterbegin', '<img class="admin-top-logo" src="images/hysacam-symbol.svg" alt="HYSACAM">');
    header.insertAdjacentHTML('beforeend', `<button class="admin-logout-top" type="button" aria-label="Log out">${ICON('<path d="M9 21H5V3h4M16 7l5 5-5 5M21 12H9"/>')}</button>`);
  }
  const tabs = [
    ['overview', 'Dashboard', '<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
    ['manage-bins', 'Bins', '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'],
    ['manage-records', 'Records', '<path d="M9 4h6v3H9zM7 5H5v16h14V5h-2"/><path d="m9 14 2 2 4-4"/>'],
    ['users', 'Users', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'],
    ['reports', 'Reports', '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>'],
    ['settings', 'Settings', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>']
  ];
  if (!portal.querySelector('.admin-tabbar')) {
    portal.insertAdjacentHTML('beforeend', '<nav class="admin-tabbar" aria-label="Administrator sections">' +
      tabs.map(([id, label, d]) => `<a href="#${id}" data-admin-tab="${id}">${ICON(d)}<span>${label}</span><i class="admin-badge" hidden></i></a>`).join('') + '</nav>');
  }

  /* ---------- one section at a time ---------- */
  const views = Object.fromEntries(tabs.map(t => [t[0], t[0]]));
  const intro = main.querySelector(':scope > .admin-dashboard-intro');
  const stats = $('overview'), analytics = main.querySelector('.admin-analytics-grid');
  [intro, stats, analytics].forEach(el => el && (el.dataset.view = 'overview'));
  tabs.slice(1).forEach(([id]) => { const el = $(id); if (el) el.dataset.view = id; });
  main.querySelectorAll(':scope > .admin-title, :scope > .admin-dashboard-footer').forEach(el => el.dataset.view = 'all');

  /* quick actions under the stat cards */
  if (stats && !main.querySelector('.admin-quick')) {
    stats.insertAdjacentHTML('afterend', `<div class="admin-quick" data-view="overview">
      <button type="button" data-go="manage-bins" data-click="admin-add-bin">${ICON('<path d="M12 5v14M5 12h14"/>')}Add dustbin</button>
      <button type="button" data-go="manage-records" data-click="admin-add-record">${ICON('<path d="m5 12 5 5 9-10"/>')}Add record</button>
      <button type="button" data-go="reports">${ICON('<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>')}Review reports<i class="admin-badge" hidden></i></button></div>`);
    main.querySelector('.admin-quick').addEventListener('click', e => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      location.hash = '#' + b.dataset.go;
      if (b.dataset.click) setTimeout(() => $(b.dataset.click)?.click(), 80);
    });
  }

  function show() {
    const id = (location.hash || '#overview').slice(1);
    const view = views[id] ? id : 'overview';
    main.dataset.view = view;
    main.querySelectorAll(':scope > [data-view]').forEach(el => { el.hidden = el.dataset.view !== 'all' && el.dataset.view !== view; });
    document.querySelectorAll('.admin-side a[href^="#"]').forEach(a => a.classList.toggle('selected', a.getAttribute('href') === '#' + view));
    document.querySelectorAll('[data-admin-tab]').forEach(a => { const on = a.dataset.adminTab === view; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', show);
  show();

  /* friendly greeting on the overview */
  function greet() {
    const p = intro?.querySelector('p'); const who = $('admin-welcome')?.textContent || '';
    if (!p || !who || /^Welcome/.test(who)) return;
    const hour = new Date().getHours(), part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = who.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    p.textContent = `${part}, ${name}. ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  }
  if ($('admin-welcome')) new MutationObserver(greet).observe($('admin-welcome'), { childList: true, characterData: true, subtree: true });
  greet();

  /* ---------- tables: phone labels, colour-coded statuses, pending badge ---------- */
  const toneOf = t => { t = String(t).toLowerCase();
    if (/clean|available|verified|resolved|active|confirmed/.test(t)) return 'good';
    if (/full|overflow|damag|inactive|unverified/.test(t)) return 'bad';
    if (/maint|pending/.test(t)) return 'warn';
    if (/submitted|review|assigned|progress/.test(t)) return 'info';
    if (/reject|closed/.test(t)) return 'muted';
    return 'good'; };
  function decorate(table) {
    const heads = [...table.querySelectorAll('thead th')].map(t => t.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (!td.dataset.label && heads[i]) td.dataset.label = heads[i]; }));
    table.querySelectorAll('.status').forEach(s => { s.dataset.tone = toneOf(s.textContent); });
    table.querySelectorAll('select.admin-report-status').forEach(s => { s.dataset.tone = toneOf(s.value); });
  }
  const pendingCount = () => [...document.querySelectorAll('#admin-reports-table select.admin-report-status')].filter(s => !/resolved|rejected/.test(s.value)).length;
  function badges() {
    const n = pendingCount();
    document.querySelectorAll('[data-admin-tab="reports"] .admin-badge, .admin-quick .admin-badge').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
    document.querySelectorAll('.admin-side a[href="#reports"]').forEach(a => { let b = a.querySelector('.admin-badge'); if (!b) { b = document.createElement('i'); b.className = 'admin-badge'; a.appendChild(b); } b.textContent = n; b.hidden = !n; });
  }
  document.querySelectorAll('.admin-table-panel table').forEach(table => {
    decorate(table);
    const body = table.querySelector('tbody');
    if (body) new MutationObserver(() => { decorate(table); badges(); }).observe(body, { childList: true });
    table.addEventListener('change', e => { if (e.target.matches('select.admin-report-status')) { e.target.dataset.tone = toneOf(e.target.value); badges(); } });
  });
  badges();

  document.querySelector('.admin-logout-top')?.addEventListener('click', () => $('admin-logout')?.click());
})();
