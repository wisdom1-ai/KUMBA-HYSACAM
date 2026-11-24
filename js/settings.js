"use strict";

/* HYSACAM Kumba Tracker: Settings page (complete, self-contained)
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
  /* Message that stays until changed */
  function say(id, text, kind) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("err", kind === "err");
    el.classList.toggle("ok", kind === "ok");
  }
  async function busy(btn, label, fn) {
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    try { await fn(); } finally { btn.disabled = false; btn.textContent = old; }
  }
  const friendly = (e) => {
    const m = String((e && e.message) || "");
    if (m === "timeout") return "That took too long. Check your connection and try again";
    if (/invalid login/i.test(m)) return "Your current password is not correct";
    if (/same password|different from the old/i.test(m)) return "Choose a password you have not used before";
    if (/rate|too many|security purposes/i.test(m)) return "Too many attempts. Wait a minute and try again";
    if (/already (been )?registered|already exists/i.test(m)) return "That email is already in use";
    return "Something went wrong. Please try again";
  };

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
    $("pf-since").textContent = fmtDate(user.created_at || (row && row.created_at));
    $("pf-role").textContent = titleCase(v.role);
    $("pf-verified").textContent = user.email_confirmed_at || user.confirmed_at ? "Verified" : "Not verified";
    heroReady();
  }

  function renderGuest() {
    $("settings-user-name").textContent = "Welcome";
    $("settings-user-email").textContent = "Sign in to manage your account";
    $("settings-user-role").textContent = "Visitor";
    const av = $("settings-avatar"); if (av) av.classList.remove("has-initials");
    heroReady();
  }

  function renderUnavailable(msg) {
    $("settings-user-name").textContent = "Account unavailable";
    $("settings-user-email").textContent = msg;
    $("settings-user-role").textContent = "Offline";
    heroReady();
  }

  /* ---------- profile ---------- */
  function wireProfile() {
    const form = $("profile-form");
    if (!form) return;
    ["pf-name", "pf-phone"].forEach((id) => $(id).addEventListener("input", () => { dirty = true; say("pf-msg", ""); }));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!user || !client) return say("pf-msg", "Please sign in again", "err");
      const name = $("pf-name").value.trim().replace(/\s+/g, " ");
      const phone = $("pf-phone").value.trim();
      if (name.length < 2) { say("pf-msg", "Please enter your full name", "err"); $("pf-name").focus(); return; }
      if (phone && !/^\+?[\d\s().-]{7,25}$/.test(phone)) { say("pf-msg", "Enter a valid phone number", "err"); $("pf-phone").focus(); return; }
      const cur = accountValues();
      if (name === cur.name && phone === cur.phone) return say("pf-msg", "No changes to save", "ok");

      await busy($("pf-save"), "Saving…", async () => {
        say("pf-msg", "");
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
          say("pf-msg", "Profile saved", "ok");
          document.dispatchEvent(new CustomEvent("hysacam:profile-updated", { detail: { name, phone } }));
        } catch (err) {
          console.error("Profile save failed:", err);
          say("pf-msg", err && err.message === "timeout" ? "Saving took too long. Check your connection and try again" : "Could not save your profile. Please try again", "err");
        }
      });
    });

    /* warn before leaving with unsaved edits */
    window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  }

  /* ---------- security ---------- */
  function strength(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  function wireSecurity() {
    const pw = $("pw-form");
    if (pw) {
      const fields = ["pw-current", "pw-new", "pw-confirm"].map($);
      $("pw-show").addEventListener("change", (e) => fields.forEach((f) => { f.type = e.target.checked ? "text" : "password"; }));
      $("pw-new").addEventListener("input", (e) => {
        const v = e.target.value, el = $("pw-strength");
        if (!v) { el.textContent = "Use at least 8 characters"; el.dataset.level = ""; return; }
        const s = strength(v);
        const level = v.length < 8 ? "weak" : s <= 2 ? "fair" : s === 3 ? "good" : "strong";
        el.dataset.level = level;
        el.textContent = v.length < 8 ? "Too short: use at least 8 characters" : "Strength: " + level;
      });
      pw.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!user || !client) return say("pw-msg", "Please sign in again", "err");
        const cur = $("pw-current").value, next = $("pw-new").value, again = $("pw-confirm").value;
        say("pw-msg", "");
        if (!user.email) return say("pw-msg", "This account has no email to verify with", "err");
        if (!cur) return say("pw-msg", "Enter your current password", "err");
        if (next.length < 8) return say("pw-msg", "New password must be at least 8 characters", "err");
        if (next === cur) return say("pw-msg", "New password must be different from the current one", "err");
        if (next !== again) return say("pw-msg", "The new passwords do not match", "err");
        await busy($("pw-save"), "Updating…", async () => {
          try {
            const a = await withTimeout(client.auth.signInWithPassword({ email: user.email, password: cur }), 15000);
            if (a.error) throw a.error;
            const u = await withTimeout(client.auth.updateUser({ password: next }), 15000);
            if (u.error) throw u.error;
            pw.reset();
            $("pw-strength").textContent = "Use at least 8 characters"; $("pw-strength").dataset.level = "";
            say("pw-msg", "Password updated", "ok");
          } catch (err) { console.error(err); say("pw-msg", friendly(err), "err"); }
        });
      });
    }

    const em = $("email-form");
    if (em) em.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!user || !client) return say("email-msg", "Please sign in again", "err");
      const next = $("email-new").value.trim().toLowerCase();
      say("email-msg", "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next)) return say("email-msg", "Enter a valid email address", "err");
      if (next === String(user.email || "").toLowerCase()) return say("email-msg", "That is already your email", "err");
      await busy($("email-save"), "Sending…", async () => {
        try {
          const r = await withTimeout(client.auth.updateUser({ email: next }, { emailRedirectTo: location.origin + "/settings.html" }), 15000);
          if (r.error) throw r.error;
          em.reset();
          say("email-msg", "Check your inbox and confirm. Your email changes only after you confirm", "ok");
        } catch (err) { console.error(err); say("email-msg", friendly(err), "err"); }
      });
    });

    const all = $("signout-all");
    if (all) all.addEventListener("click", async () => {
      if (!client || !confirm("Sign out on all devices, including this one?")) return;
      all.disabled = true;
      try { await withTimeout(client.auth.signOut({ scope: "global" }), 10000); } catch (err) { console.warn("Global sign out failed:", err); }
      try { localStorage.removeItem(AUTH_CACHE); } catch (e) {}
      location.href = "index.html";
    });
  }

  /* ---------- preferences ---------- */
  const PREFS = [["pref-notifications", "notifications"], ["pref-reduce-motion", "reduceMotion"], ["pref-compact", "compact"]];
  function wirePrefs() {
    const P = window.HysacamPrefs;
    PREFS.forEach(([id, key]) => {
      const el = $(id);
      if (!el) return;
      if (!P) { el.disabled = true; return; }
      el.checked = P.get(key);
      el.addEventListener("change", () => { P.set(key, el.checked); flash("settings-save-message", "Saved on this device"); });
    });
    window.addEventListener("storage", () => { if (P) PREFS.forEach(([id, key]) => { const el = $(id); if (el) el.checked = P.get(key); }); });
  }

  function wireMapView() {
    const btns = document.querySelectorAll("#map-view-seg button");
    if (!btns.length) return;
    const get = () => { try { return localStorage.getItem(MAP_KEY) === "satellite" ? "satellite" : "street"; } catch (e) { return "street"; } };
    const paint = () => { const v = get(); btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v))); };
    paint();
    btns.forEach((b) => b.addEventListener("click", () => {
      try { localStorage.setItem(MAP_KEY, b.dataset.view); } catch (e) { flash("map-pref-msg", "Could not save on this device", true); return; }
      paint();
      flash("map-pref-msg", b.dataset.view === "satellite" ? "Saved. The map will open in satellite view" : "Saved. The map will open in street view");
    }));
  }

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

  /* ---------- your data ---------- */
  function wireExport() {
    const btn = $("export-data");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (!user) return flash("export-msg", "Please sign in again", true);
      try {
        const local = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /^hysacam-/i.test(k) && k !== AUTH_CACHE) local[k] = localStorage.getItem(k);
        }
        const out = {
          exported_at: new Date().toISOString(),
          account: { id: user.id, email: user.email || null, phone: user.phone || null, created_at: user.created_at || null, email_confirmed_at: user.email_confirmed_at || null },
          profile: row, settings_on_this_device: local
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url; a.download = "hysacam-my-data.json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        flash("export-msg", "Downloaded");
      } catch (e) { flash("export-msg", "Could not prepare your data", true); }
    });
  }

  /* Two taps to confirm */
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

  /* ---------- support ---------- */
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

    const inst = $("install-row"), sub = $("install-sub");
    if (!inst) return;
    const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    if (standalone()) return;
    let deferred = null;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) { inst.hidden = false; if (sub) sub.textContent = "Tap Share, then Add to Home Screen"; }
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; inst.hidden = false; });
    window.addEventListener("appinstalled", () => { inst.hidden = true; });
    inst.addEventListener("click", () => {
      if (deferred) { deferred.prompt(); deferred.userChoice.then(() => { deferred = null; inst.hidden = true; }).catch(() => {}); }
      else flash("support-msg", "Tap Share, then Add to Home Screen");
    });
  }

  function wireSignOut() {
    const btn = $("profile-signout");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try { if (client) await withTimeout(client.auth.signOut(), 10000); } catch (e) { console.warn("Sign out request failed:", e); }
      try { localStorage.removeItem(AUTH_CACHE); } catch (e) {}
      location.href = "index.html";
    });
  }

  /* ---------- deep links: settings.html#security opens that section ---------- */
  function openFromHash() {
    let h = "";
    try { h = decodeURIComponent(location.hash.replace(/^#/, "")); } catch (e) {}
    if (!h) return;
    const el = $(h) || $(h + "-section");
    if (el && el.tagName === "DETAILS") { el.open = true; setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 80); }
  }

  /* ---------- start ---------- */
  async function main() {
    wirePrefs(); wireMapView(); wireLocation(); wireSupport(); wireClear(); wireExport(); wireProfile(); wireSecurity(); wireSignOut();
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    setTimeout(heroReady, 6000);

    client = await waitFor(getClient, 8000);
    if (!client) return renderUnavailable("Could not reach the server. Check your connection and reload");

    let session = null;
    try {
      const res = await withTimeout(client.auth.getSession(), 10000);
      session = res && res.data ? res.data.session : null;
    } catch (e) {
      console.warn("Could not read the session:", e);
      return renderUnavailable("Could not check your account. Reload to try again");
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

    /* Email change confirmed: refresh happens on return from the link */
    client.auth.onAuthStateChange((ev, s) => {
      if (ev === "USER_UPDATED" && s && s.user) { user = s.user; renderAccount(!dirty); }
      if (ev === "SIGNED_OUT") { try { localStorage.removeItem(AUTH_CACHE); } catch (e) {} }
    });
  }

  main().catch((err) => { console.error("Settings failed to start:", err); heroReady(); });
})();
