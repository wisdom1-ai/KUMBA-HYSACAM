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
  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "The request could not be completed.");
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
    $("admin-welcome").textContent = email;
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

  function renderStats() {
    const today = new Date().toISOString().slice(0,10);
    const cleanedToday = state.records.filter(r => r.verified && String(r.cleaned_at || "").slice(0,10) === today && String(r.status || "").toLowerCase().includes("clean")).length;
    const pending = state.bins.filter(b => /pending|full|maintenance|inactive/i.test(b.status || "")).length;
    $("admin-total-bins").textContent = state.bins.length.toLocaleString();
    $("admin-cleaned-today").textContent = cleanedToday.toLocaleString();
    $("admin-pending").textContent = pending.toLocaleString();
    const cleaned = state.bins.filter(b => /clean/i.test(b.status || "")).length;
    const pct = state.bins.length ? Math.round(cleaned / state.bins.length * 100) : 0;
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
    $("admin-cleaning-chart").innerHTML = `<div class="admin-line-chart"><svg viewBox="0 0 500 220" role="img" aria-label="Monthly verified cleaning activity"><line x1="42" y1="28" x2="462" y2="28" class="chart-grid"/><line x1="42" y1="104" x2="462" y2="104" class="chart-grid"/><line x1="42" y1="180" x2="462" y2="180" class="chart-grid"/><text x="8" y="32" class="chart-axis">${max}</text><text x="8" y="184" class="chart-axis">0</text><path d="${area}" fill="#16a66a" opacity=".12"/><path d="${path}" class="chart-line"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="6" class="chart-point"><title>${p.count} activities in ${p.label}</title></circle><text x="${p.x}" y="207" text-anchor="middle" class="chart-month">${p.label}</text>`).join("")}</svg></div>`;
  }

  function renderBins() {
    const q = ($("admin-bin-search").value || "").toLowerCase();
    const rows = state.bins.filter(b => [b.id,b.name,b.area,b.status].join(" ").toLowerCase().includes(q));
    $("admin-bin-count").textContent = `${state.bins.length} registered dustbin(s)`;
    $("admin-bins-table").innerHTML = rows.length ? rows.map(b => `<tr>
      <td><b>${esc(b.id)}</b></td><td>${esc(b.name)}</td><td>${esc(b.area)}</td><td><span class="status">${esc(b.status || "Available")}</span></td>
      <td><div class="admin-row-actions"><button type="button" class="admin-action-link" data-edit-bin="${esc(b.id)}">Edit</button><button type="button" class="admin-action-link danger" data-delete-bin="${esc(b.id)}">Delete</button></div></td></tr>`).join("") : `<tr><td colspan="5">No matching dustbins found</td></tr>`;
    $("record-bin-id").innerHTML = `<option value="">Select a dustbin</option>${state.bins.map(b=>`<option value="${esc(b.id)}">${esc(b.id)} — ${esc(b.area)}</option>`).join("")}`;
  }

  function renderRecords() {
    $("admin-records-table").innerHTML = state.records.length ? state.records.map(r=>`<tr>
      <td><b>${esc(r.bin_id)}</b></td><td>${esc(r.area)}</td><td>${esc(localDate(r.cleaned_at))}</td><td>${esc(r.activity || "Cleaning")}</td><td><span class="status">${esc(r.status || "Recorded")}</span></td><td>${r.verified ? "Verified" : "Pending verification"}</td></tr>`).join("") : `<tr><td colspan="6">No cleaning records have been registered</td></tr>`;
  }

  function renderUsers() {
    const q = ($("admin-user-search").value || "").toLowerCase();
    const rows = state.users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q));
    $("admin-user-count").textContent = `${state.users.length} account(s) returned`;
    $("admin-users-table").innerHTML = rows.length ? rows.map(u=>`<tr><td>${esc(u.name || "—")}</td><td>${esc(u.email)}</td><td><span class="status">${esc(u.role)}</span></td><td>${u.email_confirmed ? "Verified" : "Not verified"}</td><td>${esc(localDate(u.created_at))}</td></tr>`).join("") : `<tr><td colspan="5">No matching users found</td></tr>`;
  }

  async function loadReports() {
    try {
      const data = await request("/api/admin/reports");
      const reports = data.reports || [];
      $("admin-reports-table").innerHTML = reports.length ? reports.map(r=>`<tr>
        <td><b>${esc(r.reference_code)}</b></td><td>${esc(r.issue_type)}</td><td>${esc(r.area)}</td><td>${esc(r.reporter_name || r.reporter_email || "Resident")}</td>
        <td><select class="admin-report-status" data-report-status="${esc(r.id)}">${["submitted","under_review","assigned","in_progress","resolved","rejected"].map(v=>`<option value="${v}" ${r.status===v?"selected":""}>${v.replaceAll("_"," ")}</option>`).join("")}</select></td>
        <td><button class="admin-action-link" type="button" data-save-report="${esc(r.id)}">Save</button></td></tr>`).join("") : `<tr><td colspan="6">No resident reports yet</td></tr>`;
    } catch (error) { $("admin-reports-table").innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`; }
  }

  async function loadAudit() {
    try {
      const data = await request("/api/admin/audit");
      $("admin-audit-table").innerHTML = (data.events || []).length ? data.events.map(x=>`<tr><td>${esc(localDate(x.created_at))}</td><td>${esc(x.email)}</td><td>${esc(x.event)}</td><td>${esc(x.outcome)}</td></tr>`).join("") : `<tr><td colspan="4">No audit events available</td></tr>`;
    } catch (error) { $("admin-audit-table").innerHTML = `<tr><td colspan="4">${esc(error.message)}</td></tr>`; }
  }

  async function loadAll() {
    try {
      const data = await request("/api/admin/manage");
      state = { bins:data.bins || [], records:data.records || [], users:data.users || [] };
      renderStats(); renderBins(); renderRecords(); renderUsers();
      await Promise.all([loadReports(),loadAudit()]);
    } catch (error) {
      $("admin-bins-table").innerHTML = `<tr><td colspan="5">${esc(error.message)}</td></tr>`;
      $("admin-records-table").innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`;
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
    const payload = { id:$("bin-id").value.trim(), name:$("bin-name").value.trim(), area:$("bin-area").value.trim(), latitude:$("bin-lat").value, longitude:$("bin-lng").value, status:$("bin-status").value };
    const button = $("bin-save"); button.disabled = true;
    try {
      await (editing ? patch("/api/admin/manage",payload) : post("/api/admin/manage",{type:"bin",...payload}));
      resetBinForm(); await loadAll();
    } catch (error) { $("bin-form-message").textContent = error.message; }
    finally { button.disabled = false; }
  });

  $("admin-bins-table")?.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-bin]");
    const remove = event.target.closest("[data-delete-bin]");
    if (edit) {
      const bin = state.bins.find(b=>String(b.id)===edit.dataset.editBin); if (!bin) return;
      $("admin-bin-form").hidden = false; $("bin-edit-id").value = bin.id;
      $("bin-id").value = bin.id; $("bin-id").disabled = true;
      $("bin-name").value = bin.name || ""; $("bin-area").value = bin.area || "";
      $("bin-lat").value = bin.latitude ?? ""; $("bin-lng").value = bin.longitude ?? "";
      $("bin-status").value = bin.status || "Available"; $("bin-save").textContent = "Update dustbin";
      $("admin-bin-form").scrollIntoView({behavior:"smooth",block:"center"});
    }
    if (remove && confirm(`Delete dustbin ${remove.dataset.deleteBin}? This may be blocked if cleaning records reference it.`)) {
      try { await del("/api/admin/manage",{id:remove.dataset.deleteBin}); await loadAll(); }
      catch (error) { alert(error.message); }
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
      resetRecordForm(); await loadAll();
    } catch(error) { $("record-form-message").textContent=error.message; }
    finally { button.disabled=false; }
  });

  $("admin-users-table")?.addEventListener("input",()=>{});
  $("admin-user-search")?.addEventListener("input",renderUsers);
  $("admin-refresh-reports")?.addEventListener("click",loadReports);
  $("admin-reports-table")?.addEventListener("click",async event=>{
    const button=event.target.closest("[data-save-report]"); if(!button)return;
    const id=button.dataset.saveReport;
    const status=$(`admin-reports-table`).querySelector(`[data-report-status="${CSS.escape(id)}"]`)?.value;
    button.disabled=true;
    try { await patch("/api/admin/reports",{id,status}); button.textContent="Saved"; }
    catch(error) { alert(error.message); button.disabled=false; }
  });

  $("admin-logout")?.addEventListener("click",async()=>{
    try { await fetch("/api/admin/logout",{method:"POST",credentials:"include"}); }
    finally {
      portal.classList.remove("authorized"); loginPage.style.display="grid";
      form.reset(); $("admin-code-stage").hidden=true; $("admin-password-stage").hidden=false;
      $("admin-form-title").textContent="Administrator sign in"; say("You have signed out.");
    }
  });

  openDashboard().catch(error=>console.warn("[HYSACAM admin]",error));
})();
