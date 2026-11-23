/* Admin dashboard: one section at a time (like the main app pages), phone-friendly tables, top logout button */
(() => {
  'use strict';
  const main = document.querySelector('.admin-main');
  if (!main) return;
  const $ = id => document.getElementById(id);
  const views = { overview: 'overview', 'manage-bins': 'manage-bins', 'manage-records': 'manage-records', users: 'users', reports: 'reports', settings: 'settings' };

  // Tag every block with the view it belongs to
  const intro = main.querySelector(':scope > .admin-dashboard-intro');
  [intro, $('overview'), main.querySelector('.admin-analytics-grid')].forEach(el => el && (el.dataset.view = 'overview'));
  Object.keys(views).filter(k => k !== 'overview').forEach(k => { const el = $(k); if (el) el.dataset.view = k; });
  main.querySelectorAll(':scope > .admin-title, :scope > .admin-dashboard-footer').forEach(el => el.dataset.view = 'all');

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

  // Phone cards: copy each column heading onto its cell (rows are drawn by admin-dashboard.js)
  const label = table => {
    const heads = [...table.querySelectorAll('thead th')].map(t => t.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (!td.dataset.label && heads[i]) td.dataset.label = heads[i]; }));
  };
  document.querySelectorAll('.admin-table-panel table').forEach(table => {
    label(table);
    const body = table.querySelector('tbody');
    if (body) new MutationObserver(() => label(table)).observe(body, { childList: true });
  });

  document.querySelector('.admin-logout-top')?.addEventListener('click', () => $('admin-logout')?.click());
})();
