"use strict";

/* HYSACAM Kumba Tracker: the full profile (moved here from Settings).
   Needs: a <div id="profile-account-root"></div> on profile.html,
   supabase.js loaded (defines supabaseClient), and css/profile-account.css. */
(function () {
  const root = document.getElementById("profile-account-root");
  if (!root) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const withTimeout = (p, ms) =>
    Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  async function waitFor(test, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try { const v = test(); if (v) return v; } catch (e) { /* keep waiting */ }
      await sleep(100);
    }
    try { return test(); } catch (e) { return null; }
  }
  const getClient = () => {
    try { return (typeof supabaseClient !== "undefined" && supabaseClient) || window.supabaseClient || null; }
    catch (e) { return window.supabaseClient || null; }
  };

  const NAME_KEYS = ["full_name", "name", "display_name"];
  const PHONE_KEYS = ["phone", "phone_number", "telephone"];
  const ROLE_KEYS = ["role", "account_type", "user_role"];
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
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  let client = null, user = null, row = null, dirty = false;

  /* ---------- screens ---------- */
  function showLoading() {
    root.innerHTML =
      '<section class="pa-hero pa-skel"><div class="pa-avatar"></div><div class="pa-hero-text"><b></b><small></small><i></i></div></section>' +
      '<section class="pa-card pa-skel-card"><div class="pa-line"></div><div class="pa-line"></div><div class="pa-line short"></div></section>';
  }

  function showGuest() {
    root.innerHTML =
      '<section class="pa-hero pa-guest">' +
      '<div class="pa-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></div>' +
      '<div class="pa-hero-text"><b>Join HYSACAM Kumba Tracker</b><small>Sign in to manage your profile and track your reports</small></div>' +
      '<div class="pa-actions"><a class="pa-btn light" href="signin.html">Sign In</a><a class="pa-btn ghost" href="signup.html">Sign Up</a></div>' +
      "</section>";
  }

  function showError(msg) {
    root.innerHTML = '<section class="pa-card"><h3>Profile unavailable</h3><p class="pa-note"></p></section>';
    root.querySelector(".pa-note").textContent = msg;
  }

  function accountValues() {
    const meta = user.user_metadata || {};
    const name = pick(row, NAME_KEYS) || pick(meta, NAME_KEYS) || "";
    const phone = pick(row, PHONE_KEYS) || pick(meta, PHONE_KEYS) || String(user.phone || "");
    const role = pick(row, ROLE_KEYS) || pick(user.app_metadata, ["role"]) || pick(meta, ROLE_KEYS) || "resident";
    return { name, phone, role };
  }

  function showProfile() {
    root.innerHTML =
      '<section class="pa-hero">' +
      '<div class="pa-avatar" id="pa-avatar"></div>' +
      '<div class="pa-hero-text"><b id="pa-name"></b><small id="pa-email"></small><i id="pa-role-pill"></i></div>' +
      "</section>" +

      '<section class="pa-card">' +
      "<h3>Edit profile</h3>" +
      '<form id="pa-form" novalidate>' +
      '<label class="pa-field">Full name<input id="pa-in-name" maxlength="80" autocomplete="name" enterkeyhint="next" placeholder="Your full name" required></label>' +
      '<label class="pa-field">Email<input id="pa-in-email" type="email" disabled></label>' +
      '<p class="pa-note">To use a different email, go to Security in Settings</p>' +
      '<label class="pa-field">Phone (optional)<input id="pa-in-phone" type="tel" inputmode="tel" maxlength="25" autocomplete="tel" enterkeyhint="done" placeholder="e.g. +237 6XX XXX XXX"></label>' +
      '<button class="pa-save" id="pa-save" type="submit">Save changes</button>' +
      '<p class="pa-msg" id="pa-msg" role="status" aria-live="polite"></p>' +
      "</form></section>" +

      '<section class="pa-card">' +
      "<h3>Account details</h3>" +
      '<div class="pa-info"><span>Member since</span><b id="pa-since">—</b></div>' +
      '<div class="pa-info"><span>Email status</span><b id="pa-verified">—</b></div>' +
      '<div class="pa-info"><span>Account type</span><b id="pa-role">Resident</b></div>' +
      "</section>" +

      '<a class="pa-link" href="settings.html#security"><span><b>Password and security</b><small>Change password, email and devices</small></span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></a>' +
      '<a class="pa-link" href="settings.html"><span><b>All settings</b><small>Notifications, map and privacy</small></span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></a>';

    fill(true);
    wireForm();
  }

  function fill(withForm) {
    const v = accountValues();
    const email = user.email || "";
    const $ = (id) => document.getElementById(id);
    $("pa-name").textContent = v.name || (email ? email.split("@")[0] : "Your account");
    $("pa-email").textContent = email || String(user.phone || "");
    $("pa-role-pill").textContent = titleCase(v.role);
    $("pa-avatar").textContent = initials(v.name, email);
    $("pa-since").textContent = fmtDate(user.created_at || (row && row.created_at));
    $("pa-verified").textContent = user.email_confirmed_at || user.confirmed_at ? "Verified" : "Not verified";
    $("pa-role").textContent = titleCase(v.role);
    if (withForm) {
      $("pa-in-name").value = v.name;
      $("pa-in-email").value = email;
      $("pa-in-phone").value = v.phone;
    }
  }

  function say(text, kind) {
    const el = document.getElementById("pa-msg");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("err", kind === "err");
    el.classList.toggle("ok", kind === "ok");
  }

  function wireForm() {
    const form = document.getElementById("pa-form");
    const nameIn = document.getElementById("pa-in-name");
    const phoneIn = document.getElementById("pa-in-phone");
    const saveBtn = document.getElementById("pa-save");

    [nameIn, phoneIn].forEach((el) => el.addEventListener("input", () => { dirty = true; say(""); }));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!user || !client) return say("Please sign in again", "err");
      const name = nameIn.value.trim().replace(/\s+/g, " ");
      const phone = phoneIn.value.trim();
      if (name.length < 2) { say("Please enter your full name", "err"); nameIn.focus(); return; }
      if (phone && !/^\+?[\d\s().-]{7,25}$/.test(phone)) { say("Enter a valid phone number", "err"); phoneIn.focus(); return; }
      const cur = accountValues();
      if (name === cur.name && phone === cur.phone) return say("No changes to save", "ok");

      saveBtn.disabled = true;
      const old = saveBtn.textContent;
      saveBtn.textContent = "Saving…";
      say("");
      try {
        const { data, error } = await withTimeout(
          client.auth.updateUser({ data: { full_name: name, name: name, phone: phone } }), 15000);
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
        fill(true);
        say("Profile saved", "ok");
        document.dispatchEvent(new CustomEvent("hysacam:profile-updated", { detail: { name, phone } }));
      } catch (err) {
        console.error("Profile save failed:", err);
        say(err && err.message === "timeout"
          ? "Saving took too long. Check your connection and try again"
          : "Could not save your profile. Please try again", "err");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = old;
      }
    });

    window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  }

  /* ---------- start ---------- */
  (async function init() {
    showLoading();
    client = await waitFor(getClient, 8000);
    if (!client) return showError("Could not connect. Check your internet connection and refresh");
    try {
      const res = await withTimeout(client.auth.getSession(), 10000);
      user = res && res.data && res.data.session ? res.data.session.user : null;
    } catch (e) {
      return showError("Could not check your account. Check your connection and refresh");
    }
    if (!user) return showGuest();
    try {
      const res = await withTimeout(client.from("profiles").select("*").eq("id", user.id).maybeSingle(), 10000);
      row = res && res.data ? res.data : null;
    } catch (e) { row = null; }
    showProfile();
  })();
})();
