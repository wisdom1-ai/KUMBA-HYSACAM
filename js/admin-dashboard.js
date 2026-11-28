/* HYSACAM administrator portal: dashboard logic (matches admin.html with the hx- design)
   Pages: overview, manage-bins, manage-records, reports, users, settings
   Server routes used: /api/admin/me, login, verify, logout, manage, reports, audit */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const portal = $("admin-portal"), loginPage = $("admin-login-page"), form = $("admin-login-form"), message = $("auth-message");
  const PAGE_SIZE = 10;
  const SEEN_KEY = "hysacam_admin_seen_v1", PREF_KEY = "hysacam_admin_dashboard_preferences_v1";
  let email = "";
  let state = { bins: [], records: [], users: [], reports: [], audit: [] };
  let currentPage = "overview";
  const pages = { bins: 1, records: 1, reports: 1, users: 1, audit: 1 };

  /* ---------- helpers ---------- */
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const say = text => { if (message) message.textContent = text || ""; };
  const fmtDate = v => { const d = new Date(v); return v && !isNaN(d) ? d.toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—"; };
  const REPORT_LABELS = { submitted: "Submitted", under_review: "Under review", assigned: "Assigned", in_progress: "In progress", resolved: "Resolved", rejected: "Rejected" };
  const REPORT_STATES = Object.keys(REPORT_LABELS);
  const isOpenReport = s => /^(submitted|under_review)$/i.test(String(s || ""));
  const toneOf = text => {
    const t = String(text || "").toLowerCase();
    if (/reject|inactive|closed/.test(t)) return "muted";
    if (/maint|assigned|review|progress/.test(t)) return "info";
    if (/full|overflow|damag|fail|denied|unverified|not verified/.test(t)) return "bad";
    if (/pending|submitted|waiting/.test(t)) return "warn";
    return "good";
  };
  const pill = (text, tone) => `<span class="hx-pill" data-tone="${tone || toneOf(text)}">${esc(text)}</span>`;
  const td = (label, html) => `<td data-label="${esc(label)}">${html}</td>`;
  const emptyRow = (cols, text) => `<tr><td colspan="${cols}">${esc(text)}</td></tr>`;
  const binCode = id => { const b = state.bins.find(x => String(x.id) === String(id)); return b ? b.bin_code : id; };

  function toast(text, tone) {
    let box = $("admin-toast");
    if (!box) { box = document.createElement("div"); box.id = "admin-toast"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    box.textContent = text; box.dataset.tone = tone || "good"; box.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => box.classList.remove("show"), 3500);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options, credentials: "include", cache: "no-store",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const d = data.diagnostic;
      const extra = d ? `\nDatabase message: ${d.message || "Not provided"}${d.details ? `\nDetails: ${d.details}` : ""}${d.hint ? `\nHint: ${d.hint}` : ""}` : "";
      const error = new Error((data.message || "The request could not be completed") + extra);
      error.status = response.status;
      throw error;
    }
    return data;
  }
  const post = (url, body) => request(url, { method: "POST", body: JSON.stringify(body) });
  const patch = (url, body) => request(url, { method: "PATCH", body: JSON.stringify(body) });
  const del = (url, body) => request(url, { method: "DELETE", body: JSON.stringify(body) });

  /* ---------- "seen" tracking so badges clear after you look ---------- */
  let seen = { reports: [], records: [] };
  try { seen = { ...seen, ...JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") }; } catch (_) {}
  const saveSeen = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (_) {} };
  function updateBadges() {
    const nReports = state.reports.filter(r => isOpenReport(r.status) && !seen.reports.includes(String(r.id))).length;
    const nRecords = state.records.filter(r => !r.verified && !seen.records.includes(String(r.id))).length;
    [["reports", nReports], ["records", nRecords]].forEach(([k, n]) => {
      document.querySelectorAll(`[data-badge="${k}"]`).forEach(b => { b.textContent = n > 99 ? "99+" : String(n); b.hidden = !n; });
    });
  }
  function markSeen(kind) {
    const ids = state[kind].map(x => String(x.id));
    if (!ids.length) return;
    seen[kind] = Array.from(new Set([...seen[kind], ...ids])).slice(-2000);
    saveSeen(); updateBadges();
  }

  /* ---------- pager ---------- */
  function paginate(key, list) {
    const total = list.length, count = Math.max(1, Math.ceil(total / PAGE_SIZE));
    pages[key] = Math.min(Math.max(1, pages[key]), count);
    const start = (pages[key] - 1) * PAGE_SIZE;
    const el = document.querySelector(`[data-pager="${key}"]`);
    if (el) {
      el.hidden = total === 0;
      el.innerHTML = total === 0 ? "" :
        `<span>Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}</span>` +
        (count > 1 ? `<div><button type="button" class="hx-btn" data-pg="${key}" data-dir="-1" ${pages[key] === 1 ? "disabled" : ""}>Previous</button><button type="button" class="hx-btn" data-pg="${key}" data-dir="1" ${pages[key] === count ? "disabled" : ""}>Next</button></div>` : "");
    }
    return list.slice(start, start + PAGE_SIZE);
  }

  /* ---------- renderers ---------- */
  function renderOverview() {
    const bins = state.bins, records = state.records, reports = state.reports;
    const today = new Date().toDateString();
    const cleanedToday = records.filter(r => r.verified && new Date(r.cleaned_at).toDateString() === today && /clean/i.test(r.status || "")).length;
    const statusOf = b => String(b.status || "Available");
    const notReady = bins.filter(b => !/^available$/i.test(statusOf(b))).length;
    const open = reports.filter(r => isOpenReport(r.status)).length;
    $("admin-total-bins").textContent = bins.length.toLocaleString();
    $("admin-cleaned-today").textContent = cleanedToday.toLocaleString();
    $("admin-pending").textContent = notReady.toLocaleString();
    $("admin-open-reports").textContent = open.toLocaleString();

    /* chart: verified records in the last 5 months */
    const months = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 4 + i);
      return { label: d.toLocaleString("en", { month: "short" }), y: d.getFullYear(), m: d.getMonth(), count: 0 };
    });
    records.forEach(r => {
      if (!r.verified) return;
      const dt = new Date(r.cleaned_at); if (isNaN(dt)) return;
      const slot = months.find(x => x.y === dt.getFullYear() && x.m === dt.getMonth()); if (slot) slot.count++;
    });
    const max = Math.max(1, ...months.map(x => x.count));
    $("admin-cleaning-chart").innerHTML = months.map(x =>
      `<div class="hx-col"><div class="hx-plot" title="${x.count} verified records in ${x.label}"><b>${x.count}</b><i style="height:${x.count ? Math.max(4, Math.round(x.count / max * 100)) : 0}%"></i></div><small>${x.label}</small></div>`).join("");

    /* donut: bins by status */
    const groups = [["Available", "#0a7c4a"], ["Pending", "#e0a030"], ["Full", "#d64545"], ["Maintenance", "#3b7be0"], ["Inactive", "#9aa59f"]];
    const counts = groups.map(([name]) => bins.filter(b => statusOf(b).toLowerCase() === name.toLowerCase()).length);
    const total = bins.length;
    let acc = 0;
    const stops = groups.map(([, color], i) => { const from = acc; acc += total ? counts[i] / total * 100 : 0; return counts[i] ? `${color} ${from}% ${acc}%` : null; }).filter(Boolean);
    $("admin-bin-donut").style.background = total && stops.length ? `conic-gradient(${stops.join(",")})` : "#edf0ee";
    $("admin-cleaned-percent").textContent = total ? Math.round(counts[0] / total * 100) + "%" : "—";
    $("admin-status-list").innerHTML = groups.map(([name, color], i) => `<li style="--c:${color}"><i></i>${name}<b>${counts[i]}</b></li>`).join("");

    /* recent feeds */
    const recent = [...records].sort((a, b) => new Date(b.cleaned_at) - new Date(a.cleaned_at)).slice(0, 5);
    $("admin-recent-records").innerHTML = recent.length ? recent.map(r =>
      `<li><div><b>${esc(binCode(r.bin_id))}</b><small>${esc(r.area || "")} · ${esc(fmtDate(r.cleaned_at))}</small></div>${pill(r.status || "Recorded")}</li>`).join("") : '<li class="hx-empty">No cleaning records yet</li>';
    const toReview = reports.filter(r => isOpenReport(r.status)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    $("admin-recent-reports").innerHTML = toReview.length ? toReview.map(r =>
      `<li><div><b>${esc(r.reference_code)}</b><small>${esc(r.issue_type)} · ${esc(r.area)}</small></div>${pill(REPORT_LABELS[r.status] || r.status, toneOf(r.status))}</li>`).join("") : '<li class="hx-empty">No reports waiting</li>';
    $("admin-updated").textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function renderBins() {
    const q = ($("admin-bin-search").value || "").toLowerCase(), f = ($("admin-bin-filter").value || "").toLowerCase();
    const rows = state.bins.filter(b => (!f || String(b.status || "available").toLowerCase() === f) && [b.bin_code, b.name, b.area, b.status].join(" ").toLowerCase().includes(q));
    const shown = paginate("bins", rows);
    $("admin-bins-table").innerHTML = shown.length ? shown.map(b => `<tr>${td("ID", `<b>${esc(b.bin_code)}</b>`)}${td("Name", esc(b.name))}${td("Area", esc(b.area))}${td("Status", pill(b.status || "Available"))}${td("Actions", `<div class="hx-rowactions"><button type="button" class="hx-link" data-edit-bin="${esc(b.id)}">Edit</button><button type="button" class="hx-link hx-dangertext" data-delete-bin="${esc(b.id)}">Delete</button></div>`)}</tr>`).join("") : emptyRow(5, state.bins.length ? "No matching dustbins found" : "No dustbins registered yet. Use Add dustbin to create the first one");
    $("record-bin-id").innerHTML = `<option value="">Select a dustbin</option>${state.bins.map(b => `<option value="${esc(b.id)}">${esc(b.bin_code)} — ${esc(b.area)}</option>`).join("")}`;
  }

  function renderRecords() {
    const q = ($("admin-record-search").value || "").toLowerCase();
    const rows = state.records.filter(r => [binCode(r.bin_id), r.area, r.activity, r.status].join(" ").toLowerCase().includes(q));
    const shown = paginate("records", rows);
    $("admin-records-table").innerHTML = shown.length ? shown.map(r => `<tr>${td("Dustbin ID", `<b>${esc(binCode(r.bin_id))}</b>`)}${td("Location", esc(r.area))}${td("Date and time", esc(fmtDate(r.cleaned_at)))}${td("Activity", esc(r.activity || "Cleaning"))}${td("Status", pill(r.status || "Recorded"))}${td("Verification", r.verified ? pill("Verified", "good") : pill("Pending verification", "warn"))}</tr>`).join("") : emptyRow(6, state.records.length ? "No matching records found" : "No cleaning records have been registered");
  }

  function renderReports() {
    const q = ($("admin-report-search").value || "").toLowerCase(), f = $("admin-report-filter").value || "";
    const rows = state.reports.filter(r => (!f || r.status === f) && [r.reference_code, r.issue_type, r.area, r.location_description, r.reporter_name, r.reporter_email].join(" ").toLowerCase().includes(q));
    const shown = paginate("reports", rows);
    $("admin-reports-table").innerHTML = shown.length ? shown.map(r => `<tr>${td("Reference", `<b title="Click to copy">${esc(r.reference_code)}</b>`)}${td("Issue", `${esc(r.issue_type)}${r.location_description ? `<br><small>${esc(r.location_description)}</small>` : ""}`)}${td("Area", esc(r.area))}${td("Submitted by", esc(r.reporter_name || r.reporter_email || "Resident"))}${td("Status", `<select class="admin-report-status" data-report-status="${esc(r.id)}" data-tone="${toneOf(r.status)}" aria-label="Report status">${REPORT_STATES.map(v => `<option value="${v}" ${r.status === v ? "selected" : ""}>${REPORT_LABELS[v]}</option>`).join("")}</select>`)}${td("Update", `<button class="hx-link" type="button" data-save-report="${esc(r.id)}">Save</button>`)}</tr>`).join("") : emptyRow(6, state.reports.length ? "No matching reports found" : "No resident reports yet");
  }

  function renderUsers() {
    const q = ($("admin-user-search").value || "").toLowerCase();
    const rows = state.users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q));
    const shown = paginate("users", rows);
    $("admin-users-table").innerHTML = shown.length ? shown.map(u => `<tr>${td("Name", `<span class="hx-person"><i>${esc((u.name || u.email || "?").trim().charAt(0).toUpperCase())}</i>${esc(u.name || "—")}</span>`)}${td("Email", esc(u.email))}${td("Role", pill(u.role || "resident", /admin/i.test(u.role || "") ? "info" : "muted"))}${td("Email verified", u.email_confirmed ? pill("Verified", "good") : pill("Not verified", "warn"))}${td("Joined", esc(fmtDate(u.created_at)))}</tr>`).join("") : emptyRow(5, "No matching users found");
  }

  function renderAudit() {
    const shown = paginate("audit", state.audit);
    $("admin-audit-table").innerHTML = shown.length ? shown.map(x => `<tr>${td("Time", esc(fmtDate(x.created_at)))}${td("Administrator", esc(x.email))}${td("Event", esc(x.event))}${td("Outcome", pill(x.outcome || "—", /fail|denied|error|reject/i.test(x.outcome || "") ? "bad" : "good"))}</tr>`).join("") : emptyRow(4, "No audit events available");
  }

  const renderers = { bins: renderBins, records: renderRecords, reports: renderReports, users: renderUsers, audit: renderAudit };
  const renderAll = () => { renderOverview(); renderBins(); renderRecords(); renderReports(); renderUsers(); renderAudit(); updateBadges(); };

  /* ---------- loading ---------- */
  async function loadReports() {
    try { const d = await request("/api/admin/reports"); state.reports = (d.reports || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); }
    catch (e) { if (e.status === 401) return expired(); $("admin-reports-table").innerHTML = emptyRow(6, e.message); return; }
    renderReports(); renderOverview();
    if (currentPage === "reports") markSeen("reports"); else updateBadges();
  }
  async function loadAudit() {
    try { const d = await request("/api/admin/audit"); state.audit = d.events || []; }
    catch (e) { if (e.status !== 401) $("admin-audit-table").innerHTML = emptyRow(4, e.message); return; }
    renderAudit();
  }
  async function loadAll() {
    try {
      const d = await request("/api/admin/manage");
      state.bins = d.bins || []; state.records = d.records || []; state.users = d.users || [];
      renderAll();
      await Promise.all([loadReports(), loadAudit()]);
      if (currentPage === "manage-records") markSeen("records");
      return true;
    } catch (e) {
      if (e.status === 401) { expired(); return false; }
      $("admin-bins-table").innerHTML = emptyRow(5, e.message);
      $("admin-records-table").innerHTML = emptyRow(6, e.message);
      toast("Could not load dashboard data", "bad");
      return false;
    }
  }

  /* ---------- pages ---------- */
  const META = {
    "overview": ["Dashboard", "Overview of waste collection in Kumba"],
    "manage-bins": ["Dustbins", "Register, update and remove collection points"],
    "manage-records": ["Cleaning records", "Review verified activity and add new records"],
    "reports": ["Resident reports", "Review and update waste issue submissions"],
    "users": ["Users", "Registered accounts and verification status"],
    "settings": ["Settings", "Access, preferences and security activity"]
  };
  function showPage() {
    let id = (location.hash || "#overview").slice(1);
    if (!META[id]) id = "overview";
    currentPage = id;
    document.querySelectorAll(".admin-page").forEach(p => { p.hidden = p.dataset.page !== id; });
    $("admin-page-title").textContent = META[id][0];
    $("admin-page-sub").textContent = META[id][1];
    document.querySelectorAll("[data-nav]").forEach(a => {
      if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (id === "reports") markSeen("reports");
    if (id === "manage-records") markSeen("records");
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", showPage);

  /* ---------- sign in / out ---------- */
  function setStage(code) {
    $("admin-password-stage").hidden = code; $("admin-code-stage").hidden = !code;
    $("admin-email").required = !code; $("admin-password").required = !code;
    form.classList.toggle("admin-verifying", code);
    $("admin-form-title").textContent = code ? "Verify Your Email" : "Administrator sign in";
    $("admin-form-copy").textContent = code ? "Enter the 6 digit code sent to your email" : "Enter your authorised account credentials to continue";
  }
  function showLogin(text) {
    portal.classList.remove("authorized");
    loginPage.style.display = "grid";
    form.reset(); setStage(false); say(text || "");
    window.scrollTo(0, 0);
  }
  const expired = () => showLogin("Your session has expired. Please sign in again");

  async function openDashboard() {
    const response = await fetch("/api/admin/me", { credentials: "include", cache: "no-store" });
    if (!response.ok) return false;
    const auth = await response.json();
    if (!auth.authenticated || auth.role !== "administrator") return false;
    email = auth.email || email;
    const name = (email.split("@")[0] || "Administrator").replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    $("admin-welcome").textContent = name;
    $("admin-avatar").textContent = name.charAt(0).toUpperCase();
    $("admin-profile-email").textContent = email || "Administrator account";
    const h = new Date().getHours();
    $("admin-greeting").textContent = `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, ${name.split(" ")[0]}`;
    $("admin-today").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    loginPage.style.display = "none";
    portal.classList.add("authorized");
    showPage();
    await loadAll();
    return true;
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!$("admin-code-stage").hidden) { $("admin-verify").click(); return; }
    say("");
    email = $("admin-email").value.trim().toLowerCase();
    if (!email || !$("admin-password").value) { say("Enter your email and password"); return; }
    const button = $("admin-submit");
    button.disabled = true; button.textContent = "Checking account…";
    try {
      await post("/api/admin/login", { email, password: $("admin-password").value });
      setStage(true); $("admin-code").focus();
    } catch (error) { say(error.message); }
    finally { button.disabled = false; button.textContent = "Continue securely"; }
  });

  $("admin-verify")?.addEventListener("click", async () => {
    say("");
    const code = $("admin-code").value.trim();
    if (!/^\d{6}$/.test(code)) { say("Enter the complete six-digit code"); return; }
    const button = $("admin-verify"); button.disabled = true; button.textContent = "Verifying…";
    try {
      await post("/api/admin/verify", { email, code });
      if (!await openDashboard()) throw new Error("Your administrator session could not be confirmed");
    } catch (error) { say(error.message); }
    finally { button.disabled = false; button.textContent = "Verify Code"; }
  });

  $("admin-back")?.addEventListener("click", () => { $("admin-code").value = ""; setStage(false); say(""); });

  async function signOut() {
    closeProfile();
    try { await fetch("/api/admin/logout", { method: "POST", credentials: "include" }); } catch (_) {}
    showLogin("You have signed out");
  }
  $("admin-logout")?.addEventListener("click", signOut);
  $("admin-profile-logout")?.addEventListener("click", signOut);

  /* ---------- profile menu ---------- */
  const profileToggle = $("admin-profile-toggle"), profileMenu = $("admin-profile-popover");
  function closeProfile() { if (profileMenu) profileMenu.hidden = true; profileToggle?.setAttribute("aria-expanded", "false"); }
  profileToggle?.addEventListener("click", e => {
    e.stopPropagation();
    const open = profileMenu.hidden; profileMenu.hidden = !open;
    profileToggle.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", e => { if (profileMenu && !profileMenu.hidden && !e.target.closest(".hx-profile")) closeProfile(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeProfile(); });
  $("admin-profile-settings")?.addEventListener("click", () => { closeProfile(); location.hash = "#settings"; });

  /* ---------- refresh ---------- */
  async function refresh(button) {
    if (button) button.disabled = true;
    const ok = await loadAll();
    if (button) button.disabled = false;
    if (ok) toast("Data refreshed");
  }
  $("admin-quick-refresh")?.addEventListener("click", e => refresh(e.currentTarget));
  $("admin-refresh-reports")?.addEventListener("click", async e => { e.currentTarget.disabled = true; await loadReports(); e.currentTarget.disabled = false; toast("Reports refreshed"); });

  /* ---------- pager + filters ---------- */
  portal.addEventListener("click", e => {
    const b = e.target.closest("[data-pg]"); if (!b || b.disabled) return;
    pages[b.dataset.pg] += Number(b.dataset.dir);
    renderers[b.dataset.pg]?.();
  });
  [["admin-bin-search", "bins", renderBins], ["admin-bin-filter", "bins", renderBins], ["admin-record-search", "records", renderRecords],
   ["admin-report-search", "reports", renderReports], ["admin-report-filter", "reports", renderReports], ["admin-user-search", "users", renderUsers]
  ].forEach(([id, key, fn]) => $(id)?.addEventListener("input", () => { pages[key] = 1; fn(); }));

  /* ---------- dialogs ---------- */
  const openDialog = d => { if (typeof d.showModal === "function") { if (!d.open) d.showModal(); } else d.setAttribute("open", ""); };
  const closeDialog = d => { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); };
  portal.addEventListener("click", e => {
    const c = e.target.closest("[data-close]");
    if (c) { const d = c.closest("dialog"); if (d) closeDialog(d); return; }
    if (e.target.matches("dialog.hx-drawer")) closeDialog(e.target);
  });

  const binDialog = $("admin-bin-dialog"), recordDialog = $("admin-record-dialog");

  function openBin(bin) {
    $("admin-bin-form").reset();
    $("bin-form-message").textContent = "";
    $("bin-edit-id").value = bin ? bin.id : "";
    $("bin-id").disabled = Boolean(bin);
    $("bin-dialog-title").textContent = bin ? "Edit dustbin" : "Add dustbin";
    $("bin-save").textContent = bin ? "Update dustbin" : "Save dustbin";
    if (bin) {
      $("bin-id").value = bin.bin_code || ""; $("bin-name").value = bin.name || ""; $("bin-area").value = bin.area || "";
      $("bin-lat").value = bin.latitude ?? ""; $("bin-lng").value = bin.longitude ?? "";
      const opt = [...$("bin-status").options].find(o => o.textContent.toLowerCase() === String(bin.status || "available").toLowerCase());
      $("bin-status").value = opt ? opt.value : "Available";
    }
    openDialog(binDialog);
    setTimeout(() => $(bin ? "bin-name" : "bin-id").focus(), 60);
  }
  $("admin-add-bin")?.addEventListener("click", () => openBin(null));
  $("admin-quick-bin")?.addEventListener("click", () => { location.hash = "#manage-bins"; setTimeout(() => openBin(null), 60); });

  $("admin-bin-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const editing = Boolean($("bin-edit-id").value);
    const payload = { bin_code: $("bin-id").value.trim(), id: $("bin-edit-id").value, name: $("bin-name").value.trim(), area: $("bin-area").value.trim(), latitude: $("bin-lat").value, longitude: $("bin-lng").value, status: $("bin-status").value };
    if (!payload.bin_code || !payload.name || !payload.area) { $("bin-form-message").textContent = "Fill in the dustbin ID, name and area"; return; }
    const lat = parseFloat(payload.latitude), lng = parseFloat(payload.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { $("bin-form-message").textContent = "Enter a valid latitude and longitude, or tap Use my current location"; return; }
    payload.latitude = lat; payload.longitude = lng;
    const button = $("bin-save"); button.disabled = true; $("bin-form-message").textContent = "";
    try {
      await (editing ? patch("/api/admin/manage", payload) : post("/api/admin/manage", { type: "bin", ...payload }));
      closeDialog(binDialog);
      toast(editing ? "Dustbin updated" : "Dustbin added");
      await loadAll();
    } catch (error) {
      if (error.status === 401) { closeDialog(binDialog); return expired(); }
      $("bin-form-message").textContent = error.message;
    } finally { button.disabled = false; }
  });

  /* confirm box for deletes */
  function confirmBox(title, text, okLabel) {
    return new Promise(resolve => {
      const d = document.createElement("dialog");
      d.className = "hx-confirm";
      d.innerHTML = `<h2>${esc(title)}</h2><p>${esc(text)}</p><div><button type="button" class="hx-btn" data-x="0">Cancel</button><button type="button" class="hx-btn hx-destroy" data-x="1">${esc(okLabel)}</button></div>`;
      portal.appendChild(d);
      d.addEventListener("click", e => { const b = e.target.closest("[data-x]"); if (b) { resolve(b.dataset.x === "1"); closeDialog(d); } });
      d.addEventListener("close", () => { resolve(false); d.remove(); });
      openDialog(d);
    });
  }

  $("admin-bins-table")?.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-bin]"), remove = event.target.closest("[data-delete-bin]");
    if (edit) { const bin = state.bins.find(b => String(b.id) === edit.dataset.editBin); if (bin) openBin(bin); return; }
    if (remove) {
      const bin = state.bins.find(b => String(b.id) === remove.dataset.deleteBin);
      const ok = await confirmBox("Delete dustbin?", `${bin ? bin.bin_code : "This dustbin"} will be removed. This may be blocked if cleaning records refer to it`, "Delete");
      if (!ok) return;
      try { await del("/api/admin/manage", { id: remove.dataset.deleteBin }); toast("Dustbin deleted"); await loadAll(); }
      catch (error) { if (error.status === 401) return expired(); toast(error.message.split("\n")[0], "bad"); }
    }
  });

  /* records */
  function openRecord() {
    $("admin-record-form").reset();
    $("record-form-message").textContent = "";
    $("record-cleaned-at").value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    openDialog(recordDialog);
  }
  $("admin-add-record")?.addEventListener("click", openRecord);
  $("admin-quick-record")?.addEventListener("click", () => { location.hash = "#manage-records"; setTimeout(openRecord, 60); });
  $("record-bin-id")?.addEventListener("change", () => {
    const bin = state.bins.find(b => String(b.id) === $("record-bin-id").value);
    if (bin) $("record-area").value = bin.area || "";
  });
  $("admin-record-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const when = new Date($("record-cleaned-at").value);
    if (!$("record-bin-id").value) { $("record-form-message").textContent = "Select a dustbin"; return; }
    if (isNaN(when)) { $("record-form-message").textContent = "Enter a valid date and time"; return; }
    const button = $("record-save"); button.disabled = true; $("record-form-message").textContent = "";
    try {
      await post("/api/admin/manage", { type: "record", bin_id: $("record-bin-id").value, area: $("record-area").value.trim(), cleaned_at: when.toISOString(), activity: $("record-activity").value.trim(), status: $("record-status").value, notes: $("record-notes").value.trim() });
      closeDialog(recordDialog); toast("Cleaning record added"); await loadAll();
    } catch (error) {
      if (error.status === 401) { closeDialog(recordDialog); return expired(); }
      $("record-form-message").textContent = error.message;
    } finally { button.disabled = false; }
  });

  $("admin-export-records")?.addEventListener("click", () => {
    const cell = v => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const lines = [["Dustbin ID", "Location", "Date", "Activity", "Status", "Verified", "Notes"].map(cell).join(",")]
      .concat(state.records.map(r => [binCode(r.bin_id), r.area, r.cleaned_at, r.activity, r.status, r.verified ? "Yes" : "No", r.notes].map(cell).join(",")));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "hysacam-cleaning-records.csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Records exported");
  });

  /* reports: status change + save */
  $("admin-reports-table")?.addEventListener("change", e => {
    const s = e.target.closest("select[data-report-status]"); if (!s) return;
    s.dataset.tone = toneOf(s.value);
    const btn = s.closest("tr")?.querySelector("[data-save-report]"); if (btn) { btn.textContent = "Save"; btn.disabled = false; }
  });
  $("admin-reports-table")?.addEventListener("click", async e => {
    const button = e.target.closest("[data-save-report]");
    if (!button) return;
    const id = button.dataset.saveReport;
    const status = $("admin-reports-table").querySelector(`[data-report-status="${CSS.escape(id)}"]`)?.value;
    button.disabled = true;
    try {
      await patch("/api/admin/reports", { id, status });
      const r = state.reports.find(x => String(x.id) === String(id)); if (r) r.status = status;
      button.textContent = "Saved"; toast("Report updated");
      renderOverview(); updateBadges();
    } catch (error) { if (error.status === 401) return expired(); toast(error.message.split("\n")[0], "bad"); button.disabled = false; }
  });
  $("admin-reports-table")?.addEventListener("click", e => {
    const ref = e.target.closest("td:first-child b");
    if (ref && navigator.clipboard) navigator.clipboard.writeText(ref.textContent.trim()).then(() => toast("Reference copied")).catch(() => {});
  });

  /* ---------- preferences (this device only) ---------- */
  const prefCompact = $("admin-setting-compact"), prefMotion = $("admin-setting-reduced-motion"), feedback = $("admin-setting-feedback");
  const applyPrefs = p => {
    portal.classList.toggle("compact", Boolean(p.compact)); portal.classList.toggle("still", Boolean(p.reduceMotion));
    if (prefCompact) prefCompact.checked = Boolean(p.compact); if (prefMotion) prefMotion.checked = Boolean(p.reduceMotion);
  };
  let prefs = { compact: false, reduceMotion: false };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") }; } catch (_) {}
  applyPrefs(prefs);
  $("admin-setting-save")?.addEventListener("click", () => {
    prefs = { compact: Boolean(prefCompact?.checked), reduceMotion: Boolean(prefMotion?.checked) };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); applyPrefs(prefs); feedback.textContent = "Preferences saved on this device"; }
    catch (_) { feedback.textContent = "Could not save preferences in this browser"; }
  });
  $("admin-setting-reset")?.addEventListener("click", () => {
    prefs = { compact: false, reduceMotion: false };
    try { localStorage.removeItem(PREF_KEY); } catch (_) {}
    applyPrefs(prefs); feedback.textContent = "Preferences reset";
  });

  showPage();
  openDashboard().catch(error => console.warn("[HYSACAM admin]", error));
})();
