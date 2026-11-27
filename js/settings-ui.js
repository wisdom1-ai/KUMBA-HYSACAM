/* HYSACAM Settings: theme switch (device only, no backend). */
(function () {
  var KEY = 'hysacam-theme', root = document.documentElement;
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
  function init() {
    mark(get());
    document.querySelectorAll('#theme-seg button').forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-theme')); });
    });
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (get() === 'system') apply('system');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
