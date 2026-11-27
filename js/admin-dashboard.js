(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("admin-login-form");
  const loginPage = $("admin-login-page");
  const portal = $("admin-portal");
  const message = $("auth-message");
  let email = "";
  let state = { bins: [], records: [], users: [] };

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
  const say = value => { if (message) message.textContent = value || ""; };
  const localDate = value => value ? new Date(value).toLocaleString() : "—";
  const lower = v => String(v ?? "").toLowerCase();
  const dayKey = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toDateString(); };
  const label = v => { const t = String(v ?? "").replaceAll("_", " "); return t.charAt(0).toUpperCase() + t.slice(1); };
  const TONES = { available:"good", cleaned:"good", resolved:"good", success:"good", pending:"warn", full:"bad", maintenance:"warn", inactive:"muted", "in progress":"info", in_progress:"info", assigned:"info", under_review:"warn", submitted:"info", rejected:"muted" };
  const tone = v => TONES[lower(v)] || "muted";
  const pill = v => `<span class="status" data-tone="${tone(v)}">${esc(label(v))}</span>`;
  const row = (labels, cells) => `<tr>${cells.map((c, i) => `<td data-label="${labels[i]}">${c}</td>`).join("")}</tr>`;
  const emptyRow = (span, text) => `<tr><td colspan="${span}">${esc(text)}</td></tr>`;
  const setBadge = (name, count) => document.querySelectorAll(`[data-badge="${name}"]`).forEach(b => {
    b.textContent = count > 99 ? "99+" : count; b.hidden = !count;
  });

  function toast(text, kind = "good") {
    let box = $("admin-toast");
    if (!box) { box = document.createElement("div"); box.id = "admin-toast"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    box.textContent = text; box.dataset.tone = kind; box.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.remove("show"), 4000);
  }

  function confirmAction(title, text) {
    if (typeof HTMLDialogElement !== "function") return Promise.resolve(window.confirm(`${title}\n${text}`));
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.className = "admin-confirm";
      dialog.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3><p>${esc(text)}</p><div><button value="no" autofocus>Cancel</button><button value="yes" class="danger">Delete</button></div></form>`;
      dialog.addEventListener("close", () => { resolve(dialog.returnValue === "yes"); dialog.remove(); });
      document.body.appendChild(dialog); dialog.showModal();
    });
  }

  function showCodeStage(on) {
    $("admin-code-stage").hidden = !on; $("admin-password-stage").hidden = on;
    $("admin-code").required = on; $("admin-code").value = "";
    $("admin-code").dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelectorAll(".otp-boxes input").forEach(i => { i.value = ""; });
    form.classList.toggle("admin-verifying", on);
    $("admin-form-title").textContent = on ? "Verify Your Email" : "Administrator sign in";
    $("admin-form-copy").textContent = on ? "Enter the 6 digit code sent to your email" : "Enter your authorised account credentials to continue";
  }

  function showLogin(text) {
    portal.classList.remove("authorized"); loginPage.style.display = "";
    form.reset(); showCodeStage(false); say(text);
    state = { bins: [], records: [], users: [] };
    ["admin-bins-table","admin-records-table","admin-users-table","admin-reports-table","admin-audit-table"].forEach(id => { $(id).innerHTML = ""; });
    window.scrollTo(0, 0);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.diagnostic) console.warn("[HYSACAM admin]", data.diagnostic);
      // An expired session sends the administrator back to sign in
      if (response.status === 401 && portal.classList.contains("authorized")) showLogin("Your session has expired, please sign in again");
      throw new Error(data.message || "The request could not be completed");
    }
    return data;
  }
  const post = (url, body) => request(url, { method: "POST", body: JSON.stringify(body) });
  const patch = (url, body) => request(url, { method: "PATCH", body: JSON.stringify(body) });
  const del = (url, body) => request(url, { method: "DELETE", body: JSON.stringify(body) });

  async function openDashboard() {
    const response = await fetch("/api/admin/me", { credentials: "include", cache: "no-store" });
    if (!response.ok) return false;
    const auth = await response.json();
    if (!auth.authenticated || auth.role !== "administrator") return false;
    email = auth.email || email;
    $("admin-welcome").textContent = email || "Welcome, Admin";
    const initial = (email || "A").charAt(0).toUpperCase();
    $("admin-avatar").textContent = initial; $("admin-avatar-big").textContent = initial;
    loginPage.style.display = "none";
    portal.classList.add("authorized");
    await loadAll();
    return true;
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!$("admin-code-stage").hidden) { $("admin-verify").click(); return; }
    say("");
    email = $("admin-email").value.trim().toLowerCase();
    if (!$("admin-email").checkValidity() || !$("admin-password").value) { say("Enter a valid email address and your password"); return; }
    const button = $("admin-submit");
    button.disabled = true; button.textContent = "Checking account…";
    try {
      await post("/api/admin/login", { email, password: $("admin-password").value });
      showCodeStage(true);
      $("admin-code").focus();
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

  $("admin-back")?.addEventListener("click", () => { showCodeStage(false); say(""); });

  function renderStats() {
    const today = new Date().toDateString(); // local day, not UTC
    const cleanedToday = state.records.filter(r => r.verified && dayKey(r.cleaned_at) === today && String(r.status || "").toLowerCase().includes("clean")).length;
    const pending = state.bins.filter(b => /pending|full|maintenance|inactive/i.test(b.status || "")).length;
    $("admin-total-bins").textContent = state.bins.length.toLocaleString();
    $("admin-cleaned-today").textContent = cleanedToday.toLocaleString();
    $("admin-pending").textContent = pending.toLocaleString();
    const available = state.bins.filter(b => lower(b.status || "available") === "available").length;
    const pct = state.bins.length ? Math.round(available / state.bins.length * 100) : 0;
    $("admin-cleaned-percent").textContent = state.bins.length ? `${pct}%` : "—";
    $("admin-bin-donut").style.setProperty("--cleaned", `${pct}%`);
    const counts = Array.from({length:5}, (_,i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 4 + i);
      return { label:d.toLocaleString("en",{month:"short"}), count:state.records.filter(r => {
        const dt = new Date(r.cleaned_at); return r.verified && dt.getFullYear()===d.getFullYear() && dt.getMonth()===d.getMonth();
      }).length };
    });
    const max = Math.max(1, ...counts.map(x=>x.count));
    const points = counts.map((x,i)=>({x:42+i*105,y:164-(x.count/max)*118,...x}));
    const path = points.map((p,i)=>(i?"L":"M")+` ${p.x} ${p.y}`).join(" ");
    const area = `${path} L 462 180 L 42 180 Z`;
    $("admin-cleaning-chart").innerHTML = `<div class="admin-line-chart"><svg viewBox="0 0 500 220" role="img" aria-label="Monthly verified cleaning activity"><line x1="42" y1="28" x2="462" y2="28" class="chart-grid"/><line x1="42" y1="104" x2="462" y2="104" class="chart-grid"/><line x1="42" y1="180" x2="462" y2="180" class="chart-grid"/><text x="8" y="32" class="chart-axis">${max}</text><text x="8" y="184" class="chart-axis">0</text><path d="${area}" fill="#16a66a" opacity=".12"/><path d="${path}" class="chart-line"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="6" class="chart-point"><title>${p.count} verified in ${p.label}</title></circle><text x="${p.x}" y="${p.y-13}" text-anchor="middle" class="chart-value">${p.count}</text><text x="${p.x}" y="207" text-anchor="middle" class="chart-month">${p.label}</text>`).join("")}</svg></div>`;
  }

  function renderBinOptions() {
    const select = $("record-bin-id"), chosen = select.value;
    select.innerHTML = `<option value="">Select a dustbin</option>${state.bins.map(b=>`<option value="${esc(b.id)}">${esc(b.bin_code)} — ${esc(b.area)}</option>`).join("")}`;
    select.value = chosen;
  }

  function renderBins() {
    const q = lower($("admin-bin-search").value).trim();
    const rows = state.bins.filter(b => lower([b.bin_code,b.name,b.area,b.status].join(" ")).includes(q));
    $("admin-bin-count").textContent = `${state.bins.length} registered ${state.bins.length === 1 ? "dustbin" : "dustbins"}`;
    $("admin-bins-table").innerHTML = rows.length ? rows.map(b => row(["ID","Name","Area","Status","Actions"], [
      `<b>${esc(b.bin_code)}</b>`, esc(b.name), esc(b.area), pill(b.status || "Available"),
      `<div class="admin-row-actions"><button type="button" class="admin-action-link" data-edit-bin="${esc(b.id)}">Edit</button><button type="button" class="admin-action-link danger" data-delete-bin="${esc(b.id)}">Delete</button></div>`
    ])).join("") : emptyRow(5, q ? "No matching dustbins found" : "No dustbins registered yet");
  }

  const binCode = r => state.bins.find(b=>String(b.id)===String(r.bin_id))?.bin_code || r.bin_id;
  const filteredRecords = () => {
    const q = lower($("admin-record-search").value).trim();
    return state.records.filter(r => lower([binCode(r),r.area,r.activity,r.status,localDate(r.cleaned_at)].join(" ")).includes(q));
  };

  function renderRecords() {
    const rows = filteredRecords();
    $("admin-record-count").textContent = $("admin-record-search").value.trim() ? `${rows.length} of ${state.records.length} records shown` : `${state.records.length} ${state.records.length === 1 ? "record" : "records"}`;
    $("admin-records-table").innerHTML = rows.length ? rows.map(r => row(["Dustbin ID","Location","Date & time","Activity","Status","Verification"], [
      `<b>${esc(binCode(r))}</b>`, esc(r.area), esc(localDate(r.cleaned_at)), esc(r.activity || "Cleaning"), pill(r.status || "Recorded"), r.verified ? "Verified" : "Pending verification"
    ])).join("") : emptyRow(6, state.records.length ? "No matching records found" : "No cleaning records have been registered");
    setBadge("records", state.records.filter(r => !r.verified).length);
  }

  function exportRecords() {
    const rows = filteredRecords();
    if (!rows.length) { toast("There are no records to export", "bad"); return; }
    // A leading apostrophe stops spreadsheets running text as a formula
    const cell = v => { let t = String(v ?? ""); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replaceAll('"','""')}"`; };
    const lines = [["Dustbin ID","Location","Date and time","Activity","Status","Verification","Notes"],
      ...rows.map(r => [binCode(r),r.area,localDate(r.cleaned_at),r.activity,r.status,r.verified?"Verified":"Pending verification",r.notes])];
    const url = URL.createObjectURL(new Blob(["\ufeff" + lines.map(l => l.map(cell).join(",")).join("\r\n")], { type:"text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `hysacam-cleaning-records-${new Date().toLocaleDateString("en-CA")}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${rows.length} ${rows.length === 1 ? "record" : "records"}`);
  }

  function renderUsers() {
    const q = lower($("admin-user-search").value).trim();
    const rows = state.users.filter(u => lower(`${u.name || ""} ${u.email} ${u.role}`).includes(q));
    $("admin-user-count").textContent = `${state.users.length} ${state.users.length === 1 ? "account" : "accounts"}`;
    $("admin-users-table").innerHTML = rows.length ? rows.map(u => row(["Name","Email","Role","Email verified","Joined"], [
      esc(u.name || "—"), esc(u.email), `<span class="status" data-tone="info">${esc(label(u.role))}</span>`, u.email_confirmed ? "Verified" : "Not verified", esc(localDate(u.created_at))
    ])).join("") : emptyRow(5, "No matching users found");
  }

  const OPEN_REPORTS = ["submitted","under_review"];
  let reports = [];
  const updateReportBadge = () => setBadge("reports", reports.filter(r => OPEN_REPORTS.includes(r.status)).length);

  async function loadReports() {
    try {
      const data = await request("/api/admin/reports");
      reports = data.reports || [];
      $("admin-reports-table").innerHTML = reports.length ? reports.map(r => row(["Reference","Issue","Area","Submitted by","Status","Update"], [
        `<b>${esc(r.reference_code)}</b>`, esc(r.issue_type), esc(r.area), esc(r.reporter_name || r.reporter_email || "Resident"),
        `<select class="admin-report-status" aria-label="Status for report ${esc(r.reference_code)}" data-tone="${tone(r.status)}" data-report-status="${esc(r.id)}">${["submitted","under_review","assigned","in_progress","resolved","rejected"].map(v=>`<option value="${v}" ${r.status===v?"selected":""}>${label(v)}</option>`).join("")}</select>`,
        `<button class="admin-action-link" type="button" data-save-report="${esc(r.id)}" disabled>Save</button>`
      ])).join("") : emptyRow(6, "No resident reports yet");
      updateReportBadge();
      return true;
    } catch (error) { if (portal.classList.contains("authorized")) $("admin-reports-table").innerHTML = emptyRow(6, error.message); return false; }
  }

  async function loadAudit() {
    try {
      const data = await request("/api/admin/audit");
      $("admin-audit-table").innerHTML = (data.events || []).length ? data.events.map(x => row(["Time","Administrator","Event","Outcome"], [esc(localDate(x.created_at)), esc(x.email), esc(x.event), esc(x.outcome)])).join("") : emptyRow(4, "No audit events available");
      return true;
    } catch (error) { if (portal.classList.contains("authorized")) $("admin-audit-table").innerHTML = emptyRow(4, error.message); return false; }
  }

  // Resolves to true only when every part of the dashboard loaded
  async function loadAll() {
    try {
      const data = await request("/api/admin/manage");
      state = { bins:data.bins || [], records:data.records || [], users:data.users || [] };
      renderStats(); renderBinOptions(); renderBins(); renderRecords(); renderUsers();
      const results = await Promise.all([loadReports(),loadAudit()]);
      const ok = results.every(Boolean);
      if (ok) $("admin-updated").textContent = `Updated ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
      return ok;
    } catch (error) {
      if (!portal.classList.contains("authorized")) return false;
      [["admin-bins-table",5],["admin-records-table",6],["admin-users-table",5],["admin-reports-table",6],["admin-audit-table",4]]
        .forEach(([id,span]) => { $(id).innerHTML = emptyRow(span, error.message); });
      $("admin-updated").textContent = "Update failed";
      return false;
    }
  }

  function resetBinForm() {
    $("admin-bin-form").hidden = true; $("admin-bin-form").reset();
    $("bin-edit-id").value = ""; $("bin-id").disabled = false;
    $("bin-save").textContent = "Save dustbin"; $("bin-form-message").textContent = "";
  }
  $("admin-add-bin")?.addEventListener("click", () => {
    resetBinForm(); $("admin-bin-form").hidden = false;
    $("admin-bin-form").scrollIntoView({behavior:"smooth",block:"center"});
  });
  $("bin-cancel")?.addEventListener("click", resetBinForm);
  $("admin-bin-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const editing = Boolean($("bin-edit-id").value);
    const payload = { bin_code:$("bin-id").value.trim(), id:$("bin-edit-id").value, name:$("bin-name").value.trim(), area:$("bin-area").value.trim(), latitude:$("bin-lat").value, longitude:$("bin-lng").value, status:$("bin-status").value };
    const button = $("bin-save"); button.disabled = true;
    try {
      await (editing ? patch("/api/admin/manage",payload) : post("/api/admin/manage",{type:"bin",...payload}));
      resetBinForm(); toast(editing ? "Dustbin updated" : "Dustbin added"); await loadAll();
    } catch (error) { $("bin-form-message").textContent = error.message; }
    finally { button.disabled = false; }
  });

  $("admin-bins-table")?.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-bin]");
    const remove = event.target.closest("[data-delete-bin]");
    if (edit) {
      const bin = state.bins.find(b=>String(b.id)===edit.dataset.editBin); if (!bin) return;
      $("admin-bin-form").hidden = false; $("bin-edit-id").value = bin.id;
      $("bin-id").value = bin.bin_code || ""; $("bin-id").disabled = true;
      $("bin-name").value = bin.name || ""; $("bin-area").value = bin.area || "";
      $("bin-lat").value = bin.latitude ?? ""; $("bin-lng").value = bin.longitude ?? "";
      const option = [...$("bin-status").options].find(o => lower(o.value) === lower(bin.status || "available"));
      $("bin-status").value = option ? option.value : "Available"; $("bin-save").textContent = "Update dustbin";
      $("admin-bin-form").scrollIntoView({behavior:"smooth",block:"center"});
    }
    if (remove) {
      const bin = state.bins.find(b=>String(b.id)===remove.dataset.deleteBin);
      if (!await confirmAction(`Delete dustbin ${bin?.bin_code || ""}?`, "This cannot be undone. Deletion may be blocked if cleaning records use this dustbin")) return;
      remove.disabled = true;
      try { await del("/api/admin/manage",{id:remove.dataset.deleteBin}); toast("Dustbin deleted"); await loadAll(); }
      catch (error) { toast(error.message, "bad"); remove.disabled = false; }
    }
  });
  $("admin-bin-search")?.addEventListener("input",renderBins);

  function resetRecordForm() {
    $("admin-record-form").hidden = true; $("admin-record-form").reset();
    $("record-cleaned-at").value = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    $("record-form-message").textContent = "";
  }
  $("admin-add-record")?.addEventListener("click", () => {
    resetRecordForm(); $("admin-record-form").hidden = false;
    $("admin-record-form").scrollIntoView({behavior:"smooth",block:"center"});
  });
  $("record-cancel")?.addEventListener("click",resetRecordForm);
  $("record-bin-id")?.addEventListener("change",() => {
    const bin = state.bins.find(b=>String(b.id)===$("record-bin-id").value);
    if (bin) $("record-area").value = bin.area || "";
  });
  $("admin-record-form")?.addEventListener("submit",async event=>{
    event.preventDefault(); const button=$("record-save");button.disabled=true;
    try {
      await post("/api/admin/manage",{type:"record",bin_id:$("record-bin-id").value,area:$("record-area").value.trim(),cleaned_at:new Date($("record-cleaned-at").value).toISOString(),activity:$("record-activity").value.trim(),status:$("record-status").value,notes:$("record-notes").value.trim()});
      resetRecordForm(); toast("Cleaning record saved"); await loadAll();
    } catch(error) { $("record-form-message").textContent=error.message; }
    finally { button.disabled=false; }
  });

  $("admin-user-search")?.addEventListener("input",renderUsers);
  $("admin-record-search")?.addEventListener("input",renderRecords);
  $("admin-export-records")?.addEventListener("click",exportRecords);
  $("admin-refresh-reports")?.addEventListener("click",async event=>{
    const button=event.currentTarget; button.disabled=true;
    if (await loadReports()) toast("Reports refreshed");
    button.disabled=false;
  });
  const reportButton = id => $("admin-reports-table").querySelector(`[data-save-report="${CSS.escape(id)}"]`);
  $("admin-reports-table")?.addEventListener("change",event=>{
    const select=event.target.closest("[data-report-status]"); if(!select)return;
    select.dataset.tone=tone(select.value);
    const button=reportButton(select.dataset.reportStatus); button.disabled=false; button.textContent="Save";
  });
  $("admin-reports-table")?.addEventListener("click",async event=>{
    const button=event.target.closest("[data-save-report]"); if(!button)return;
    const id=button.dataset.saveReport;
    const status=$("admin-reports-table").querySelector(`[data-report-status="${CSS.escape(id)}"]`)?.value;
    button.disabled=true;
    try {
      await patch("/api/admin/reports",{id,status}); button.textContent="Saved";
      const report=reports.find(r=>String(r.id)===id); if(report)report.status=status;
      updateReportBadge(); toast("Report status updated");
    }
    catch(error) { toast(error.message,"bad"); button.disabled=false; }
  });

  // Profile popover and account actions
  const profileToggle = $("admin-profile-toggle");
  const profilePopover = $("admin-profile-popover");
  const closeProfile = () => {
    if (!profilePopover || !profileToggle) return;
    profilePopover.hidden = true;
    profileToggle.setAttribute("aria-expanded", "false");
  };
  profileToggle?.addEventListener("click", event => {
    event.stopPropagation();
    const open = profilePopover.hidden;
    profilePopover.hidden = !open;
    profileToggle.setAttribute("aria-expanded", String(open));
    $("admin-profile-email").textContent = email || "Administrator account";
    $("admin-profile-name").textContent = email ? email.split("@")[0] : "Administrator";
  });
  document.addEventListener("click", event => {
    if (profilePopover && !profilePopover.hidden && !event.target.closest(".admin-profile-menu-wrap")) closeProfile();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeProfile(); });
  $("admin-profile-settings")?.addEventListener("click", () => {
    closeProfile();
    location.hash = "#settings";
    $("settings")?.scrollIntoView({behavior:"smooth",block:"start"});
  });
  const signOut = async () => {
    closeProfile();
    let ended = false;
    try { ended = (await fetch("/api/admin/logout",{method:"POST",credentials:"include"})).ok; } catch (_) {}
    // Never claim a sign out that the server did not confirm
    if (ended) showLogin("You have signed out");
    else toast("Sign out failed, check your connection and try again", "bad");
  };
  ["admin-logout","admin-logout-top","admin-profile-logout"].forEach(id => $(id)?.addEventListener("click", signOut));

  // Quick actions
  $("admin-quick-bin")?.addEventListener("click", () => $("admin-add-bin").click());
  $("admin-quick-record")?.addEventListener("click", () => $("admin-add-record").click());
  $("admin-quick-refresh")?.addEventListener("click", async event => {
    const button = event.currentTarget; button.disabled = true;
    const ok = await loadAll();
    toast(ok ? "Dashboard data refreshed" : "Some data could not be refreshed", ok ? "good" : "bad");
    button.disabled = false;
  });

  // Sidebar and tab bar highlight the section on screen
  const navLinks = [...document.querySelectorAll('.admin-side a[href^="#"], .admin-tabbar a')];
  const sections = ["overview","manage-bins","manage-records","users","reports","settings"].map($).filter(Boolean);
  const markNav = id => navLinks.forEach(a => {
    const on = a.getAttribute("href") === `#${id}`;
    a.classList.toggle(a.closest(".admin-tabbar") ? "active" : "selected", on);
    if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
  });
  const spy = () => {
    let current = sections[0];
    sections.forEach(s => { if (s.getBoundingClientRect().top <= 140) current = s; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1];
    if (current) markNav(current.id);
  };
  window.addEventListener("scroll", spy, { passive: true });

  // Device-local dashboard preferences; these do not change account permissions or server data.
  const prefCompact = $("admin-setting-compact");
  const prefMotion = $("admin-setting-reduced-motion");
  const settingFeedback = $("admin-setting-feedback");
  const prefKey = "hysacam_admin_dashboard_preferences_v1";
  const applyPreferences = prefs => {
    $("admin-main-pro")?.classList.toggle("compact-dashboard", Boolean(prefs.compact));
    $("admin-main-pro")?.classList.toggle("reduce-motion", Boolean(prefs.reduceMotion));
    if (prefCompact) prefCompact.checked = Boolean(prefs.compact);
    if (prefMotion) prefMotion.checked = Boolean(prefs.reduceMotion);
  };
  let savedPrefs = {compact:false,reduceMotion:false};
  try { savedPrefs = {...savedPrefs,...JSON.parse(localStorage.getItem(prefKey) || "{}")}; } catch (_) {}
  applyPreferences(savedPrefs);
  $("admin-setting-save")?.addEventListener("click", () => {
    savedPrefs = {compact:Boolean(prefCompact?.checked),reduceMotion:Boolean(prefMotion?.checked)};
    try { localStorage.setItem(prefKey,JSON.stringify(savedPrefs)); applyPreferences(savedPrefs); if(settingFeedback)settingFeedback.textContent="Preferences saved on this device"; }
    catch (_) { if(settingFeedback)settingFeedback.textContent="Could not save preferences in this browser"; }
  });
  $("admin-setting-reset")?.addEventListener("click", () => {
    savedPrefs = {compact:false,reduceMotion:false};
    try { localStorage.removeItem(prefKey); } catch (_) {}
    applyPreferences(savedPrefs);
    if(settingFeedback)settingFeedback.textContent="Dashboard preferences reset";
  });
  $("admin-setting-refresh")?.addEventListener("click", async event => {
    const button=event.currentTarget; button.disabled=true; button.textContent="Refreshing…";
    try { const ok = await loadAll(); if(settingFeedback)settingFeedback.textContent=ok ? "Dashboard data refreshed" : "Refresh failed, check your session and connection"; }
    finally { button.disabled=false; button.textContent="Refresh dashboard data"; }
  });

  openDashboard().catch(error=>console.warn("[HYSACAM admin]",error));
})();
