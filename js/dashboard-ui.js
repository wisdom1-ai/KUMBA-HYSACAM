"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const main = document.querySelector("main");
  const header = document.querySelector(".topbar");
  if (!main) return;

  const safeStorage = {
    get(key, fallback) { try { const value = localStorage.getItem(key); return value == null ? fallback : value; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* private browsing may block storage */ } }
  };
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const fmtDate = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "Date unavailable" : d.toLocaleString(); };

  // Dynamic settings and profile sections use the authenticated account API.
  const settings = document.createElement("section");
  settings.id = "settings"; settings.className = "page-section app-extra-page";
  settings.innerHTML = `
    <div class="section-head"><div><span class="eyebrow">PREFERENCES &amp; SECURITY</span><h2>Settings</h2><p>Manage your account and application preferences</p></div></div>
    <div class="settings-profile-card"><span class="settings-avatar" aria-hidden="true">●</span><div><b id="settings-user-name">Guest User</b><small id="settings-user-email">Sign in to view account details</small><span class="role-pill" id="settings-user-role">Resident</span></div></div>
    <div class="settings-list">
      <a class="settings-item" href="#profile"><span class="settings-icon">♙</span><span><b>Account Settings</b><small>View your account information</small></span><span>›</span></a>
      <button class="settings-item" id="settings-notifications" type="button"><span class="settings-icon">♟</span><span><b>Notifications</b><small>View report updates and alerts</small></span><span>›</span></button>
      <button class="settings-item" id="settings-privacy" type="button"><span class="settings-icon">♢</span><span><b>Privacy &amp; Security</b><small>Review your account security</small></span><span>›</span></button>
      <button class="settings-item" id="settings-appearance" type="button"><span class="settings-icon">⚙</span><span><b>App Preferences</b><small>Toggle comfortable display spacing</small></span><span>›</span></button>
      <a class="settings-item" href="#about"><span class="settings-icon">ⓘ</span><span><b>About HYSACAM</b><small>Platform information and support</small></span><span>›</span></a>
    </div>
    <button id="settings-signout" class="signout-button" type="button" hidden>↪ Sign Out</button>
    <div class="settings-footer"><span class="footer-recycle" aria-hidden="true">♻</span><b>HYSACAM Kumba Tracker</b><p>Cleaner City. Healthier Community.</p><small>© 2026 HYSACAM. All rights reserved</small></div>`;
  const profile = document.createElement("section");
  profile.id = "profile"; profile.className = "page-section app-extra-page";
  profile.innerHTML = `
    <div class="section-head"><div><span class="eyebrow">YOUR ACCOUNT</span><h2>Profile</h2><p>Manage your HYSACAM Tracker account</p></div></div>
    <div class="profile-card"><span class="profile-avatar" aria-hidden="true">●</span><h2 id="profile-user-name">Guest User</h2><p id="profile-user-email">Not signed in</p><span class="role-pill" id="profile-user-role">Resident</span></div>
    <div class="settings-list">
      <a class="settings-item" href="#settings"><span class="settings-icon">♙</span><span><b>Account Information</b><small>View your account and security settings</small></span><span>›</span></a>
      <a class="settings-item" href="#report"><span class="settings-icon">▤</span><span><b>My Reports</b><small>Track your submitted reports</small></span><span>›</span></a>
      <a class="settings-item" href="#settings"><span class="settings-icon">⚙</span><span><b>Settings</b><small>Manage app preferences</small></span><span>›</span></a>
    </div><button id="profile-signout" class="signout-button" type="button" hidden>↪ Sign Out</button>`;
  main.append(settings, profile);

  // The five-tab bottom bar follows the supplied iPhone reference.
  const nav = document.createElement("nav");
  nav.className = "bottom-nav"; nav.setAttribute("aria-label", "Main navigation");
  nav.innerHTML = `
    <a href="#home" data-tab="home" class="active"><svg class="bottom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 10.7 12 2.8l9.5 7.9v10a1.3 1.3 0 0 1-1.3 1.3h-5.3v-7.1H9.1V22H3.8a1.3 1.3 0 0 1-1.3-1.3z"/></svg><b>Home</b></a>
    <a href="#map" data-tab="map"><svg class="bottom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-8.2 8-13.1a8 8 0 1 0-16 0C4 13.8 12 22 12 22Z"/><circle cx="12" cy="8.8" r="2.8" class="icon-cutout"/></svg><b>Map</b></a>
    <a href="#report" data-tab="report"><svg class="bottom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h9.2L20 7.3v14.2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Zm8 1.9v4h4"/><path d="M8 11h8M8 14.5h8M8 18h6" class="icon-lines"/></svg><b>Reports</b></a>
    <a href="#settings" data-tab="settings"><svg class="bottom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m10 2.5 4 0 .7 2.2 1.8.8 2.1-1 2.1 3.6-1.6 1.7v2l1.6 1.7-2.1 3.6-2.1-1-1.8.8-.7 2.2h-4l-.7-2.2-1.8-.8-2.1 1-2.1-3.6 1.6-1.7v-2L3.3 8.1l2.1-3.6 2.1 1 1.8-.8z"/><circle cx="12" cy="11" r="3.2" class="icon-cutout"/></svg><b>Settings</b></a>
    <a href="#profile" data-tab="profile"><svg class="bottom-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.2" r="4.2"/><path d="M3 22c.4-5.1 3.7-8 9-8s8.6 2.9 9 8z"/></svg><b>Profile</b></a>`;
  document.body.append(nav);

  // Header controls are authored in index.html so the bell always comes before the menu.
  const menu = $("main-nav"), menuBtn = $("menu-toggle"), panel = $("notification-panel"), bell = $("notification-toggle");
  const backdrop = $("nav-backdrop");
  function closeMenu() { menu?.classList.remove("open"); menu?.setAttribute("hidden", ""); menuBtn?.setAttribute("aria-expanded", "false"); backdrop?.setAttribute("hidden", ""); }
  function openMenu() { if (!menu) return; menu.removeAttribute("hidden"); menu.classList.add("open"); menuBtn?.setAttribute("aria-expanded", "true"); backdrop?.removeAttribute("hidden"); }
  menuBtn?.addEventListener("click", () => menu?.classList.contains("open") ? closeMenu() : openMenu());
  $("menu-close")?.addEventListener("click", closeMenu);
  backdrop?.addEventListener("click", closeMenu);
  menu?.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));

  // Navigation shows the existing, database-backed sections without duplicating them.
  const routeSections = [...main.querySelectorAll("section[id]")];
  function route() {
    const target = (location.hash || "#home").slice(1);
    const known = ["home", "map", "report", "directory", "cleaning", "details", "about", "settings", "profile"];
    const anchor = $(target);
    const ownerSection = anchor?.closest("section[id]")?.id;
    const page = known.includes(target) ? target : (known.includes(ownerSection) ? ownerSection : "home");
    routeSections.forEach(section => {
      const visible = page === "home"
        ? ["home", "home-services", "map", "home-recent-reports"].includes(section.id)
        : page === "map" ? section.id === "map"
        : known.includes(page) ? section.id === page
        : true;
      section.classList.toggle("route-hidden", !visible);
    });
    nav.querySelectorAll("a").forEach(a => a.classList.toggle("active", a.dataset.tab === page));
    closeMenu();
    if (page === "map") setTimeout(() => window.dispatchEvent(new Event("resize")), 180);
    if (anchor && target !== page) setTimeout(() => anchor.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    else window.scrollTo({ top: 0, behavior: "instant" });
  }
  window.addEventListener("hashchange", route); route();

  // Notifications are derived from the signed-in user's real report records.
  // Read state is stored locally per report status update; no fake records/counts are used.
  const readKey = "hysacamTrackerReadNotificationsV1";
  let reportCache = null;
  function readSet() { try { return new Set(JSON.parse(safeStorage.get(readKey, "[]"))); } catch { return new Set(); } }
  function saveRead(set) { safeStorage.set(readKey, JSON.stringify([...set])); }
  function reportNotificationKey(report) { return `${report.reference_code || report.id || "report"}:${report.status || "submitted"}:${report.updated_at || report.created_at || ""}`; }
  const statusText = (status) => ({submitted:"Submitted",under_review:"In review",assigned:"Assigned",in_progress:"In progress",resolved:"Resolved",rejected:"Closed"}[String(status || "submitted").toLowerCase()] || String(status || "Submitted").replaceAll("_", " "));
  function renderNotifications() {
    const host = $("notification-list"), count = $("notification-count");
    if (!host || !count) return;
    const seen = readSet();
    const items = preferences.reportNotifications ? (reportCache || []).slice(0, 12) : [];
    const unread = items.filter(item => !seen.has(reportNotificationKey(item)));
    count.textContent = unread.length > 9 ? "9+" : String(unread.length);
    count.hidden = !preferences.unreadBadge || unread.length === 0;
    host.innerHTML = items.length ? items.map(item => {
      const key = reportNotificationKey(item), unreadClass = seen.has(key) ? "" : " is-unread";
      const label = statusText(item.status);
      return `<button type="button" class="notification-item${unreadClass}" data-notification-key="${escapeHTML(key)}"><span class="notification-dot" aria-hidden="true"></span><span class="notification-copy"><b>${escapeHTML(item.reference_code || "Your report")}</b><span>Status: ${escapeHTML(label)}</span><small>${escapeHTML(fmtDate(item.updated_at || item.created_at))}</small></span></button>`;
    }).join("") : `<p class="notification-empty">${reportCache === null ? "Sign in to see report updates" : "No report updates yet"}</p>`;
    host.querySelectorAll("[data-notification-key]").forEach(button => button.addEventListener("click", () => {
      const next = readSet(); next.add(button.dataset.notificationKey); saveRead(next); renderNotifications();
      if (panel) panel.hidden = true; bell?.setAttribute("aria-expanded", "false"); location.hash = "#report";
    }));
  }
  async function loadReports() {
    try {
      const response = await fetch("/api/reports", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Not signed in");
      const data = await response.json(); reportCache = Array.isArray(data.reports) ? data.reports : [];
      renderNotifications(); renderRecentReports(reportCache); renderReportStats(reportCache);
    } catch {
      reportCache = null; renderNotifications();
      const recent = $("home-recent-report-list"); if (recent) recent.innerHTML = `<p class="empty-state compact">Sign in to view your submitted reports</p>`;
      const stats = $("report-stats"); if (stats) stats.hidden = true;
    }
  }
  bell?.addEventListener("click", async () => {
    await loadReports();
    if (panel) panel.hidden = !panel.hidden;
    bell.setAttribute("aria-expanded", String(!panel?.hidden));
  });
  $("notification-read-all")?.addEventListener("click", () => {
    const all = readSet(); (reportCache || []).forEach(item => all.add(reportNotificationKey(item))); saveRead(all); renderNotifications();
  });
  document.addEventListener("click", (event) => {
    if (panel && !panel.hidden && !event.target.closest("#notification-panel") && !event.target.closest("#notification-toggle")) {
      panel.hidden = true; bell?.setAttribute("aria-expanded", "false");
    }
  });

  function renderRecentReports(items) {
    const host = $("home-recent-report-list"); if (!host) return;
    host.innerHTML = items.length ? items.slice(0, 3).map(item => `<article class="recent-report-card"><span class="recent-report-check">✓</span><div><b>${escapeHTML(item.reference_code || "Report")}</b><small>${escapeHTML(fmtDate(item.created_at))}</small></div><span class="recent-report-status">${escapeHTML(statusText(item.status))}</span></article>`).join("") : `<p class="empty-state compact">No reports have been submitted yet</p>`;
  }
  function renderReportStats(items) {
    const section = $("report"), existing = $("report-stats"); if (!section) return;
    let host = existing;
    if (!host) { host = document.createElement("div"); host.id = "report-stats"; host.className = "report-stats"; section.insertBefore(host, $("report-auth-gate")); }
    const pending = items.filter(x => ["submitted", "under_review", "assigned", "in_progress"].includes(String(x.status).toLowerCase())).length;
    const resolved = items.filter(x => String(x.status).toLowerCase() === "resolved").length;
    const closed = items.filter(x => String(x.status).toLowerCase() === "rejected").length;
    host.hidden = false;
    host.innerHTML = `<div><b>${items.length}</b><span>Total</span></div><div><b>${pending}</b><span>Pending</span></div><div><b>${resolved}</b><span>Resolved</span></div><div><b>${closed}</b><span>Closed</span></div>`;
  }

  // Load account identity from the existing session endpoint; never infer it from local storage.
  async function loadAccount() {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.authenticated) return;
      const user = data.user || data.profile || {};
      const name = user.full_name || user.name || user.email || "Resident";
      const email = user.email || "";
      ["settings-user-name", "profile-user-name", "menu-user-name"].forEach(id => { if ($(id)) $(id).textContent = name; });
      ["settings-user-email", "profile-user-email", "menu-user-email"].forEach(id => { if ($(id)) $(id).textContent = email; });
      ["settings-signout", "profile-signout", "menu-signout"].forEach(id => { if ($(id)) $(id).hidden = false; });
      if ($("menu-signin")) $("menu-signin").hidden = true;
      const role = user.role || user.account_type || "Resident";
      ["settings-user-role", "profile-user-role"].forEach(id => { if ($(id)) $(id).textContent = role; });
    } catch (error) { console.info("Account details are not available while signed out"); }
  }
  async function signOut() {
    const buttons = [$("settings-signout"), $("profile-signout"), $("menu-signout")].filter(Boolean);
    buttons.forEach(button => { button.disabled = true; button.textContent = "Signing out…"; });
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("Sign out failed");
      location.href = "signin.html";
    } catch {
      buttons.forEach(button => { button.disabled = false; button.textContent = "↪ Sign Out"; });
      alert("Unable to sign out right now. Please try again.");
    }
  }
  ["settings-signout", "profile-signout", "menu-signout"].forEach(id => $(id)?.addEventListener("click", signOut));

  // Settings: persist notification preferences and provide clear, working controls.
  const preferenceKey = "hysacamTrackerPreferencesV1";
  const defaultPreferences = { reportNotifications: true, unreadBadge: true, comfortableSpacing: false, darkAppearance: false };
  function getPreferences() {
    try { return { ...defaultPreferences, ...JSON.parse(safeStorage.get(preferenceKey, "{}")) }; }
    catch { return { ...defaultPreferences }; }
  }
  function savePreferences(next) {
    safeStorage.set(preferenceKey, JSON.stringify(next));
    document.body.classList.toggle("comfortable-view", !!next.comfortableSpacing);
    document.body.classList.toggle("dark-appearance", !!next.darkAppearance);
    renderNotifications();
  }
  let preferences = getPreferences();
  document.body.classList.toggle("comfortable-view", !!preferences.comfortableSpacing);
  document.body.classList.toggle("dark-appearance", !!preferences.darkAppearance);

  function openSettingsDialog(id, title, content) {
    let dialog = $(id);
    if (!dialog) {
      dialog = document.createElement("div");
      dialog.id = id; dialog.className = "modal settings-dialog";
      dialog.innerHTML = `<section class="modal-card settings-dialog-card" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><button type="button" class="modal-close" aria-label="Close">×</button><h2 id="${id}-title">${title}</h2><div class="settings-dialog-content">${content}</div><button type="button" class="primary-button settings-done">Done</button></section>`;
      document.body.append(dialog);
      dialog.addEventListener("click", event => {
        if (event.target === dialog || event.target.closest(".modal-close") || event.target.closest(".settings-done")) dialog.classList.remove("open");
      });
    }
    dialog.classList.add("open");
    return dialog;
  }
  $("settings-notifications")?.addEventListener("click", () => {
    const dialog = openSettingsDialog("notification-preferences-dialog", "Notification Preferences", `
      <label class="settings-switch-row"><span><b>Report status updates</b><small>Show updates when your submitted reports change status</small></span><input id="pref-report-notifications" type="checkbox"></label>
      <label class="settings-switch-row"><span><b>Unread notification badge</b><small>Show the unread count on the notification bell</small></span><input id="pref-unread-badge" type="checkbox"></label>
      <p class="settings-dialog-note">These preferences apply to report notifications available in your account. They do not change HYSACAM's email delivery settings.</p>`);
    $("pref-report-notifications").checked = !!preferences.reportNotifications;
    $("pref-unread-badge").checked = !!preferences.unreadBadge;
    ["pref-report-notifications","pref-unread-badge"].forEach(id => { if ($(id)) $(id).onchange = () => {
      preferences = { ...preferences, reportNotifications: $("pref-report-notifications").checked, unreadBadge: $("pref-unread-badge").checked };
      savePreferences(preferences);
    }; });
  });
  $("settings-privacy")?.addEventListener("click", () => {
    const dialog = openSettingsDialog("privacy-dialog", "Privacy & Security", `
      <p>Your account sign-in, password verification and recovery are handled by the connected HYSACAM authentication service.</p>
      <p>Use a unique password and never share your password or email verification codes.</p>
      <a class="primary-button" href="forgot-password.html">Reset your password</a>
      <p class="settings-dialog-note">Signing out ends the current session on this device.</p>`);
  });
  $("settings-appearance")?.addEventListener("click", () => {
    const dialog = openSettingsDialog("appearance-preferences-dialog", "App Preferences", `
      <label class="settings-switch-row"><span><b>Comfortable spacing</b><small>Increase spacing between content cards</small></span><input id="pref-comfortable-spacing" type="checkbox"></label>
      <label class="settings-switch-row"><span><b>Dark appearance</b><small>Use a darker interface on this device</small></span><input id="pref-dark-appearance" type="checkbox"></label>
      <p class="settings-dialog-note">Your choices are saved on this device and do not change other users' settings.</p>`);
    $("pref-comfortable-spacing").checked = !!preferences.comfortableSpacing;
    $("pref-dark-appearance").checked = !!preferences.darkAppearance;
    $("pref-comfortable-spacing").onchange = () => {
      preferences = { ...preferences, comfortableSpacing: $("pref-comfortable-spacing").checked }; savePreferences(preferences);
    };
    $("pref-dark-appearance").onchange = () => {
      preferences = { ...preferences, darkAppearance: $("pref-dark-appearance").checked }; savePreferences(preferences);
    };
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") document.querySelectorAll(".settings-dialog.open").forEach(dialog => dialog.classList.remove("open"));
  });
  $("refresh-my-reports")?.addEventListener("click", loadReports);
  window.addEventListener("hysacam:reports-updated", loadReports);

  loadAccount(); loadReports();
});