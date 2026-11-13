(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const client = window.supabaseClient;
  const pageIds = ["home", "map", "directory", "reports", "report", "cleaning", "details", "settings", "profile", "about"];
  function route() {
    let id = location.hash.replace("#", "") || "home";
    if (!pageIds.includes(id)) id = "home";
    document.querySelectorAll(".app-page").forEach(p => p.classList.toggle("active-page", p.id === id));
    document.querySelectorAll(".bottom-nav [data-tab]").forEach(a => a.classList.toggle("active", a.dataset.tab === (id === "directory" ? "map" : id === "report" ? "reports" : id)));
    const workspace = $("map-workspace");
    const mapHost = id === "map" ? $("map-map-host") : $("home-map-host");
    if (workspace && mapHost && workspace.parentElement !== mapHost) mapHost.appendChild(workspace);
    if (id === "map") setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
    $("main-nav").hidden = true;
    $("menu-toggle").setAttribute("aria-expanded", "false");
    $("notification-panel").hidden = true;
  }
  window.addEventListener("hashchange", route); route();
  $("menu-toggle")?.addEventListener("click", () => {
    const menu = $("main-nav"); menu.hidden = !menu.hidden;
    $("menu-toggle").setAttribute("aria-expanded", String(!menu.hidden));
  });
  $("notification-toggle")?.addEventListener("click", () => {
    const panel = $("notification-panel"); panel.hidden = !panel.hidden;
    $("notification-toggle").setAttribute("aria-expanded", String(!panel.hidden));
  });
  $("home-filter-button")?.addEventListener("click", () => location.hash = "#map");
  $("map-filter-button")?.addEventListener("click", () => { const panel = $("map-filter-panel"); if (panel) panel.hidden = !panel.hidden; });
  $("map-location-search")?.addEventListener("input", e => { const homeSearch = $("location-input"); if (homeSearch) homeSearch.value = e.target.value; });
  $("location-input")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); location.hash = "#map"; setTimeout(() => { const q = $("map-location-search"); if (q) { q.value = e.target.value; q.dispatchEvent(new Event("input")); } }, 120); } });
  const signOut = async () => {
    if (!client) { location.href = "signin.html"; return; }
    const { error } = await client.auth.signOut();
    if (error) { alert("Could not sign out. Please try again."); return; }
    location.href = "signin.html";
  };
  $("menu-signout")?.addEventListener("click", signOut);
  $("settings-signout")?.addEventListener("click", signOut);
  $("notification-mark-read")?.addEventListener("click", () => {
    localStorage.setItem("hysacam_notifications_read", "true");
    localStorage.setItem("hysacam_reports_read_at", String(Date.now()));
    $("notification-count").hidden = true;
    $("notification-list").innerHTML = '<p class="empty-notifications">You’re all caught up</p>';
  });
  document.querySelectorAll("[data-setting]").forEach(btn => btn.addEventListener("click", () => {
    const target = $("settings-detail"); const type = btn.dataset.setting; target.hidden = false;
    const content = {
      account: '<h3>Account Settings</h3><p>Your account details are managed securely through sign-in.</p><a class="button" href="signin.html">Manage account</a>',
      notifications: '<h3>Notifications</h3><label class="preference-row"><span>Email notifications</span><input type="checkbox" id="email-notifications"></label><label class="preference-row"><span>In-app notifications</span><input type="checkbox" id="inapp-notifications" checked></label><p class="muted">Email delivery depends on your account and Supabase email configuration.</p>',
      privacy: '<h3>Privacy &amp; Security</h3><p>Use a strong password and never share your sign-in code. Password changes and recovery are handled by the secure authentication service.</p><a class="button" href="forgot-password.html">Reset password</a>',
      preferences: '<h3>App Preferences</h3><label class="preference-row"><span>Dark appearance</span><input type="checkbox" id="dark-appearance"></label><p class="muted">Your appearance preference is saved on this device.</p>'
    };
    target.innerHTML = content[type] || '';
    const dark = $("dark-appearance"); if (dark) { dark.checked = localStorage.getItem("hysacam_dark_mode") === "true"; dark.addEventListener("change", () => { document.body.classList.toggle("dark-mode", dark.checked); localStorage.setItem("hysacam_dark_mode", String(dark.checked)); }); }
    const inapp = $("inapp-notifications"); if (inapp) { inapp.checked = localStorage.getItem("hysacam_inapp_notifications") !== "false"; inapp.addEventListener("change", () => localStorage.setItem("hysacam_inapp_notifications", String(inapp.checked))); }
    const email = $("email-notifications"); if (email) { email.checked = localStorage.getItem("hysacam_email_notifications") === "true"; email.addEventListener("change", () => localStorage.setItem("hysacam_email_notifications", String(email.checked))); }
  }));
  if (localStorage.getItem("hysacam_dark_mode") === "true") document.body.classList.add("dark-mode");
  async function loadReportActivity() {
    try {
      const response = await fetch('/api/reports', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json(); const reports = payload.reports || [];
      const recent = reports.slice(0, 3);
      const home = $('home-recent-reports');
      if (home) home.innerHTML = recent.length ? recent.map(r => `<article class="resident-report-item"><div><b>${String(r.reference_code || 'Report').replace(/[<>]/g,'')}</b><span class="status">${String(r.status || 'Submitted').replace(/[<>]/g,'')}</span></div><p>${String(r.issue_type || 'Waste issue').replace(/[<>]/g,'')} · ${String(r.area || 'Kumba').replace(/[<>]/g,'')}</p><small>${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</small></article>`).join('') : '<p class="muted">No reports have been submitted yet</p>';
      const counts = { total: reports.length, pending: 0, resolved: 0, closed: 0 };
      reports.forEach(r => { const st = String(r.status || '').toLowerCase(); if (['resolved','closed','rejected'].includes(st)) counts[st === 'rejected' ? 'closed' : st]++; else counts.pending++; });
      [['report-total',counts.total],['report-pending',counts.pending],['report-resolved',counts.resolved],['report-closed',counts.closed]].forEach(([id,n]) => { if ($(id)) $(id).textContent = n; });
      const readAt = Number(localStorage.getItem('hysacam_reports_read_at') || 0);
      const unread = reports.filter(r => new Date(r.updated_at || r.created_at || 0).getTime() > readAt);
      const badge = $('notification-count'); const list = $('notification-list');
      if (badge && unread.length && localStorage.getItem('hysacam_inapp_notifications') !== 'false') { badge.textContent = unread.length > 9 ? '9+' : String(unread.length); badge.hidden = false; }
      if (list) list.innerHTML = unread.length ? unread.slice(0,5).map(r => `<article class="notification-item"><b>${String(r.reference_code || 'Report update').replace(/[<>]/g,'')}</b><p>${String(r.status || 'Submitted').replace(/[<>]/g,'')} · ${String(r.issue_type || 'Waste report').replace(/[<>]/g,'')}</p><small>${r.updated_at || r.created_at ? new Date(r.updated_at || r.created_at).toLocaleString() : ''}</small></article>`).join('') : '<p class="empty-notifications">You’re all caught up</p>';
      $('notification-mark-read')?.addEventListener('click', () => localStorage.setItem('hysacam_reports_read_at', String(Date.now())), { once: true });
    } catch (error) { console.info('[HYSACAM] Report activity is not available yet', error); }
  }
  async function loadUser() {
    if (!client) return;
    const { data } = await client.auth.getUser(); const user = data?.user;
    if (!user) return;
    loadReportActivity();
    const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Resident";
    ["menu-user-name", "settings-user-name", "profile-name"].forEach(id => { if ($(id)) $(id).textContent = name; });
    ["menu-user-email", "settings-user-email", "profile-email"].forEach(id => { if ($(id)) $(id).textContent = user.email || ""; });
    if ($("profile-signin")) $("profile-signin").hidden = true;
    if ($("report-auth-gate")) $("report-auth-gate").hidden = true;
    if ($("resident-report-form")) $("resident-report-form").hidden = false;
    if ($("resident-my-reports")) $("resident-my-reports").hidden = false;
  }
  loadUser();
})();
