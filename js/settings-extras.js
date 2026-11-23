"use strict";

/* HYSACAM Kumba Tracker: settings page extras
   Works alongside account-pages.js (profile, notifications, motion, compact layout,
   clear data, sign out). This file adds: instant hero state, deep links to sections,
   default map view, location access, share and install. */
(function () {
  const $ = (id) => document.getElementById(id);
  const html = document.documentElement;
  const KEY_MAP = "hysacam-pref-map-view";

  function flash(id, text, isErr) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("err", !!isErr);
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ""; }, 4500);
  }

  /* ---------- Hero: show real content as soon as it is known ---------- */
  (function hero() {
    const el = $("set-hero");
    if (!el) return;
    const nm = $("settings-user-name");
    const initial = nm ? nm.textContent : "";
    let mo = null, co = null;
    const ready = () => { el.classList.add("is-ready"); if (mo) mo.disconnect(); if (co) co.disconnect(); };
    if (html.classList.contains("auth-no")) { ready(); return; }
    if (nm) { mo = new MutationObserver(() => { if (nm.textContent !== initial) ready(); }); mo.observe(nm, { childList: true, characterData: true, subtree: true }); }
    co = new MutationObserver(() => { if (html.classList.contains("auth-no")) ready(); });
    co.observe(html, { attributes: true, attributeFilter: ["class"] });
    setTimeout(ready, 3500);
  })();

  /* ---------- Deep links: settings.html#profile, #notifications, #privacy ... ---------- */
  function openFromHash() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!h) return;
    const el = $(h);
    if (el && el.tagName === "DETAILS") {
      el.open = true;
      setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
    }
  }
  openFromHash();
  window.addEventListener("hashchange", openFromHash);

  /* ---------- Default map view ---------- */
  (function mapView() {
    const btns = document.querySelectorAll("#map-view-seg button");
    if (!btns.length) return;
    const get = () => { try { return localStorage.getItem(KEY_MAP) === "satellite" ? "satellite" : "street"; } catch { return "street"; } };
    const paint = () => { const v = get(); btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v))); };
    paint();
    btns.forEach((b) => b.addEventListener("click", () => {
      try { localStorage.setItem(KEY_MAP, b.dataset.view); } catch { flash("map-pref-msg", "Could not save on this device", true); return; }
      paint();
      flash("map-pref-msg", b.dataset.view === "satellite" ? "Saved · the map will open in satellite view" : "Saved · the map will open in street view");
    }));
  })();

  /* ---------- Location access ---------- */
  (function location_() {
    const badge = $("loc-badge"), btn = $("loc-enable"), hint = $("loc-hint");
    if (!badge || !btn) return;
    const paint = (state) => {
      badge.className = "badge";
      if (state === "granted") { badge.classList.add("ok"); badge.textContent = "Allowed"; btn.textContent = "Test my location"; hint.textContent = "Used only to show the nearest dustbin to you"; }
      else if (state === "denied") { badge.classList.add("bad"); badge.textContent = "Blocked"; btn.textContent = "Try again"; hint.textContent = "Location is blocked. Allow it for this site in your browser or phone settings, then try again"; }
      else if (state === "prompt") { badge.classList.add("warn"); badge.textContent = "Not asked yet"; btn.textContent = "Allow location"; hint.textContent = "Allow location to find the dustbin nearest to you"; }
      else { badge.textContent = "Unknown"; btn.textContent = "Test my location"; hint.textContent = "Your browser does not report location status"; }
    };
    if (!navigator.geolocation) { badge.textContent = "Unavailable"; btn.disabled = true; hint.textContent = "Location is not available in this browser"; return; }
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then((p) => { paint(p.state); p.onchange = () => paint(p.state); }).catch(() => paint("unknown"));
    } else paint("unknown");
    btn.addEventListener("click", () => {
      btn.disabled = true;
      flash("loc-msg", "Finding your location…");
      navigator.geolocation.getCurrentPosition(
        () => { btn.disabled = false; paint("granted"); flash("loc-msg", "Location works"); },
        (err) => { btn.disabled = false; if (err.code === 1) paint("denied"); flash("loc-msg", err.code === 1 ? "Location permission was denied" : "Could not find your location", true); },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  })();

  /* ---------- Share ---------- */
  (function share() {
    const btn = $("share-app");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const data = { title: "HYSACAM Kumba Tracker", text: "Find dustbins and report waste issues in Kumba", url: location.origin + "/" };
      try {
        if (navigator.share) await navigator.share(data);
        else if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(data.url); flash("support-msg", "Link copied"); }
        else flash("support-msg", "Copy this link: " + data.url);
      } catch (e) { /* the person closed the share sheet */ }
    });
  })();

  /* ---------- Install ---------- */
  (function install() {
    const row = $("install-row"), sub = $("install-sub");
    if (!row) return;
    const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    if (standalone()) return;
    let deferred = null;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) { row.hidden = false; if (sub) sub.textContent = "Tap Share, then Add to Home Screen"; }
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; row.hidden = false; });
    window.addEventListener("appinstalled", () => { row.hidden = true; });
    row.addEventListener("click", () => {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(() => { deferred = null; row.hidden = true; }).catch(() => {});
      } else flash("support-msg", "Tap Share, then Add to Home Screen");
    });
  })();
})();
