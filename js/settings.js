"use strict";

/* HYSACAM Kumba Tracker: Settings page (self-contained)
   Replaces account-pages.js and settings-extras.js on settings.html.
   Needs: prefs.js (in <head>), supabase.js (defines supabaseClient). */
(function () {
  const $ = (id) => document.getElementById(id);
  const html = document.documentElement;
  const AUTH_CACHE = "hysacam-auth-cache";
  const MAP_KEY = "hysacam-pref-map-view";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const withTimeout = (p, ms) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  async function waitFor(test, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { const v = test(); if (v) return v; } catch (e) {} await sleep(100); }
    try { return test(); } catch (e) { return null; }
  }
  const getClient = () => {
    try { return (typeof supabaseClient !== "undefined" && supabaseClient) || window.supabaseClient || null; }
    catch (e) { return window.supabaseClient || null; }
  };

  /* Short message that returns to its original text */
  function flash(id, text, isErr) {
    const el = $(id);
    if (!el) return;
    if (el._orig === undefined) el._orig = el.textContent;
    el.textContent = text;
    el.classList.toggle("err", !!isErr);
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = el._orig; el.classList.remove("err"); }, 4500);
  }
  function formMsg(text, ok) {
    const el = $("pf-msg");
    if (!el) return;
    el.textContent = text;
    el.style.color = text ? (ok ? "#0b6b3c" : "#c62828") : "";
  }

  const pick = (o, keys) => {
    if (!o) return "";
    for (const k of keys) if (o[k] != null && String(o[k]).trim() !== "") return String(o[k]).trim();
    return "";
  };
  const titleCase = (s) => String(s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const initials = (name, email) => {
    const p = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return String(email || "?").charAt(0).toUpperCase();
  };
  const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

  const NAME_KEYS = ["full_name", "name", "display_name"];
  const PHONE_KEYS = ["phone", "phone_number", "telephone"];
  const ROLE_KEYS = ["role", "account_type", "user_role"];

  let client = null, user = null, row = null, dirty = false;

  /* ---------- hero ---------- */
  const hero = $("set-hero");
  const heroReady = () => { if (hero) hero.classList.add("is-ready"); };

  function accountValues() {
    const meta = user.user_metadata || {};
    const name = pick(row, NAME_KEYS) || pick(meta, NAME_KEYS) || "";
    const phone = pick(row, PHONE_KEYS) || pick(meta, PHONE_KEYS) || String(user.phone || "");
    const role = pick(row, ROLE_KEYS) || pick(user.app_metadata, ["role"]) || pick(meta, ROLE_KEYS) || "resident";
    return { name, phone, role };
  }

  function renderAccount(fillForm) {
    const v = accountValues();
    const email = user.email || "";
    $("settings-user-name").textContent = v.name || (email ? email.split("@")[0] : "Your account");
    $("settings-user-email").textContent = email || String(user.phone || "");
    $("settings-user-role").textContent = titleCase(v.role);
    const av = $("settings-avatar");
    if (av) { av.classList.add("has-initials"); av.dataset.initials = initials(v.name, email); }
    if (fillForm) {
      $("pf-name").value = v.name;
      $("pf-email").value = email;
      $("pf-phone").value = v.phone;
    }
    const since = $("pf-since"); if (since) since.textContent = fmtDate(user.created_at || (row && row.created_at));
    const role = $("pf-role"); if (role) role.textContent = titleCase(v.role);
    const ver = $("pf-verified"); if (ver) ver.textContent = user.email_confirmed_at || user.confirmed_at ? "Verified" : "Not verified";
    heroReady();
  }

  function renderGuest() {
    $("settings-user-name").textContent = "Welcome";
    $("settings-user-email").textContent = "Sign in to manage your account";
    $("settings-user-role").textContent = "Visitor";
    const av = $("settings-avatar"); if (av) av.classList.remove("has-initials");
    heroReady();
  }

  /* ---------- profile form ---------- */
  function wireProfile() {
    const form = $("profile-form");
    if (!form) return;
    ["pf-name", "pf-phone"].forEach((id) => $(id).addEventListener("input", () => { dirty = true; formMsg(""); }));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!user || !client) { formMsg("Please sign in again", false); return; }
      const name = $("pf-name").value.trim().replace(/\s+/g, " ");
      const phone = $("pf-phone").value.trim();
      if (name.length < 2) { formMsg("Please enter your full name", false); $("pf-name").focus(); return; }
      if (phone && !/^\+?[\d\s().-]{7,25}$/.test(phone)) { formMsg("Enter a valid phone number", false); $("pf-phone").focus(); return; }
      const cur = accountValues();
      if (name === cur.name && phone === cur.phone) { formMsg("No changes to save", true); return; }

      const btn = $("pf-save");
      btn.disabled = true; btn.textContent = "Saving…"; formMsg("");
      try {
        const { data, error } = await withTimeout(client.auth.updateUser({ data: { full_name: name, name: name, phone: phone } }), 15000);
        if (error) throw error;
        if (data && data.user) user = data.user;
        if (row) {
          const patch = {};
          const nk = NAME_KEYS.find((k) => k in row), pk = PHONE_KEYS.find((k) => k in row);
          if (nk) patch[nk] = name;
          if (pk) patch[pk] = phone || null;
          if (Object.keys(patch).length) {
            const res = await withTimeout(client.from("profiles").update(patch).eq("id", user.id), 15000);
            if (res.error) throw res.error;
            Object.assign(row, patch);
          }
        }
        dirty = false;
        renderAccount(true);
        formMsg("Profile saved", true);
        document.dispatchEvent(new CustomEvent("hysacam:profile-updated", { detail: { name, phone } }));
      } catch (err) {
        console.error("Profile save failed:", err);
        formMsg(err && err.message === "timeout" ? "Saving took too long. Check your connection and try again" : "Could not save your profile. Please try again", false);
      } finally {
        btn.disabled = false; btn.textContent = "Save changes";
      }
    });
  }

  /* ---------- preferences ---------- */
  function wirePrefs() {
    const P = window.HysacamPrefs;
    [["pref-notifications", "notifications"], ["pref-reduce-motion", "reduceMotion"], ["pref-compact", "compact"]].forEach(([id, key]) => {
      const el = $(id);
      if (!el) return;
      if (!P) { el.disabled = true; return; }
      el.checked = P.get(key);
      el.addEventListener("change", () => { P.set(key, el.checked); flash("settings-save-message", "Saved on this device"); });
    });
    window.addEventListener("storage", () => {
      if (!P) return;
      [["pref-notifications", "notifications"], ["pref-reduce-motion", "reduceMotion"], ["pref-compact", "compact"]].forEach(([id, key]) => { const el = $(id); if (el) el.checked = P.get(key); });
    });
  }

  /* ---------- default map view ---------- */
  function wireMapView() {
    const btns = document.querySelectorAll("#map-view-seg button");
    if (!btns.length) return;
    const get = () => { try { return localStorage.getItem(MAP_KEY) === "satellite" ? "satellite" : "street"; } catch (e) { return "street"; } };
    const paint = () => { const v = get(); btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v))); };
    paint();
    btns.forEach((b) => b.addEventListener("click", () => {
      try { localStorage.setItem(MAP_KEY, b.dataset.view); } catch (e) { flash("map-pref-msg", "Could not save on this device", true); return; }
      paint();
      flash("map-pref-msg", b.dataset.view === "satellite" ? "Saved · the map will open in satellite view" : "Saved · the map will open in street view");
    }));
  }

  /* ---------- location ---------- */
  function wireLocation() {
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
  }

  /* ---------- share and install ---------- */
  function wireSupport() {
    const share = $("share-app");
    if (share) share.addEventListener("click", async () => {
      const data = { title: "HYSACAM Kumba Tracker", text: "Find dustbins and report waste issues in Kumba", url: location.origin + "/" };
      try {
        if (navigator.share) await navigator.share(data);
        else if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(data.url); flash("support-msg", "Link copied"); }
        else flash("support-msg", "Copy this link: " + data.url);
      } catch (e) { /* share sheet closed */ }
    });

    const row_ = $("install-row"), sub = $("install-sub");
    if (!row_) return;
    const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    if (standalone()) return;
    let deferred = null;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) { row_.hidden = false; if (sub) sub.textContent = "Tap Share, then Add to Home Screen"; }
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; row_.hidden = false; });
    window.addEventListener("appinstalled", () => { row_.hidden = true; });
    row_.addEventListener("click", () => {
      if (deferred) { deferred.prompt(); deferred.userChoice.then(() => { deferred = null; row_.hidden = true; }).catch(() => {}); }
      else flash("support-msg", "Tap Share, then Add to Home Screen");
    });
  }

  /* ---------- clear saved data (two taps to confirm) ---------- */
  function wireClear() {
    const btn = $("clear-local-data");
    if (!btn) return;
    const small = btn.querySelector("small");
    const original = small ? small.textContent : "";
    let armed = false, timer = null;
    const reset = () => { armed = false; clearTimeout(timer); if (small) small.textContent = original; btn.classList.remove("armed"); };
    btn.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        if (small) small.textContent = "Tap again to confirm";
        btn.classList.add("armed");
        timer = setTimeout(reset, 4000);
        return;
      }
      reset();
      let removed = 0;
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && /^hysacam-/i.test(k) && k !== AUTH_CACHE && !/^hysacam-pref-/i.test(k)) { localStorage.removeItem(k); removed++; }
        }
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && /^hysacam-/i.test(k)) { sessionStorage.removeItem(k); removed++; }
        }
      } catch (e) { /* storage blocked */ }
      const msg = $("clear-data-message");
      if (msg) msg.textContent = removed ? "Saved data cleared. You are still signed in" : "There was no saved data to clear";
    });
  }

  /* ---------- sign out ---------- */
  function wireSignOut() {
    const btn = $("profile-signout");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const label = btn.lastChild;
      try { if (client) await withTimeout(client.auth.signOut(), 10000); } catch (e) { console.warn("Sign out request failed:", e); }
      try { localStorage.removeItem(AUTH_CACHE); } catch (e) {}
      location.href = "index.html";
    });
  }

  /* ---------- deep links ---------- */
  function openFromHash() {
    let h = "";
    try { h = decodeURIComponent(location.hash.replace(/^#/, "")); } catch (e) {}
    if (!h) return;
    const el = $(h);
    if (el && el.tagName === "DETAILS") { el.open = true; setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 80); }
  }

  /* ---------- start ---------- */
  async function main() {
    wirePrefs(); wireMapView(); wireLocation(); wireSupport(); wireClear(); wireProfile(); wireSignOut();
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    setTimeout(heroReady, 6000);

    client = await waitFor(getClient, 8000);
    if (!client) {
      $("settings-user-name").textContent = "Account unavailable";
      $("settings-user-email").textContent = "Could not reach the server. Check your connection and reload";
      $("settings-user-role").textContent = "Offline";
      heroReady();
      return;
    }

    let session = null;
    try {
      const res = await withTimeout(client.auth.getSession(), 10000);
      session = res && res.data ? res.data.session : null;
    } catch (e) {
      console.warn("Could not read the session:", e);
      $("settings-user-name").textContent = "Account unavailable";
      $("settings-user-email").textContent = "Could not check your account. Reload to try again";
      $("settings-user-role").textContent = "Offline";
      heroReady();
      return;
    }

    if (!session || !session.user) {
      /* The remembered sign-in is gone: make the page match */
      if (html.classList.contains("auth-yes")) { try { localStorage.removeItem(AUTH_CACHE); } catch (e) {} html.classList.remove("auth-yes"); html.classList.add("auth-no"); }
      renderGuest();
      return;
    }

    user = session.user;
    renderAccount(true);

    /* Fresh account data and the profile row load in the background */
    try { const r = await withTimeout(client.auth.getUser(), 10000); if (r && r.data && r.data.user) user = r.data.user; } catch (e) {}
    try {
      const r = await withTimeout(client.from("profiles").select("*").eq("id", user.id).maybeSingle(), 10000);
      if (!r.error) row = r.data || null;
    } catch (e) { row = null; }
    renderAccount(!dirty);
  }

  main().catch((err) => { console.error("Settings failed to start:", err); heroReady(); });
})();
