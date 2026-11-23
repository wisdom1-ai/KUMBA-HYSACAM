/* HYSACAM Dustbin Directory (advanced)
   Live data straight from the database, instant saved list, search, status/area filters, sorting (incl. nearest to me),
   saved favourites, cards/compact views, details sheet, share/copy/directions, CSV export, auto refresh, shareable links. */
(function () {
  'use strict';
  var API = 'https://edylcpvigtmyuehjeibe.supabase.co/rest/v1/';
  var KEY = 'sb_publishable_M2JBYBmf8mLJbUS88et3Ww_K3spt6Bh';
  var CK = 'hysacam-directory-cache-v2', CK1 = 'hysacam-directory-cache-v1', SK = 'hysacam-directory-saved-v1', LK = 'hysacam-directory-loc-v1';
  var PAGE = 10, REFRESH_MS = 90000, DAY = 864e5;
  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('dp-list'), moreEl = $('dp-more'), countEl = $('dp-count'), updEl = $('dp-updated'), searchEl = $('dp-search'), clearEl = $('dp-clear'),
      areaEl = $('dp-area'), sortEl = $('dp-sort'), chipsEl = $('dp-chips'), dlg = $('dp-dialog'), panelEl = $('dp-panel'), ftEl = $('dp-ft'), fcEl = $('dp-fcount'),
      statsEl = $('dp-stats'), healthEl = $('dp-health'), legendEl = $('dp-legend'), areasEl = $('dp-areas-list'), toastEl = $('dp-toast'), offEl = $('dp-offline');
  if (!listEl) return;

  var bins = [], last = {}, cnt = {}, fetchedAt = 0, loc = null, timer = 0, toastT = 0, busy = false;
  var saved = []; try { saved = JSON.parse(localStorage.getItem(SK) || '[]') || []; } catch (e) {}
  try { loc = JSON.parse(sessionStorage.getItem(LK) || 'null'); } catch (e) {}
  var st = { q: '', status: 'all', area: 'all', sort: 'name', view: 'cards', shown: PAGE };

  var LABEL = { available: 'Available', full: 'Full', pending: 'Pending collection', maintenance: 'Maintenance' };
  var ORDER = { full: 0, maintenance: 1, pending: 2, available: 3 };
  var ICO = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    nav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>'
  };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var kind = function (s) { var v = String(s || '').toLowerCase(); return /full|overflow/.test(v) ? 'full' : /maint|broken|damage/.test(v) ? 'maintenance' : /pending|collect/.test(v) ? 'pending' : 'available'; };
  var hasGeo = function (b) { return b.latitude != null && b.longitude != null && b.latitude !== '' && b.longitude !== '' && isFinite(+b.latitude) && isFinite(+b.longitude) && Math.abs(+b.latitude) <= 90 && Math.abs(+b.longitude) <= 180; };
  var code = function (b) { return b.bin_code || String(b.id || '').slice(0, 8) || 'ID'; };
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };

  /* ---------- helpers ---------- */
  function km(b) {
    if (!loc || !hasGeo(b)) return null;
    var R = 6371, toR = Math.PI / 180, dLat = (b.latitude - loc.lat) * toR, dLng = (b.longitude - loc.lng) * toR;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(loc.lat * toR) * Math.cos(b.latitude * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function distLabel(d) { return d == null ? '' : d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(d < 10 ? 1 : 0) + ' km'; }
  function cleanedLabel(b) {
    var x = last[String(b.id)]; if (!x) return 'No cleaning record yet';
    var d = new Date(x); if (isNaN(d)) return 'No cleaning record yet';
    var days = Math.floor((Date.now() - d.getTime()) / DAY);
    return 'Cleaned ' + (days < 1 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? days + ' days ago' : 'on ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  }
  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; }, 2600); }
  function ago(ts) { if (!ts) return ''; var m = Math.floor((Date.now() - ts) / 60000); return 'Updated ' + (m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.floor(m / 60) + ' h ago'); }
  function isSaved(id) { return saved.indexOf(String(id)) > -1; }

  /* ---------- filtering + sorting ---------- */
  function filtered() {
    var q = st.q.toLowerCase();
    var out = bins.filter(function (b) {
      if (st.status === 'saved') { if (!isSaved(b.id)) return false; }
      else if (st.status !== 'all' && kind(b.status) !== st.status) return false;
      if (st.area !== 'all' && (b.area || '') !== st.area) return false;
      return !q || [b.name, b.bin_code, b.area, b.status, b.id].join(' ').toLowerCase().indexOf(q) > -1;
    });
    var nm = function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); };
    var by = {
      name: nm,
      area: function (a, b) { return String(a.area || '').localeCompare(String(b.area || '')) || nm(a, b); },
      status: function (a, b) { return ORDER[kind(a.status)] - ORDER[kind(b.status)] || nm(a, b); },
      cleaned: function (a, b) { return new Date(last[String(b.id)] || 0) - new Date(last[String(a.id)] || 0); },
      nearest: function (a, b) { var x = km(a), y = km(b); return (x == null ? 1e9 : x) - (y == null ? 1e9 : y) || nm(a, b); }
    };
    return out.sort(by[st.sort] || nm);
  }

  /* ---------- drawing ---------- */
  function drawHero() {
    var n = { available: 0, full: 0, pending: 0, maintenance: 0 }, since = Date.now() - 30 * DAY, fresh = 0;
    bins.forEach(function (b) { n[kind(b.status)]++; var d = last[String(b.id)]; if (d && new Date(d).getTime() >= since) fresh++; });
    var t = bins.length || 1, areas = {}; bins.forEach(function (b) { if (b.area) areas[b.area] = 1; });
    var na = Object.keys(areas).length;
    $('dp-sub').textContent = bins.length ? plural(bins.length, 'collection point') + ' across ' + plural(na || 1, 'area') + ' in Kumba' : 'Find every HYSACAM collection point in Kumba';
    statsEl.innerHTML = [[bins.length, 'Total'], [n.available, 'Available'], [n.full + n.maintenance + n.pending, 'Need attention'], [fresh, 'Cleaned (30d)']].map(function (s) { return '<div class="dp-stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
    healthEl.innerHTML = ['available', 'pending', 'maintenance', 'full'].map(function (k) { return '<i class="h-' + k + '" style="width:' + (bins.length ? n[k] / t * 100 : 0) + '%" title="' + LABEL[k] + ': ' + n[k] + '"></i>'; }).join('');
    var col = { available: '#4ade80', pending: '#facc15', maintenance: '#fb923c', full: '#f87171' };
    legendEl.innerHTML = ['available', 'pending', 'maintenance', 'full'].map(function (k) { return '<span><i style="background:' + col[k] + '"></i>' + LABEL[k] + ' ' + n[k] + '</span>'; }).join('');
  }
  function drawChips() {
    var n = { all: bins.length, available: 0, full: 0, pending: 0, maintenance: 0, saved: 0 };
    bins.forEach(function (b) { n[kind(b.status)]++; if (isSaved(b.id)) n.saved++; });
    var defs = [['all', 'All'], ['available', 'Available'], ['full', 'Full'], ['pending', 'Pending'], ['maintenance', 'Maintenance'], ['saved', 'Saved']];
    chipsEl.innerHTML = defs.map(function (d) {
      return '<button type="button" class="dp-chip' + (st.status === d[0] ? ' on' : '') + '" data-status="' + d[0] + '" aria-pressed="' + (st.status === d[0]) + '">' + (d[0] === 'saved' ? ICO.star : '') + d[1] + '<b>' + n[d[0]] + '</b></button>';
    }).join('');
  }
  function drawAreas() {
    var c = {}; bins.forEach(function (b) { if (b.area) c[b.area] = (c[b.area] || 0) + 1; });
    var names = Object.keys(c).sort(), max = 1; names.forEach(function (a) { if (c[a] > max) max = c[a]; });
    areaEl.innerHTML = '<option value="all">All areas</option>' + names.map(function (a) { return '<option value="' + esc(a) + '"' + (st.area === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('');
    var top = names.slice().sort(function (a, b) { return c[b] - c[a]; }).slice(0, 6);
    areasEl.innerHTML = top.length ? top.map(function (a) { return '<button type="button" class="dp-area-btn' + (st.area === a ? ' on' : '') + '" data-area="' + esc(a) + '"><span>' + esc(a) + '<em>' + c[a] + '</em></span><i style="width:' + Math.max(8, c[a] / max * 100) + '%"></i></button>'; }).join('') : '';
    $('dp-areas').hidden = !top.length;
  }
  function card(b) {
    var k = kind(b.status), d = km(b), sv = isSaved(b.id);
    return '<article class="dp-card k-' + k + '"><div class="dp-ico" aria-hidden="true">' + ICO.pin + '</div><div class="dp-body">'
      + '<div class="dp-top"><h3>' + esc(b.name || 'Collection point') + '</h3><button type="button" class="dp-star" data-star="' + esc(b.id) + '" aria-pressed="' + sv + '" aria-label="' + (sv ? 'Remove from saved' : 'Save this dustbin') + '">' + ICO.star + '</button></div>'
      + '<p class="dp-area">' + ICO.pin + esc(b.area || 'Area not specified') + ', Kumba' + (d != null ? ' <span class="dp-dist">' + distLabel(d) + ' away</span>' : '') + '</p>'
      + '<p class="dp-meta">' + ICO.clock + esc(cleanedLabel(b)) + '<span class="dp-id">' + esc(code(b)) + '</span></p>'
      + '<div class="dp-bottom"><span class="dp-pill k-' + k + '"><i></i>' + LABEL[k] + '</span><div class="dp-actions"><button type="button" class="dp-btn" data-open="' + esc(b.id) + '">Details</button>'
      + (hasGeo(b) ? '<a class="dp-btn solid" href="map.html?bin=' + encodeURIComponent(b.id) + '">Map</a>' : '') + '</div></div></div></article>';
  }
  function filterCount() { return (st.area !== 'all' ? 1 : 0) + (st.sort !== 'name' ? 1 : 0) + (st.view !== 'cards' ? 1 : 0); }
  function syncUrl() {
    if (!window.history || !history.replaceState) return;
    var p = [];
    if (st.q) p.push('q=' + encodeURIComponent(st.q));
    if (st.status !== 'all') p.push('status=' + st.status);
    if (st.area !== 'all') p.push('area=' + encodeURIComponent(st.area));
    if (st.sort !== 'name') p.push('sort=' + st.sort);
    if (st.view !== 'cards') p.push('view=' + st.view);
    try { history.replaceState(null, '', location.pathname + (p.length ? '?' + p.join('&') : '')); } catch (e) {}
  }
  function render() {
    drawChips(); clearEl.classList.toggle('on', !!st.q);
    var n = filterCount(); fcEl.hidden = !n; fcEl.textContent = n;
    listEl.className = 'dp-list' + (st.view === 'compact' ? ' compact' : '');
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === st.view)); });
    var all = filtered(), shown = all.slice(0, st.shown);
    if (!all.length) {
      var none = !bins.length, sv = st.status === 'saved';
      listEl.innerHTML = '<div class="dp-empty"><b>' + (none ? 'No dustbins registered yet' : sv ? 'No saved dustbins yet' : 'No matching locations') + '</b><p>' + (none ? 'Registered collection points will appear here when available' : sv ? 'Tap the star on a dustbin to keep it here' : 'Try another name, ID or area, or clear the filters') + '</p>' + (none ? '' : '<button type="button" id="dp-reset">' + (sv ? 'Show all' : 'Clear filters') + '</button>') + '</div>';
      moreEl.hidden = true; countEl.textContent = none ? '' : '0 collection points found'; syncUrl(); return;
    }
    listEl.innerHTML = shown.map(card).join('');
    countEl.textContent = 'Showing ' + shown.length + ' of ' + plural(all.length, 'collection point');
    moreEl.hidden = all.length <= shown.length;
    if (!moreEl.hidden) $('dp-more-btn').textContent = 'Show more (' + (all.length - shown.length) + ' left)';
    syncUrl();
  }
  function setData(b, l, c, t) { bins = b || []; last = l || {}; cnt = c || {}; fetchedAt = t || Date.now(); drawHero(); drawAreas(); render(); updEl.textContent = ago(fetchedAt); }

  /* ---------- details sheet ---------- */
  function open(id) {
    var b = bins.filter(function (x) { return String(x.id) === String(id); })[0]; if (!b) return;
    var k = kind(b.status), d = km(b), geo = hasGeo(b);
    $('dp-dtitle').textContent = b.name || 'Collection point';
    $('dp-dico').innerHTML = ICO.pin; $('dp-dhead').className = 'dp-dhead k-' + k;
    $('dp-dpill').innerHTML = '<span class="dp-pill k-' + k + '"><i></i>' + LABEL[k] + '</span>';
    $('dp-dstats').innerHTML = '<div class="dp-dstat"><b>' + (cnt[String(b.id)] || 0) + '</b><span>Cleanings in 30 days</span></div><div class="dp-dstat"><b>' + esc(cleanedLabel(b).replace(/^Cleaned /, '')) + '</b><span>Last cleaned</span></div>';
    var rows = [['Dustbin ID', code(b)], ['Area', (b.area || 'Not specified') + ', Kumba'], ['Status', LABEL[k]], ['Coordinates', geo ? (+b.latitude).toFixed(5) + ', ' + (+b.longitude).toFixed(5) : 'Not available']];
    if (d != null) rows.push(['Distance from you', distLabel(d)]);
    $('dp-rows').innerHTML = rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('');
    $('dp-dactions').innerHTML =
      (geo ? '<a class="dp-btn solid" href="map.html?bin=' + encodeURIComponent(b.id) + '">' + ICO.map + 'View on map</a><a class="dp-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + (+b.latitude) + ',' + (+b.longitude) + '">' + ICO.nav + 'Directions</a>' : '')
      + '<button type="button" class="dp-btn" data-share="' + esc(b.id) + '">' + ICO.share + 'Share</button>'
      + '<button type="button" class="dp-btn" data-copy="' + esc(code(b)) + '">' + ICO.copy + 'Copy ID</button>'
      + '<a class="dp-btn wide" href="report.html">' + ICO.flag + 'Report an issue</a>';
    if (dlg.showModal) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } } else dlg.setAttribute('open', '');
  }
  function closeDlg() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  function copyText(t, ok) {
    var done = function () { toast(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { fallbackCopy(t, done); });
    else fallbackCopy(t, done);
  }
  function fallbackCopy(t, cb) { var a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(a); cb(); }
  function share(id) {
    var b = bins.filter(function (x) { return String(x.id) === String(id); })[0]; if (!b) return;
    var url = location.origin + '/map.html?bin=' + encodeURIComponent(b.id), text = (b.name || 'Dustbin') + ' (' + code(b) + ') in ' + (b.area || 'Kumba') + ' - HYSACAM Kumba Tracker';
    if (navigator.share) navigator.share({ title: b.name || 'HYSACAM dustbin', text: text, url: url }).catch(function () {});
    else copyText(text + ' ' + url, 'Link copied');
  }

  /* ---------- tools ---------- */
  function near() {
    if (!navigator.geolocation) { toast('Location is not available on this device'); sortEl.value = st.sort === 'nearest' ? 'name' : st.sort; return; }
    var btn = $('dp-near'); btn.setAttribute('aria-busy', 'true'); toast('Finding your location…');
    navigator.geolocation.getCurrentPosition(function (p) {
      btn.removeAttribute('aria-busy'); loc = { lat: p.coords.latitude, lng: p.coords.longitude };
      try { sessionStorage.setItem(LK, JSON.stringify(loc)); } catch (e) {}
      st.sort = 'nearest'; sortEl.value = 'nearest'; st.shown = PAGE; render(); toast('Sorted by distance from you');
    }, function () { btn.removeAttribute('aria-busy'); toast('Allow location access to sort by distance'); if (st.sort === 'nearest') { st.sort = 'name'; sortEl.value = 'name'; render(); } }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 });
  }
  function exportCsv() {
    var rows = filtered(); if (!rows.length) { toast('Nothing to export'); return; }
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [['Name', 'ID', 'Area', 'Status', 'Latitude', 'Longitude', 'Last cleaned'].join(',')].concat(rows.map(function (b) {
      return [b.name, code(b), b.area, LABEL[kind(b.status)], hasGeo(b) ? b.latitude : '', hasGeo(b) ? b.longitude : '', last[String(b.id)] ? new Date(last[String(b.id)]).toISOString().slice(0, 10) : ''].map(q).join(',');
    }));
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hysacam-dustbins-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    toast(plural(rows.length, 'dustbin') + ' exported');
  }

  /* ---------- data ---------- */
  function get(path) { return fetch(API + path, { headers: { apikey: KEY, Accept: 'application/json' } }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function load(manual) {
    if (busy) return; busy = true; var rb = $('dp-refresh'); rb.setAttribute('aria-busy', 'true');
    Promise.all([
      get('bins?select=id,bin_code,name,area,latitude,longitude,status&order=name.asc&limit=1000'),
      get('cleaning_records?select=bin_id,cleaned_at&verified=eq.true&order=cleaned_at.desc&limit=1000').catch(function () { return []; })
    ]).then(function (res) {
      var l = {}, c = {}, since = Date.now() - 30 * DAY;
      res[1].forEach(function (r) { var k = String(r.bin_id); if (!l[k]) l[k] = r.cleaned_at; if (new Date(r.cleaned_at).getTime() >= since) c[k] = (c[k] || 0) + 1; });
      setData(res[0], l, c, Date.now()); offEl.hidden = true;
      try { localStorage.setItem(CK, JSON.stringify({ bins: res[0], last: l, cnt: c, t: Date.now() })); } catch (e) {}
      if (manual) toast('Directory updated');
      openFromUrl();
    }).catch(function () {
      if (!bins.length) { listEl.innerHTML = '<div class="dp-empty"><b>Unable to load locations</b><p>Please check your connection and try again</p><button type="button" id="dp-retry">Try again</button></div>'; countEl.textContent = ''; }
      else { offEl.hidden = false; if (manual) toast('Could not refresh. Showing your saved list'); }
    }).then(function () { busy = false; rb.removeAttribute('aria-busy'); });
  }
  var pendingOpen = null;
  function openFromUrl() { if (pendingOpen) { var id = pendingOpen; pendingOpen = null; open(id); } }

  /* ---------- start ---------- */
  (function init() {
    var p = {}; (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) { if (!kv) return; var i = kv.indexOf('='); try { p[decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1)); } catch (e) {} });
    if (p.q) { st.q = p.q; searchEl.value = p.q; }
    if (/^(available|full|pending|maintenance|saved)$/.test(p.status || '')) st.status = p.status;
    if (p.area) st.area = p.area;
    if (/^(name|area|status|cleaned|nearest)$/.test(p.sort || '')) st.sort = p.sort;
    if (p.view === 'compact') st.view = 'compact';
    if (p.open) pendingOpen = p.open;
    sortEl.value = st.sort;
    try { var c = JSON.parse(localStorage.getItem(CK) || 'null') || JSON.parse(localStorage.getItem(CK1) || 'null'); if (c && c.bins && c.bins.length) setData(c.bins, c.last, c.cnt, c.t || 0); } catch (e) {}
    if (st.sort === 'nearest' && !loc) { st.sort = 'name'; sortEl.value = 'name'; }
    load(false);
  })();

  /* ---------- events ---------- */
  searchEl.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { st.q = searchEl.value.trim(); st.shown = PAGE; render(); }, 120); });
  clearEl.addEventListener('click', function () { searchEl.value = ''; st.q = ''; st.shown = PAGE; render(); searchEl.focus(); });
  chipsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-status]'); if (!b) return; st.status = b.dataset.status; st.shown = PAGE; render(); });
  areaEl.addEventListener('change', function () { st.area = areaEl.value; st.shown = PAGE; drawAreas(); render(); });
  areasEl.addEventListener('click', function (e) { var b = e.target.closest('[data-area]'); if (!b) return; st.area = st.area === b.dataset.area ? 'all' : b.dataset.area; st.shown = PAGE; drawAreas(); render(); });
  sortEl.addEventListener('change', function () { if (sortEl.value === 'nearest' && !loc) { near(); return; } st.sort = sortEl.value; st.shown = PAGE; render(); });
  $('dp-near').addEventListener('click', near);
  $('dp-export').addEventListener('click', exportCsv);
  $('dp-refresh').addEventListener('click', function () { load(true); });
  ftEl.addEventListener('click', function () { var o = !panelEl.classList.contains('open'); panelEl.classList.toggle('open', o); ftEl.setAttribute('aria-expanded', String(o)); });
  document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { st.view = b.dataset.view; render(); }); });
  $('dp-more-btn').addEventListener('click', function () { st.shown += PAGE; render(); });
  listEl.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'); if (o) { open(o.dataset.open); return; }
    var s = e.target.closest('[data-star]');
    if (s) { var id = String(s.dataset.star), i = saved.indexOf(id); if (i > -1) saved.splice(i, 1); else saved.push(id); try { localStorage.setItem(SK, JSON.stringify(saved)); } catch (x) {} toast(i > -1 ? 'Removed from saved' : 'Saved to your list'); if (st.status === 'saved') render(); else { s.setAttribute('aria-pressed', String(i < 0)); drawChips(); } return; }
    if (e.target.id === 'dp-retry') { listEl.innerHTML = '<div class="dp-sk"></div><div class="dp-sk"></div>'; load(false); return; }
    if (e.target.id === 'dp-reset') { st.q = ''; st.status = 'all'; st.area = 'all'; searchEl.value = ''; areaEl.value = 'all'; drawAreas(); render(); }
  });
  $('dp-dclose').addEventListener('click', closeDlg);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) { closeDlg(); return; } var sh = e.target.closest('[data-share]'), cp = e.target.closest('[data-copy]'); if (sh) share(sh.dataset.share); if (cp) copyText(cp.dataset.copy, 'ID copied'); });
  document.addEventListener('keydown', function (e) { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && !dlg.open) { e.preventDefault(); searchEl.focus(); } });
  window.addEventListener('online', function () { load(false); });
  window.addEventListener('offline', function () { offEl.hidden = false; });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - fetchedAt > 60000) load(false); });
  setInterval(function () { updEl.textContent = ago(fetchedAt); if (!document.hidden && Date.now() - fetchedAt > REFRESH_MS) load(false); }, 30000);
})();
