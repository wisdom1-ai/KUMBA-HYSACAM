/* HYSACAM Settings: theme switch, touch ripple and entrance order. Device only, no backend. */
(function () {
  var KEY = 'hysacam-theme', root = document.documentElement;
  var TAPPABLE = 'a.set-row,button.set-row,.set-details>summary,.set-quick a,.gs-btn,.button,.set-btn,.panel-link,.signout-btn,.seg button,.tseg button,.set-side a';

  function get() { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } }
  function apply(m) {
    var dark = m === 'dark' || (m !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  function mark(m) {
    document.querySelectorAll('#theme-seg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-theme') === m));
    });
  }
  function set(m) { try { localStorage.setItem(KEY, m); } catch (e) {} apply(m); mark(m); }

  function reduced() {
    return (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      root.classList.contains('reduce-motion') || root.classList.contains('reduced-motion');
  }

  // Touch / click ripple on every button-like element
  function ripple(e) {
    if (reduced() || !e.target.closest) return;
    var t = e.target.closest(TAPPABLE);
    if (!t || t.disabled) return;
    var r = t.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
    var x = (e.clientX || r.left + r.width / 2) - r.left - s / 2;
    var y = (e.clientY || r.top + r.height / 2) - r.top - s / 2;
    var d = document.createElement('span');
    d.className = 'ripple' + (t.matches('.gs-btn,.button,.set-btn') ? '' : ' dark');
    d.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + x + 'px;top:' + y + 'px';
    t.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 650);
  }

  function init() {
    mark(get());
    document.querySelectorAll('#theme-seg button').forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-theme')); });
    });
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (get() === 'system') apply('system');
    });
    // order for the page entrance animation
    document.querySelectorAll('.set-content>*').forEach(function (el, i) {
      el.style.setProperty('--i', Math.min(i, 12));
    });
    document.addEventListener('pointerdown', ripple, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* HYSACAM Settings: confirm dialogs, tap feedback and busy state.
   Device only. It never replaces the original button logic: after you confirm,
   the original click is replayed so the existing scripts run exactly as before. */
(function () {
  var root = document.documentElement, box = null, pending = null, bypass = false;
  var TEXT = {
    'profile-signout': ['Sign out?', 'You will need to sign in again to manage your profile and reports.', 'Sign out'],
    'signout-all': ['Sign out on all devices?', 'This ends your session on every phone and computer, including this one.', 'Sign out everywhere'],
    'clear-local-data': ['Clear saved data?', 'This removes cached reports and read updates on this device. You stay signed in.', 'Clear data']
  };

  function build() {
    box = document.createElement('div');
    box.className = 'cf'; box.hidden = true;
    box.innerHTML = '<div class="cf-card" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d">' +
      '<div class="cf-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-out"/></svg></div>' +
      '<h3 id="cf-t"></h3><p id="cf-d"></p>' +
      '<div class="cf-actions"><button type="button" class="cf-no">Cancel</button><button type="button" class="cf-ok"></button></div></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) { if (e.target === box) cancel(); });
    box.querySelector('.cf-no').addEventListener('click', cancel);
    box.querySelector('.cf-ok').addEventListener('click', function () {
      var el = pending; pending = null; box.hidden = true;
      if (!el) return;
      var realConfirm = window.confirm;
      bypass = true;
      try {
        window.confirm = function () { return true; };      // we already asked, so skip the page's own prompt
        el.click();
        if (el.id === 'clear-local-data') el.click();       // that button needs a second tap to confirm
      } finally { window.confirm = realConfirm; bypass = false; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) cancel(); });
  }
  function cancel() {
    box.hidden = true;
    if (pending) { pending.focus(); pending = null; }
  }

  // Ask first, then replay the original click
  window.addEventListener('click', function (e) {
    if (bypass || !e.target.closest) return;
    var el = e.target.closest('#profile-signout,#signout-all,#clear-local-data');
    if (!el) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!box) build();
    var t = TEXT[el.id]; pending = el;
    box.querySelector('#cf-t').textContent = t[0];
    box.querySelector('#cf-d').textContent = t[1];
    box.querySelector('.cf-ok').textContent = t[2];
    box.querySelector('use').setAttribute('href', el.id === 'clear-local-data' ? '#i-trash' : '#i-out');
    box.hidden = false;
    box.querySelector('.cf-no').focus();
  }, true);

  // Light vibration on Android when a control is tapped
  document.addEventListener('click', function (e) {
    if (!navigator.vibrate || root.classList.contains('reduce-motion') || !e.target.closest) return;
    if (e.target.closest('.toggle-line input,.seg button,.tseg button,.button,.set-btn,.gs-btn,.signout-btn,.panel-link')) navigator.vibrate(8);
  }, true);

  // Spinner only while the form button is genuinely disabled after a submit
  var armed = new WeakSet();
  document.addEventListener('submit', function (e) {
    var b = e.target.querySelector && e.target.querySelector('.button');
    if (b) armed.add(b);
  }, true);
  if (window.MutationObserver) {
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        var b = m.target;
        if (!b.classList || !b.classList.contains('button')) return;
        if (b.disabled && armed.has(b)) b.classList.add('is-busy');
        else if (!b.disabled) { b.classList.remove('is-busy'); armed.delete(b); }
      });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['disabled'], subtree: true });
  }
})();
