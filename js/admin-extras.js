/* HYSACAM admin portal: professional extras. Load AFTER admin-dashboard.js.
   Adds: quick-actions palette (Ctrl/Cmd+K) and shortcuts, 30-minute idle sign-out, offline banner,
   resend-code with cooldown, Caps Lock warning, loading skeletons, animated KPI numbers,
   unread count in the tab title, click-to-copy report references, "use my location" for dustbins. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const portal = $("admin-portal");
  if (!portal) return;
  const isAuth = () => portal.classList.contains("authorized");
  const still = () => portal.classList.contains("still") || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const say = text => { const m = $("auth-message"); if (m) m.textContent = text || ""; };

  function toast(text, tone) {
    let box = $("admin-toast");
    if (!box) { box = document.createElement("div"); box.id = "admin-toast"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    box.textContent = text; box.dataset.tone = tone || "good"; box.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => box.classList.remove("show"), 3500);
  }

  /* ---------- offline banner ---------- */
  const bar = document.createElement("div");
  bar.className = "hx-offline"; bar.setAttribute("role", "status"); bar.hidden = true;
  bar.textContent = "You are offline. Changes cannot be saved until the connection returns";
  document.body.appendChild(bar);
  const net = () => { bar.hidden = navigator.onLine; };
  addEventListener("online", net); addEventListener("offline", net); net();

  /* ---------- idle sign-out (30 minutes) ---------- */
  const IDLE = 30 * 60 * 1000, IDLE_KEY = "hysacam_admin_idle_msg";
  let idleTimer = null;
  function idleOut() {
    if (!isAuth()) return;
    fetch("/api/admin/logout", { method: "POST", credentials: "include" })
      .then(r => { if (!r.ok) return bump(); try { sessionStorage.setItem(IDLE_KEY, "You were signed out after 30 minutes of inactivity"); } catch (e) {} location.reload(); })
      .catch(bump);
  }
  function bump() { clearTimeout(idleTimer); if (isAuth()) idleTimer = setTimeout(idleOut, IDLE); }
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach(e => addEventListener(e, bump, { passive: true }));
  try { const m = sessionStorage.getItem(IDLE_KEY); if (m) { sessionStorage.removeItem(IDLE_KEY); say(m); } } catch (e) {}

  /* ---------- loading skeletons while the dashboard loads ---------- */
  function skeleton() {
    portal.querySelectorAll("tbody").forEach(t => {
      if (!t.children.length) t.innerHTML = Array(4).fill('<tr class="hx-skrow"><td colspan="9"><i></i></td></tr>').join("");
    });
  }
  new MutationObserver(() => { if (isAuth()) { skeleton(); bump(); } else clearTimeout(idleTimer); })
    .observe(portal, { attributes: true, attributeFilter: ["class"] });
  if (isAuth()) { skeleton(); bump(); }

  /* ---------- animated KPI numbers ---------- */
  ["admin-total-bins", "admin-cleaned-today", "admin-pending", "admin-open-reports"].forEach(id => {
    const el = $(id); if (!el) return;
    let busy = false, shown = "";
    new MutationObserver(() => {
      if (busy) return;
      const txt = el.textContent;
      if (txt === shown) return;
      const n = Number(txt.replace(/,/g, ""));
      if (!Number.isFinite(n) || still() || n === 0) { shown = txt; return; }
      busy = true;
      const t0 = performance.now(), dur = 650;
      const frame = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(n * e).toLocaleString();
        if (p < 1) requestAnimationFrame(frame); else { shown = el.textContent; busy = false; }
      };
      requestAnimationFrame(frame);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });

  /* ---------- unread count in the tab title ---------- */
  function titleCount() {
    const badge = [...portal.querySelectorAll('[data-badge="reports"]')].find(b => !b.hidden);
    const n = badge ? parseInt(badge.textContent, 10) || 0 : 0;
    const base = document.title.replace(/^\(\d+\+?\)\s/, "");
    document.title = n ? `(${n}) ${base}` : base;
  }
  portal.querySelectorAll("[data-badge]").forEach(b => new MutationObserver(titleCount).observe(b, { attributes: true, childList: true, characterData: true, subtree: true }));
  addEventListener("hashchange", () => setTimeout(titleCount, 0));

  /* ---------- sign-in extras ---------- */
  const pw = $("admin-password");
  if (pw && pw.closest(".auth-password-wrap")) {
    const note = document.createElement("small");
    note.className = "hx-caps"; note.hidden = true; note.textContent = "Caps Lock is on";
    pw.closest(".auth-password-wrap").after(note);
    const check = e => { note.hidden = !(e.getModifierState && e.getModifierState("CapsLock")); };
    pw.addEventListener("keydown", check); pw.addEventListener("keyup", check); pw.addEventListener("blur", () => { note.hidden = true; });
  }
  const stage = $("admin-code-stage"), back = $("admin-back");
  if (stage && back) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "admin-text-button"; btn.id = "admin-resend";
    back.before(btn);
    let left = 0, timer = null;
    const paint = () => { btn.disabled = left > 0; btn.textContent = left > 0 ? `Resend code in ${left}s` : "Resend code"; };
    const start = () => { clearInterval(timer); left = 45; paint(); timer = setInterval(() => { left--; paint(); if (left <= 0) clearInterval(timer); }, 1000); };
    new MutationObserver(() => { if (!stage.hidden) start(); else clearInterval(timer); }).observe(stage, { attributes: true, attributeFilter: ["hidden"] });
    btn.addEventListener("click", async () => {
      if (left > 0) return;
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        const r = await fetch("/api/admin/login", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: $("admin-email").value.trim().toLowerCase(), password: $("admin-password").value }) });
        const d = await r.json().catch(() => ({}));
        say(r.ok ? "A new code has been sent to your email" : (d.message || "Could not send a new code"));
        if (r.ok) start(); else paint();
      } catch (e) { say("Could not send a new code. Check your connection"); paint(); }
    });
  }

  /* ---------- dustbin form: use my location + coordinate check ---------- */
  const lat = $("bin-lat"), lng = $("bin-lng"), binForm = $("admin-bin-form");
  if (lat && lng && lat.closest(".hx-two")) {
    if (navigator.geolocation) {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "hx-btn hx-locate";
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Use my current location';
      lat.closest(".hx-two").after(btn);
      btn.addEventListener("click", () => {
        btn.disabled = true; $("bin-form-message").textContent = "Finding your location…";
        navigator.geolocation.getCurrentPosition(
          p => { lat.value = p.coords.latitude.toFixed(6); lng.value = p.coords.longitude.toFixed(6); $("bin-form-message").textContent = ""; btn.disabled = false; },
          () => { $("bin-form-message").textContent = "Could not get your location. Allow location access and try again"; btn.disabled = false; },
          { enableHighAccuracy: true, timeout: 12000 });
      });
    }
    binForm?.addEventListener("submit", e => {
      if (Boolean(lat.value.trim()) !== Boolean(lng.value.trim())) {
        e.preventDefault(); e.stopImmediatePropagation();
        $("bin-form-message").textContent = "Enter both latitude and longitude, or leave both empty";
      }
    }, true);
  }

  /* ---------- click a report reference to copy it ---------- */
  $("admin-reports-table")?.addEventListener("click", e => {
    const ref = e.target.closest("td:first-child b");
    if (!ref || !navigator.clipboard) return;
    navigator.clipboard.writeText(ref.textContent.trim()).then(() => toast("Reference copied")).catch(() => {});
  });

  /* ---------- quick actions palette (Ctrl/Cmd+K) ---------- */
  const go = id => { location.hash = "#" + id; };
  const later = fn => setTimeout(fn, 60);
  const COMMANDS = [
    ["Go to Dashboard", "G then D", () => go("overview")],
    ["Go to Dustbins", "G then B", () => go("manage-bins")],
    ["Go to Cleaning records", "G then C", () => go("manage-records")],
    ["Go to Resident reports", "G then R", () => go("reports")],
    ["Go to Users", "G then U", () => go("users")],
    ["Go to Settings", "G then S", () => go("settings")],
    ["Add dustbin", "", () => { go("manage-bins"); later(() => $("admin-add-bin")?.click()); }],
    ["Add cleaning record", "", () => { go("manage-records"); later(() => $("admin-add-record")?.click()); }],
    ["Refresh data", "", () => $("admin-quick-refresh")?.click()],
    ["Sign out", "", () => $("admin-logout")?.click()]
  ];
  const bg = document.createElement("div");
  bg.className = "hx-palette-bg"; bg.hidden = true;
  bg.innerHTML = '<div class="hx-palette" role="dialog" aria-modal="true" aria-label="Quick actions"><input type="text" id="hx-pal-input" placeholder="Type a page or action" autocomplete="off" aria-label="Search actions"><ul id="hx-pal-list" role="listbox"></ul></div>';
  document.body.appendChild(bg);
  const input = bg.querySelector("input"), list = bg.querySelector("ul");
  let shown = [], index = 0;
  function paintList() {
    const q = input.value.trim().toLowerCase();
    shown = COMMANDS.filter(c => c[0].toLowerCase().includes(q));
    index = Math.min(index, Math.max(0, shown.length - 1));
    list.innerHTML = shown.length ? shown.map((c, i) => `<li role="option" data-i="${i}" aria-selected="${i === index}"><span>${c[0]}</span><small>${c[1]}</small></li>`).join("") : '<li class="hx-pal-empty">No matching action</li>';
  }
  function openPalette() { if (!isAuth()) return; bg.hidden = false; input.value = ""; index = 0; paintList(); input.focus(); }
  function closePalette() { bg.hidden = true; }
  function runCommand(i) { const c = shown[i]; if (!c) return; closePalette(); c[2](); }
  input.addEventListener("input", () => { index = 0; paintList(); });
  list.addEventListener("click", e => { const li = e.target.closest("[data-i]"); if (li) runCommand(Number(li.dataset.i)); });
  bg.addEventListener("click", e => { if (e.target === bg) closePalette(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); index = Math.min(shown.length - 1, index + 1); paintList(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); index = Math.max(0, index - 1); paintList(); }
    else if (e.key === "Enter") { e.preventDefault(); runCommand(index); }
    else if (e.key === "Escape") closePalette();
  });

  const refreshBtn = $("admin-quick-refresh");
  if (refreshBtn) {
    const quick = document.createElement("button");
    quick.type = "button"; quick.className = "hx-btn hx-quick"; quick.setAttribute("aria-label", "Quick actions");
    quick.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="hx-quicktxt">Quick actions</span>';
    refreshBtn.before(quick);
    quick.addEventListener("click", openPalette);
  }

  let gPending = false, gTimer = null;
  const GO = { d: "overview", b: "manage-bins", c: "manage-records", r: "reports", u: "users", s: "settings" };
  addEventListener("keydown", e => {
    if (!isAuth()) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); bg.hidden ? openPalette() : closePalette(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || !bg.hidden) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || portal.querySelector("dialog[open]")) return;
    if (e.key === "/") { const f = portal.querySelector('.admin-page:not([hidden]) input[type="search"]'); if (f) { e.preventDefault(); f.focus(); } return; }
    if (gPending) { gPending = false; clearTimeout(gTimer); const id = GO[e.key.toLowerCase()]; if (id) go(id); return; }
    if (e.key.toLowerCase() === "g") { gPending = true; gTimer = setTimeout(() => { gPending = false; }, 1200); }
  });
})();
