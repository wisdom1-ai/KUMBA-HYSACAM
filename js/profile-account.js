/* HYSACAM Kumba Tracker: Profile (opened from Settings)
   Change photo, name and phone; see every account detail. Needs: supabase.js (supabaseClient).
   Photo storage: see profile-setup.txt (one SQL step). */
(function () {
  "use strict";
  const root = document.getElementById("profile-account-root");
  if (!root) return;

  const AUTH_CACHE = "hysacam-auth-cache", BUCKET = "avatars", MAX_FILE = 12 * 1024 * 1024;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const withTimeout = (p, ms) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  async function waitFor(test, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { const v = test(); if (v) return v; } catch (e) {} await sleep(100); }
    try { return test(); } catch (e) { return null; }
  }
  const getClient = () => { try { return (typeof supabaseClient !== "undefined" && supabaseClient) || window.supabaseClient || null; } catch (e) { return window.supabaseClient || null; } };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);
  const pick = (o, keys) => { if (!o) return ""; for (const k of keys) if (o[k] != null && String(o[k]).trim() !== "") return String(o[k]).trim(); return ""; };
  const titleCase = (s) => String(s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const initials = (name, email) => {
    const p = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return String(email || "?").charAt(0).toUpperCase();
  };
  const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
  const fmtDateTime = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); };

  const NAME_KEYS = ["full_name", "name", "display_name"], PHONE_KEYS = ["phone", "phone_number", "telephone"], ROLE_KEYS = ["role", "account_type", "user_role"];
  const ICON = {
    cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
  };

  let client = null, user = null, row = null, dirty = false, busyPhoto = false;

  /* ---------- screens ---------- */
  function skeleton() {
    root.innerHTML = '<div class="pa-hero pa-skel"><div class="pa-avatar"></div><div class="pa-hero-text"><b></b><small></small><i></i></div></div><div class="pa-card pa-skel-card"><div class="pa-line"></div><div class="pa-line"></div><div class="pa-line short"></div></div>';
  }
  function guest(text) {
    root.innerHTML = '<div class="pa-hero pa-guest"><div class="pa-avatar">' + ICON.user + '</div><div class="pa-hero-text"><b>' + esc(text ? "Profile unavailable" : "Sign in to see your profile") + '</b><small>' + esc(text || "Manage your photo, name and account details") + '</small></div>' +
      (text ? "" : '<div class="pa-actions"><a class="pa-btn light" href="signin.html">Sign In</a><a class="pa-btn ghost" href="signup.html">Sign Up</a></div>') + '</div>';
  }
  function shell() {
    root.innerHTML =
      '<div class="pa-hero"><div class="pa-avatar-wrap"><button class="pa-avatar" id="pa-avatar" type="button" aria-label="Change profile photo"><span class="pa-face" id="pa-face"></span><span class="pa-spin" aria-hidden="true"></span></button><button class="pa-cam" id="pa-cam" type="button" aria-label="Change profile photo">' + ICON.cam + '</button></div>' +
      '<div class="pa-hero-text"><b id="pa-name"></b><small id="pa-email-line"></small><div class="pa-chips"><i id="pa-role"></i><i id="pa-verified"></i></div></div>' +
      '<div class="pa-photo-actions"><button class="pa-chipbtn" id="pa-photo-btn" type="button">Change photo</button><button class="pa-chipbtn" id="pa-photo-remove" type="button" hidden>Remove</button></div>' +
      '<p class="pa-photo-msg" id="pa-photo-msg" role="status" aria-live="polite"></p><input id="pa-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden></div>' +

      '<div class="pa-card"><div class="pa-meterhead"><h3>Profile completeness</h3><b id="pa-meter-txt"></b></div><div class="pa-meter"><i id="pa-meter-bar"></i></div><p class="pa-note" id="pa-meter-hint"></p></div>' +

      '<form class="pa-card" id="pa-form" novalidate><h3>Personal information</h3>' +
      '<label class="pa-field">Full name<input id="pa-f-name" maxlength="80" autocomplete="name" enterkeyhint="next" placeholder="Your full name" required></label>' +
      '<label class="pa-field">Phone (optional)<input id="pa-f-phone" type="tel" inputmode="tel" maxlength="25" autocomplete="tel" enterkeyhint="done" placeholder="e.g. +237 6XX XXX XXX"></label>' +
      '<label class="pa-field">Email<input id="pa-f-email" type="email" disabled></label><p class="pa-note">Your email is your sign-in. Change it in Settings, Security</p>' +
      '<button class="pa-save" id="pa-save" type="submit">Save changes</button><p class="pa-msg" id="pa-msg" role="status" aria-live="polite"></p></form>' +

      '<div class="pa-card"><h3>Account details</h3>' +
      '<div class="pa-info"><span>Member since</span><b id="pa-d-since">—</b></div><div class="pa-info"><span>Account type</span><b id="pa-d-role">—</b></div>' +
      '<div class="pa-info"><span>Email status</span><b id="pa-d-verified">—</b></div><div class="pa-info"><span>Last sign-in</span><b id="pa-d-last">—</b></div>' +
      '<div class="pa-info"><span>Reports submitted</span><b id="pa-d-reports">—</b></div>' +
      '<button class="pa-chipbtn pa-resend" id="pa-resend" type="button" hidden>Resend verification email</button><p class="pa-msg" id="pa-verify-msg" role="status" aria-live="polite"></p></div>' +

      '<a class="pa-link" href="settings.html#privacy-section"><span><b>Security</b><small>Password, email and devices</small></span>' + ICON.chev + '</a>' +
      '<a class="pa-link" href="settings.html#notifications-section"><span><b>Notifications</b><small>Bell updates and alerts</small></span>' + ICON.chev + '</a>' +
      '<a class="pa-link" href="report.html"><span><b>My reports</b><small>Track the issues you reported</small></span>' + ICON.chev + '</a>' +
      '<button class="pa-signout" id="pa-signout" type="button">Sign out</button>';
  }

  /* ---------- data ---------- */
  function values() {
    const meta = user.user_metadata || {};
    return {
      name: pick(row, NAME_KEYS) || pick(meta, NAME_KEYS) || "",
      phone: pick(row, PHONE_KEYS) || pick(meta, PHONE_KEYS) || String(user.phone || ""),
      role: pick(row, ROLE_KEYS) || pick(user.app_metadata, ["role"]) || pick(meta, ROLE_KEYS) || "resident"
    };
  }
  const photoUrl = () => pick(user && user.user_metadata, ["avatar_url"]) || pick(row, ["avatar_url"]);
  const verified = () => !!(user.email_confirmed_at || user.confirmed_at);

  function paint(fillForm) {
    const v = values(), email = user.email || "", photo = photoUrl();
    $("pa-name").textContent = v.name || (email ? email.split("@")[0] : "Your account");
    $("pa-email-line").textContent = email || String(user.phone || "");
    $("pa-role").textContent = titleCase(v.role);
    const ver = $("pa-verified"); ver.textContent = verified() ? "Verified" : "Not verified"; ver.className = verified() ? "ok" : "warn";
    $("pa-face").innerHTML = photo ? '<img src="' + esc(photo) + '" alt="Your profile photo">' : esc(initials(v.name, email));
    const img = $("pa-face").querySelector("img");
    if (img) img.onerror = () => { $("pa-face").textContent = initials(v.name, email); };
    $("pa-photo-btn").textContent = photo ? "Change photo" : "Add photo";
    $("pa-photo-remove").hidden = !photo;
    if (fillForm) { $("pa-f-name").value = v.name; $("pa-f-phone").value = v.phone; }
    $("pa-f-email").value = email;
    $("pa-d-since").textContent = fmtDate(user.created_at || (row && row.created_at));
    $("pa-d-role").textContent = titleCase(v.role);
    $("pa-d-verified").textContent = verified() ? "Verified" : "Not verified";
    $("pa-d-last").textContent = fmtDateTime(user.last_sign_in_at);
    $("pa-resend").hidden = verified() || !email;
    const done = [!!v.name, !!v.phone, !!photo], n = done.filter(Boolean).length, pct = Math.round(n / 3 * 100);
    $("pa-meter-bar").style.width = pct + "%"; $("pa-meter-txt").textContent = pct + "%";
    const missing = [!v.name && "your name", !v.phone && "a phone number", !photo && "a photo"].filter(Boolean);
    $("pa-meter-hint").textContent = missing.length ? "Add " + missing.join(", ") + " to complete your profile" : "Your profile is complete";
  }

  async function persist(meta, rowPatch) {
    const res = await withTimeout(client.auth.updateUser({ data: meta }), 15000);
    if (res.error) throw res.error;
    if (res.data && res.data.user) user = res.data.user;
    if (row && rowPatch && Object.keys(rowPatch).length) {
      const r = await withTimeout(client.from("profiles").update(rowPatch).eq("id", user.id), 15000);
      if (r.error) { if ("avatar_url" in rowPatch && Object.keys(rowPatch).length === 1) console.warn("avatar_url column not saved:", r.error.message); else throw r.error; }
      else Object.assign(row, rowPatch);
    }
    document.dispatchEvent(new CustomEvent("hysacam:profile-updated", { detail: { name: values().name, phone: values().phone, avatar_url: photoUrl() } }));
  }

  /* ---------- photo ---------- */
  function squareJpeg(file, size) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        try {
          const s = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - s) / 2, sy = (img.naturalHeight - s) / 2;
          const c = document.createElement("canvas"); c.width = c.height = size;
          const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
          c.toBlob((b) => (b ? resolve(b) : reject(new Error("decode"))), "image/jpeg", 0.88);
        } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }
  function photoError(e) {
    const m = String((e && e.message) || "");
    if (m === "decode") return "That image could not be read. Try a JPG or PNG photo";
    if (m === "timeout") return "Upload took too long. Check your connection and try again";
    if (/bucket not found/i.test(m)) return "Photo upload is not set up yet. Ask the administrator to finish the photo setup";
    if (/row-level|not allowed|unauthori|permission|jwt/i.test(m)) return "You are not allowed to upload a photo. Please sign in again";
    if (/too large|exceed|payload/i.test(m)) return "That photo is too large. Choose a smaller one";
    return "Could not update your photo. Please try again";
  }
  function setBusy(on) { busyPhoto = on; $("pa-avatar").classList.toggle("busy", on); $("pa-photo-btn").disabled = on; $("pa-photo-remove").disabled = on; $("pa-cam").disabled = on; }
  const photoMsg = (t, kind) => { const el = $("pa-photo-msg"); el.textContent = t || ""; el.className = "pa-photo-msg" + (kind ? " " + kind : ""); };

  async function uploadPhoto(file) {
    if (busyPhoto) return;
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) return photoMsg("Please choose an image file", "err");
    if (file.size > MAX_FILE) return photoMsg("That photo is too large. Choose one under 12 MB", "err");
    setBusy(true); photoMsg("Uploading…");
    try {
      const blob = await squareJpeg(file, 512), path = user.id + "/avatar.jpg";
      const up = await withTimeout(client.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" }), 30000);
      if (up.error) throw up.error;
      const url = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl + "?v=" + Date.now();
      await persist({ avatar_url: url }, { avatar_url: url });
      paint(false); photoMsg("Photo updated", "ok");
    } catch (e) { console.error("Photo upload failed:", e); photoMsg(photoError(e), "err"); }
    finally { setBusy(false); }
  }
  async function removePhoto() {
    if (busyPhoto || !confirm("Remove your profile photo?")) return;
    setBusy(true); photoMsg("Removing…");
    try {
      try { await withTimeout(client.storage.from(BUCKET).remove([user.id + "/avatar.jpg"]), 15000); } catch (e) {}
      await persist({ avatar_url: "" }, { avatar_url: null });
      paint(false); photoMsg("Photo removed", "ok");
    } catch (e) { console.error(e); photoMsg(photoError(e), "err"); }
    finally { setBusy(false); }
  }

  /* ---------- wiring ---------- */
  function wire() {
    const input = $("pa-photo-input");
    const choose = () => { if (!busyPhoto) input.click(); };
    ["pa-avatar", "pa-cam", "pa-photo-btn"].forEach((id) => $(id).addEventListener("click", choose));
    input.addEventListener("change", () => { const f = input.files && input.files[0]; input.value = ""; if (f) uploadPhoto(f); });
    $("pa-photo-remove").addEventListener("click", removePhoto);

    const msg = (t, kind) => { const el = $("pa-msg"); el.textContent = t || ""; el.className = "pa-msg" + (kind ? " " + kind : ""); };
    ["pa-f-name", "pa-f-phone"].forEach((id) => $(id).addEventListener("input", () => { dirty = true; msg(""); }));
    $("pa-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("pa-f-name").value.trim().replace(/\s+/g, " "), phone = $("pa-f-phone").value.trim();
      if (name.length < 2) { msg("Please enter your full name", "err"); $("pa-f-name").focus(); return; }
      if (phone && !/^\+?[\d\s().-]{7,25}$/.test(phone)) { msg("Enter a valid phone number", "err"); $("pa-f-phone").focus(); return; }
      const cur = values();
      if (name === cur.name && phone === cur.phone) { msg("No changes to save", "ok"); return; }
      const btn = $("pa-save"); btn.disabled = true; btn.textContent = "Saving…"; msg("");
      try {
        const patch = {}, nk = row && NAME_KEYS.find((k) => k in row), pk = row && PHONE_KEYS.find((k) => k in row);
        if (nk) patch[nk] = name;
        if (pk) patch[pk] = phone || null;
        await persist({ full_name: name, name: name, phone: phone }, patch);
        dirty = false; paint(true); msg("Profile saved", "ok");
      } catch (err) {
        console.error("Profile save failed:", err);
        msg(err && err.message === "timeout" ? "Saving took too long. Check your connection and try again" : "Could not save your profile. Please try again", "err");
      } finally { btn.disabled = false; btn.textContent = "Save changes"; }
    });
    window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

    $("pa-resend").addEventListener("click", async () => {
      const btn = $("pa-resend"), out = $("pa-verify-msg"); btn.disabled = true;
      try {
        const r = await withTimeout(client.auth.resend({ type: "signup", email: user.email }), 15000);
        if (r.error) throw r.error;
        out.textContent = "Verification email sent. Check your inbox"; out.className = "pa-msg ok";
      } catch (e) { out.textContent = "Could not send the email. Try again in a minute"; out.className = "pa-msg err"; }
      finally { setTimeout(() => { btn.disabled = false; }, 30000); }
    });
    $("pa-signout").addEventListener("click", async () => {
      $("pa-signout").disabled = true;
      try { await withTimeout(client.auth.signOut(), 10000); } catch (e) {}
      try { localStorage.removeItem(AUTH_CACHE); } catch (e) {}
      location.href = "index.html";
    });
  }

  async function loadReportCount() {
    try {
      const H = window.Hys;
      if (!H || typeof H.reports !== "function") return;
      const list = await withTimeout(H.reports(), 8000);
      $("pa-d-reports").textContent = Array.isArray(list) ? String(list.length) : "—";
    } catch (e) { /* leave the dash */ }
  }

  /* ---------- finding the signed-in account (patient: the session can arrive a moment late) ---------- */
  function remembered() { try { const c = JSON.parse(localStorage.getItem(AUTH_CACHE) || "null"); return !!(c && c.a === 1); } catch (e) { return false; } }
  async function readSession() {
    try { const r = await withTimeout(client.auth.getSession(), 10000); return r && r.data ? r.data.session : null; } catch (e) { return null; }
  }
  async function findSession() {
    let s = await readSession();
    if (s && s.user) return s;
    try {
      const r = await withTimeout(client.auth.getUser(), 10000);
      if (r && r.data && r.data.user) { const s2 = await readSession(); return s2 && s2.user ? s2 : { user: r.data.user }; }
    } catch (e) {}
    if (remembered()) {
      for (let i = 0; i < 8; i++) { await sleep(750); s = await readSession(); if (s && s.user) return s; }
    }
    return null;
  }
  function retryScreen() {
    root.innerHTML = '<div class="pa-hero pa-guest"><div class="pa-avatar">' + ICON.user + '</div><div class="pa-hero-text"><b>We could not confirm your sign-in</b><small>Your connection may be slow or your session may have expired</small></div>' +
      '<div class="pa-actions"><button class="pa-btn light" id="pa-retry" type="button">Try again</button><a class="pa-btn ghost" href="signin.html">Sign in again</a></div></div>';
    const b = document.getElementById("pa-retry"); if (b) b.addEventListener("click", () => location.reload());
  }

  async function main() {
    skeleton();
    client = await waitFor(getClient, 8000);
    if (!client) return guest("Could not reach the server. Check your connection and reload");
    const session = await findSession();
    if (!session || !session.user) return remembered() ? retryScreen() : guest();

    user = session.user;
    try { const r = await withTimeout(client.auth.getUser(), 10000); if (r && r.data && r.data.user) user = r.data.user; } catch (e) {}
    try { const r = await withTimeout(client.from("profiles").select("*").eq("id", user.id).maybeSingle(), 10000); if (!r.error) row = r.data || null; } catch (e) { row = null; }
    shell(); wire(); paint(true); loadReportCount();
  }
  main().catch((e) => { console.error("Profile failed to start:", e); guest("Something went wrong. Reload to try again"); });
})();
