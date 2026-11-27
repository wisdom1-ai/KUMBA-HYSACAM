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
