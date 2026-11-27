(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("admin-login-form");
  const loginPage = $("admin-login-page");
  const portal = $("admin-portal");
  const message = $("auth-message");
  let email = "";
  let state = { bins: [], records: [], users: [] };
  let reports = [], events = [];

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
  const pill = v => `<span class="hx-pill" data-tone="${tone(v)}">${esc(label(v))}</span>`;
  const row = (labels, cells) => `<tr>${cells.map((c, i) => `<td data-label="${labels[i]}">${c}</td>`).join("")}</tr>`;
  const emptyRow = (span, text) => `<tr><td colspan="${span}">${esc(text)}</td></tr>`;
  const setBadge = (name, count) => document.querySelectorAll(`[data-badge="${name}"]`).forEach(b => {
    b.textContent = count > 99 ? "99+" : count; b.hidden = !count;
  });

  function toast(text, kind = "good") {
    let box = $("admin-toast");
    if (!box) { box = document.createElement("div"); box.id = "admin-toast"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    box.hidden = false;
    box.textContent = text; box.dataset.tone = kind; box.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.remove("show"), 4000);
  }

  function confirmAction(title, text) {
    if (typeof HTMLDialogElement !== "function") return Promise.resolve(window.confirm(`${title}\n${text}`));
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.className = "hx-confirm";
      dialog.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2><p>${esc(text)}</p><div><button class="hx-btn" value="no" autofocus>Cancel</button><button value="yes" class="hx-btn hx-destroy">Delete</button></div></form>`;
      dialog.addEventListener("close", () => { resolve(dialog.returnValue === "yes"); dialog.remove(); });
      portal.appendChild(dialog); dialog.showModal();
    });
  }

  function showLogin(text) {
    portal.querySelectorAll("dialog[open]").forEach(d => d.close());
    portal.classList.remove("authorized"); loginPage.style.display="grid";
    form.reset(); $("admin-code-stage").hidden=true; $("admin-password-stage").hidden=false;
    $("admin-form-title").textContent="Administrator sign in"; say(text);
    state = { bins: [], records: [], users: [] }; reports = []; events = [];
    portal.querySelectorAll("tbody").forEach(t => { t.innerHTML = ""; });
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
    $("admin-avatar").textContent = initial;
    loginPage.style.display = "none";
    portal.classList.add("authorized");
    await loadAll();
    return true;
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    say("");
    email = $("admin-email").value.trim().toLowerCase();
    const button = $("admin-submit");
    button.disabled = true; button.textContent = "Checking account…";
    try {
      await post("/api/admin/login", { email, password: $("admin-password").value });
      $("admin-password-stage").hidden = true;
      $("admin-code-stage").hidden = false;
      $("admin-code").required = true;
      $("admin-form-title").textContent = "Verify Your Email";
      $("admin-form-copy").textContent = "Enter the 6 digit code sent to your email";
      $("admin-code").focus();
    } catch (error) { say(error.message); }
    finally { button.disabled = false; button.textContent = "Continue securely"; }
  });

  $("admin-verify")?.addEventListener("click", async () => {
    say("");
    const code = $("admin-code").value.trim();
    if (!/^\d{6}$/.test(code)) { say("Enter the complete six-digit code."); return; }
    const button = $("admin-verify"); button.disabled = true; button.textContent = "Verifying…";
    try {
      await post("/api/admin/verify", { email, code });
      if (!await openDashboard()) throw new Error("Your administrator session could not be confirmed.");
    } catch (error) { say(error.message); }
    finally { button.disabled = false; button.textContent = "Verify Code"; }
  });

  $("admin-back")?.addEventListener("click", () => {
    $("admin-code-stage").hidden = true;
    $("admin-password-stage").hidden = false;
    $("admin-code").value = ""; $("admin-code").required = false;
    $("admin-form-title").textContent = "Administrator sign in";
    $("admin-form-copy").textContent = "Enter your authorised account credentials to continue.";
    say("");
  });

  function renderGreeting() {
    const now = new Date(), hour = now.getHours();
    $("admin-greeting").textContent = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    $("admin-today").textContent = now.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  }

  function renderStats() {
    renderGreeting();
    const today = new Date().toDateString(); // local day, not UTC
    const total = state.bins.length;
    const countStatus = s => state.bins.filter(b => lower(b.status || "available") === lower(s)).length;
    const available = countStatus("Available");
    $("admin-total-bins").textContent = total.toLocaleString();
    $("admin-cleaned-today").textContent = state.records.filter(r => r.verified && dayKey(r.cleaned_at) === today && lower(r.status).includes("clean")).length.toLocaleString();
    $("admin-pending").textContent = state.bins.filter(b => /pending|full|maintenance|inactive/i.test(b.status || "")).length.toLocaleString();
    $("admin-cleaned-percent").textContent = total ? `${Math.round(available / total * 100)}%` : "—";
    const colors = { Available:"#087747", Pending:"#d08a0c", Full:"#c93227", Maintenance:"#2e62c9", Inactive:"#8a948e" };
    const counts = Object.entries(colors).map(([name, color]) => ({ name, color, n:countStatus(name) }));
    // Ring segments are sized against the bins that have a recognised status
    const known = counts.reduce((sum, c) => sum + c.n, 0);
    let from = 0;
    const slices = counts.filter(c => c.n).map(c => { const to = from + c.n / known * 100; const part = `${c.color} ${from}% ${to}%`; from = to; return part; });
    $("admin-bin-donut").style.background = slices.length ? `conic-gradient(${slices.join(",")})` : "";
    $("admin-status-list").innerHTML = counts.map(c => `<li><i style="--c:${c.color}"></i><span>${c.name}</span><b>${c.n}</b></li>`).join("");
    const months = Array.from({length:5}, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 4 + i);
      return { label:d.toLocaleString("en",{month:"short"}), count:state.records.filter(r => {
        const t = new Date(r.cleaned_at); return r.verified && t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
      }).length };
    });
    const max = Math.max(1, ...months.map(m => m.count));
    $("admin-cleaning-chart").innerHTML = months.map(m => `<div class="hx-col" title="${m.count} verified in ${m.label}"><div class="hx-plot"><b>${m.count}</b><i style="height:${m.count / max * 100}%"></i></div><small>${m.label}</small></div>`).join("");
    const latest = [...state.records].sort((a, b) => new Date(b.cleaned_at) - new Date(a.cleaned_at)).slice(0, 4);
    $("admin-recent-records").innerHTML = latest.length ? latest.map(r => `<li><div><b>${esc(binCode(r))} · ${esc(r.area)}</b><small>${esc(localDate(r.cleaned_at))}</small></div>${pill(r.status || "Recorded")}</li>`).join("") : `<li class="hx-empty">No cleaning records yet</li>`;
  }

  // Ten rows per page
  const PAGE_SIZE = 10;
  const pageNo = { bins:1, records:1, users:1, reports:1, audit:1 };
  function paginate(key, rows) {
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    pageNo[key] = Math.min(Math.max(1, pageNo[key]), pages);
    const start = (pageNo[key] - 1) * PAGE_SIZE;
    portal.querySelector(`[data-pager="${key}"]`).innerHTML = rows.length ? `<span>Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length}</span>${pages > 1 ? `<div><button type="button" class="hx-btn" data-step="-1" ${pageNo[key] === 1 ? "disabled" : ""}>Previous</button><button type="button" class="hx-btn" data-step="1" ${pageNo[key] === pages ? "disabled" : ""}>Next</button></div>` : ""}` : "";
    return rows.slice(start, start + PAGE_SIZE);
  }

  function renderBinOptions() {
    const select = $("record-bin-id"), chosen = select.value;
    select.innerHTML = `<option value="">Select a dustbin</option>${state.bins.map(b=>`<option value="${esc(b.id)}">${esc(b.bin_code)} — ${esc(b.area)}</option>`).join("")}`;
    select.value = chosen;
  }

  function renderBins() {
    const q = lower($("admin-bin-search").value).trim();
    const wanted = $("admin-bin-filter").value;
    const rows = state.bins.filter(b => lower([b.bin_code,b.name,b.area,b.status].join(" ")).includes(q) && (!wanted || lower(b.status || "available") === lower(wanted)));
    const shown = paginate("bins", rows);
    $("admin-bins-table").innerHTML = rows.length ? shown.map(b => row(["ID","Name","Area","Status","Actions"], [
      `<b>${esc(b.bin_code)}</b>`, esc(b.name), esc(b.area), pill(b.status || "Available"),
      `<div class="hx-rowactions"><button type="button" class="hx-link" data-edit-bin="${esc(b.id)}">Edit</button><button type="button" class="hx-link hx-dangertext" data-delete-bin="${esc(b.id)}">Delete</button></div>`
    ])).join("") : emptyRow(5, q || wanted ? "No matching dustbins found" : "No dustbins registered yet");
  }

  const binCode = r => state.bins.find(b=>String(b.id)===String(r.bin_id))?.bin_code || r.bin_id;
  const filteredRecords = () => {
    const q = lower($("admin-record-search").value).trim();
    return state.records.filter(r => lower([binCode(r),r.area,r.activity,r.status,localDate(r.cleaned_at)].join(" ")).includes(q));
  };

  function renderRecords() {
    const rows = filteredRecords();
    const shown = paginate("records", rows);
    $("admin-records-table").innerHTML = rows.length ? shown.map(r => row(["Dustbin ID","Location","Date & time","Activity","Status","Verification"], [
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
    const shown = paginate("users", rows);
    $("admin-users-table").innerHTML = rows.length ? shown.map(u => row(["Name","Email","Role","Email verified","Joined"], [
      `<span class="hx-person"><i aria-hidden="true">${esc(String(u.name || u.email || "?").charAt(0).toUpperCase())}</i>${esc(u.name || "—")}</span>`, esc(u.email), `<span class="hx-pill" data-tone="info">${esc(label(u.role))}</span>`, u.email_confirmed ? "Verified" : "Not verified", esc(localDate(u.created_at))
    ])).join("") : emptyRow(5, "No matching users found");
  }

  const OPEN_REPORTS = ["submitted","under_review"];
  function updateReportSummary() {
    const open = reports.filter(r => OPEN_REPORTS.includes(r.status));
    setBadge("reports", open.length);
    $("admin-open-reports").textContent = open.length.toLocaleString();
    $("admin-recent-reports").innerHTML = open.length ? open.slice(0, 4).map(r => `<li><div><b>${esc(r.issue_type)}</b><small>${esc(r.reference_code)} · ${esc(r.area)}</small></div>${pill(r.status)}</li>`).join("") : `<li class="hx-empty">No reports waiting for review</li>`;
  }

  function renderReports() {
    const q = lower($("admin-report-search").value).trim(), wanted = $("admin-report-filter").value;
    const rows = reports.filter(r => lower([r.reference_code,r.issue_type,r.area,r.reporter_name,r.reporter_email].join(" ")).includes(q) && (!wanted || r.status === wanted));
    const shown = paginate("reports", rows);
    $("admin-reports-table").innerHTML = rows.length ? shown.map(r => row(["Reference","Issue","Area","Submitted by","Status","Update"], [
      `<b>${esc(r.reference_code)}</b>`, esc(r.issue_type), esc(r.area), esc(r.reporter_name || r.reporter_email || "Resident"),
      `<select aria-label="Status for report ${esc(r.reference_code)}" data-tone="${tone(r.status)}" data-report-status="${esc(r.id)}">${["submitted","under_review","assigned","in_progress","resolved","rejected"].map(v=>`<option value="${v}" ${r.status===v?"selected":""}>${label(v)}</option>`).join("")}</select>`,
      `<button class="hx-link" type="button" data-save-report="${esc(r.id)}" disabled>Save</button>`
    ])).join("") : emptyRow(6, reports.length ? "No matching reports found" : "No resident reports yet");
  }

  async function loadReports() {
    try {
      reports = (await request("/api/admin/reports")).reports || [];
      renderReports(); updateReportSummary();
      return true;
    } catch (error) {
      if (portal.classList.contains("authorized")) {
        $("admin-reports-table").innerHTML = emptyRow(6, error.message);
        $("admin-open-reports").textContent = "—";
        $("admin-recent-reports").innerHTML = `<li class="hx-empty">Reports could not be loaded</li>`;
      }
      return false;
    }
  }

  function renderAudit() {
    const shown = paginate("audit", events);
    $("admin-audit-table").innerHTML = events.length ? shown.map(x => row(["Time","Administrator","Event","Outcome"], [esc(localDate(x.created_at)), esc(x.email), esc(x.event), esc(x.outcome)])).join("") : emptyRow(4, "No audit events available");
  }

  async function loadAudit() {
    try { events = (await request("/api/admin/audit")).events || []; renderAudit(); return true; }
    catch (error) { if (portal.classList.contains("authorized")) $("admin-audit-table").innerHTML = emptyRow(4, error.message); return false; }
  }

  // Resolves to true only when every part of the dashboard loaded
  async function loadAll() {
    try {
      const data = await request("/api/admin/manage");
      state = { bins:data.bins || [], records:data.records || [], users:data.users || [] };
      renderBinOptions(); renderStats(); renderBins(); renderRecords(); renderUsers();
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

  const binDialog = $("admin-bin-dialog"), recordDialog = $("admin-record-dialog");
  function resetBinForm() {
    $("admin-bin-form").reset(); $("bin-edit-id").value = ""; $("bin-id").disabled = false;
    $("bin-dialog-title").textContent = "Add dustbin";
    $("bin-save").textContent = "Save dustbin"; $("bin-form-message").textContent = "";
  }
  $("admin-add-bin")?.addEventListener("click", () => { resetBinForm(); binDialog.showModal(); });
  portal.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
  $("admin-bin-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const editing = Boolean($("bin-edit-id").value);
    const payload = { bin_code:$("bin-id").value.trim(), id:$("bin-edit-id").value, name:$("bin-name").value.trim(), area:$("bin-area").value.trim(), latitude:$("bin-lat").value, longitude:$("bin-lng").value, status:$("bin-status").value };
    const button = $("bin-save"); button.disabled = true;
    try {
      await (editing ? patch("/api/admin/manage",payload) : post("/api/admin/manage",{type:"bin",...payload}));
      binDialog.close(); toast(editing ? "Dustbin updated" : "Dustbin added"); await loadAll();
    } catch (error) { $("bin-form-message").textContent = error.message; }
    finally { button.disabled = false; }
  });

  $("admin-bins-table")?.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-bin]");
    const remove = event.target.closest("[data-delete-bin]");
    if (edit) {
      const bin = state.bins.find(b=>String(b.id)===edit.dataset.editBin); if (!bin) return;
      resetBinForm(); $("bin-dialog-title").textContent = "Edit dustbin"; $("bin-edit-id").value = bin.id;
      $("bin-id").value = bin.bin_code || ""; $("bin-id").disabled = true;
      $("bin-name").value = bin.name || ""; $("bin-area").value = bin.area || "";
      $("bin-lat").value = bin.latitude ?? ""; $("bin-lng").value = bin.longitude ?? "";
      const option = [...$("bin-status").options].find(o => lower(o.value) === lower(bin.status || "available"));
      $("bin-status").value = option ? option.value : "Available"; $("bin-save").textContent = "Update dustbin";
      binDialog.showModal();
    }
    if (remove) {
      const bin = state.bins.find(b=>String(b.id)===remove.dataset.deleteBin);
      if (!await confirmAction(`Delete dustbin ${bin?.bin_code || ""}?`, "This cannot be undone. Deletion may be blocked if cleaning records use this dustbin")) return;
      remove.disabled = true;
      try { await del("/api/admin/manage",{id:remove.dataset.deleteBin}); toast("Dustbin deleted"); await loadAll(); }
      catch (error) { toast(error.message, "bad"); remove.disabled = false; }
    }
  });
  const renderers = { bins:renderBins, records:renderRecords, users:renderUsers, reports:renderReports, audit:renderAudit };
  [["admin-bin-search","bins"],["admin-bin-filter","bins"],["admin-record-search","records"],["admin-user-search","users"],["admin-report-search","reports"],["admin-report-filter","reports"]]
    .forEach(([id,key]) => $(id).addEventListener("input", () => { pageNo[key] = 1; renderers[key](); }));
  portal.addEventListener("click", event => {
    const step = event.target.closest("[data-step]"); if (!step) return;
    const key = step.closest("[data-pager]").dataset.pager;
    pageNo[key] += Number(step.dataset.step); renderers[key]();
  });

  function resetRecordForm() {
    $("admin-record-form").reset();
    $("record-cleaned-at").value = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    $("record-form-message").textContent = "";
  }
  $("admin-add-record")?.addEventListener("click", () => { resetRecordForm(); recordDialog.showModal(); });
  $("record-bin-id")?.addEventListener("change",() => {
    const bin = state.bins.find(b=>String(b.id)===$("record-bin-id").value);
    if (bin) $("record-area").value = bin.area || "";
  });
  $("admin-record-form")?.addEventListener("submit",async event=>{
    event.preventDefault(); const button=$("record-save");button.disabled=true;
    try {
      await post("/api/admin/manage",{type:"record",bin_id:$("record-bin-id").value,area:$("record-area").value.trim(),cleaned_at:new Date($("record-cleaned-at").value).toISOString(),activity:$("record-activity").value.trim(),status:$("record-status").value,notes:$("record-notes").value.trim()});
      recordDialog.close(); toast("Cleaning record saved"); await loadAll();
    } catch(error) { $("record-form-message").textContent=error.message; }
    finally { button.disabled=false; }
  });

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
      updateReportSummary(); renderReports(); toast("Report status updated");
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
      });
  document.addEventListener("click", event => {
    if (profilePopover && !profilePopover.hidden && !event.target.closest(".hx-profile")) closeProfile();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeProfile(); });
  $("admin-profile-settings")?.addEventListener("click", () => {
    closeProfile();
    goTo("settings");
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
  $("admin-quick-bin")?.addEventListener("click", () => { goTo("manage-bins"); $("admin-add-bin").click(); });
  $("admin-quick-record")?.addEventListener("click", () => { goTo("manage-records"); $("admin-add-record").click(); });
  $("admin-quick-refresh")?.addEventListener("click", async event => {
    const button = event.currentTarget; button.disabled = true;
    const ok = await loadAll();
    toast(ok ? "Dashboard data refreshed" : "Some data could not be refreshed", ok ? "good" : "bad");
    button.disabled = false;
  });

  // One page at a time, driven by the address so Back, Forward, refresh and bookmarks work
  const PAGES = {
    "overview":["Dashboard","Kumba waste collection at a glance"], "manage-bins":["Dustbins","Manage collection points"],
    "manage-records":["Cleaning records","Track cleaning activity"], "users":["Users","Registered accounts"],
    "reports":["Resident reports","Review and update waste issues"], "settings":["Settings","Preferences and security activity"]
  };
  const navLinks = [...portal.querySelectorAll("[data-nav]")];
  const currentPage = () => { const id = location.hash.slice(1); return Object.hasOwn(PAGES, id) ? id : "overview"; };
  function showPage() {
    const id = currentPage();
    document.querySelectorAll(".admin-page").forEach(p => { p.hidden = p.dataset.page !== id; });
    $("admin-page-title").textContent = PAGES[id][0]; $("admin-page-sub").textContent = PAGES[id][1];
    document.title = `${PAGES[id][0]} | HYSACAM Kumba Admin`;
    navLinks.forEach(a => { if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    window.scrollTo(0, 0);
  }
  function goTo(id) {
    if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
    showPage();
  }
  navLinks.forEach(a => a.addEventListener("click", event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); goTo(a.getAttribute("href").slice(1));
    $("admin-page-title").focus({ preventScroll:true });
  }));
  portal.querySelectorAll("[data-link]").forEach(a => a.addEventListener("click", event => { event.preventDefault(); goTo(a.getAttribute("href").slice(1)); }));
  window.addEventListener("popstate", showPage);
  window.addEventListener("hashchange", showPage);
  showPage();

  // Device-local dashboard preferences; these do not change account permissions or server data.
  const prefCompact = $("admin-setting-compact");
  const prefMotion = $("admin-setting-reduced-motion");
  const settingFeedback = $("admin-setting-feedback");
  const prefKey = "hysacam_admin_dashboard_preferences_v1";
  const applyPreferences = prefs => {
    portal.classList.toggle("compact", Boolean(prefs.compact));
    portal.classList.toggle("still", Boolean(prefs.reduceMotion));
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
  openDashboard().catch(error=>console.warn("[HYSACAM admin]",error));
})();
