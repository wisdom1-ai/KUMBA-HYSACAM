"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient;
  const $ = (id) => document.getElementById(id);
  const grid = $("binGrid");
  const search = $("directorySearch");
  const table = $("cleaning-table");
  if (!client || !grid) return;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
  const validCoords = b => b.latitude != null && b.longitude != null &&
    Number.isFinite(Number(b.latitude)) && Number.isFinite(Number(b.longitude)) &&
    Number(b.latitude) >= -90 && Number(b.latitude) <= 90 &&
    Number(b.longitude) >= -180 && Number(b.longitude) <= 180;

  let bins = [];
  let records = [];
  let page = 1;
  const pageSize = 6;

  function statusClass(value) {
    const s = String(value || "").toLowerCase();
    if (s.includes("clean")) return "cleaned";
    if (s.includes("pending") || s.includes("collect")) return "pending";
    if (s.includes("full") || s.includes("overflow")) return "full";
    if (s.includes("maint") || s.includes("broken") || s.includes("damage")) return "maintenance";
    return "available";
  }

  function selectBin(bin, { fromMap = false } = {}) {
    if (!bin) return;
    $("detail-name").textContent = bin.name || `Dustbin ${bin.bin_code || bin.id}`;
    $("detail-area").textContent = `${bin.area || "Area not specified"}, Kumba`;
    $("detail-area2").textContent = bin.area || "—";
    const details = $("dustbin-details");
    if (details) {
      const status = $("detail-name")?.closest(".detail-card")?.querySelector(".detail-top .status");
      if (status) {
        status.textContent = bin.status || "Not specified";
        status.className = `status ${statusClass(bin.status)}`;
      }
      const dl = details.querySelector("dl");
      if (dl) {
        dl.innerHTML = `
          <dt>Dustbin ID</dt><dd>${esc(bin.bin_code || bin.id)}</dd>
          <dt>Area</dt><dd>${esc(bin.area || "—")}</dd>
          <dt>Type</dt><dd>${esc(bin.type || "Public collection point")}</dd>
          <dt>Coordinates</dt><dd>${validCoords(bin) ? `${Number(bin.latitude).toFixed(5)}, ${Number(bin.longitude).toFixed(5)}` : "Not available"}</dd>
          <dt>Last cleaned</dt><dd>${esc((records.find(r => String(r.bin_id) === String(bin.id))?.cleaned_at) ? new Date(records.find(r => String(r.bin_id) === String(bin.id)).cleaned_at).toLocaleString() : "No verified cleaning record")}</dd>
        `;
      }
    }
    if (!fromMap) {
      // The details page is a routed section and may currently be hidden.
      // Navigate first so the selected record is actually visible on mobile.
      if (typeof window.hysacamNavigate === "function") {
        window.hysacamNavigate("details");
      } else {
        $("details")?.classList.remove("route-hidden");
        if (location.hash !== "#details") location.hash = "#details";
        requestAnimationFrame(() => $("details")?.scrollIntoView({behavior:"smooth", block:"start"}));
      }
      document.dispatchEvent(new CustomEvent("hysacam:show-bin", {
        detail: { latitude:Number(bin.latitude), longitude:Number(bin.longitude), binId:String(bin.id) }
      }));
    }
  }

  function renderDirectory() {
    const q = (search?.value || "").trim().toLowerCase();
    const filtered = bins.filter(b => [b.bin_code,b.name,b.area,b.status].join(" ").toLowerCase().includes(q));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages);
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
    grid.innerHTML = pageRows.length ? `
      <div class="directory-results-heading"><span>Collection points</span><span class="directory-results-count">${filtered.length} found</span></div>
      <div class="directory-list">${pageRows.map(b => `
        <article class="directory-card">
          <div class="directory-card-icon" aria-hidden="true">⌖</div>
          <div class="directory-card-content">
            <div class="directory-card-title-row"><h3>${esc(b.name || "Collection point")}</h3><span class="directory-id">${esc(b.bin_code || b.id)}</span></div>
            <p class="directory-area">${esc(b.area || "Area not specified")}, Kumba</p>
            <p class="directory-coordinates">${validCoords(b) ? `${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)}` : "Coordinates not registered"}</p>
            <div class="directory-card-bottom"><span class="directory-status ${statusClass(b.status)}"><span class="status-dot"></span>${esc(b.status || "Available")}</span><button type="button" class="directory-view-button" data-bin-id="${esc(b.id)}">View details →</button></div>
          </div>
        </article>`).join("")}</div>` : `<div class="directory-empty"><h3>${bins.length ? "No matching locations" : "No dustbins registered yet"}</h3><p>${bins.length ? "Try another dustbin ID or location" : "Registered collection points will appear here when available"}</p></div>`;
    $("page-number") && ($("page-number").textContent = `${page} / ${pages}`);
    $("prev-page") && ($("prev-page").disabled = page <= 1);
    $("next-page") && ($("next-page").disabled = page >= pages);
  }

  function renderRecords() {
    if (!table) return;
    const rows = records.slice(0, 100);
    table.innerHTML = rows.length ? rows.map((r,i) => {
      const bin = bins.find(b => String(b.id) === String(r.bin_id));
      const location = r.area || bin?.area || "Location not specified";
      const when = r.cleaned_at ? new Date(r.cleaned_at).toLocaleString() : "—";
      return `<tr><td>${i+1}</td><td><b>${esc(bins.find(b => String(b.id) === String(r.bin_id))?.bin_code || r.bin_id || "—")}</b></td><td>${esc(location)}</td><td>${esc(when)}</td><td><span class="status ${statusClass(r.status)}">${esc(r.status || "Recorded")}</span></td><td><button type="button" class="directory-view-button" data-record-bin="${esc(r.bin_id || "")}">View</button></td></tr>`;
    }).join("") : `<tr><td colspan="6"><div class="empty-state compact"><h3>No verified cleaning records yet</h3><p>Verified staff cleaning activities will appear here</p></div></td></tr>`;
  }

  grid.addEventListener("click", e => {
    const btn = e.target.closest("[data-bin-id]");
    if (btn) selectBin(bins.find(b => String(b.id) === btn.dataset.binId));
  });
  document.addEventListener("hysacam:bin-selected", event => {
    if (event.detail?.bin) {
      const bin = bins.find(b => String(b.id) === String(event.detail.bin.id)) || event.detail.bin;
      selectBin(bin, { fromMap: true });
    }
  });
  table?.addEventListener("click", e => {
    const btn = e.target.closest("[data-record-bin]");
    if (btn) selectBin(bins.find(b => String(b.id) === btn.dataset.recordBin));
  });
  search?.addEventListener("input", () => { page = 1; renderDirectory(); });
  $("prev-page")?.addEventListener("click", () => { page = Math.max(1,page-1); renderDirectory(); });
  $("next-page")?.addEventListener("click", () => { page++; renderDirectory(); });
  $("directory-search-btn")?.addEventListener("click", renderDirectory);
  $("location-search")?.addEventListener("submit", e => {
    e.preventDefault();
    const q = $("location-input")?.value.trim() || "";
    if (search) search.value = q;
    page = 1; renderDirectory();
    $("directory")?.scrollIntoView({behavior:"smooth"});
    $("search-message").textContent = q ? `${bins.filter(b => [b.bin_code,b.name,b.area].join(" ").toLowerCase().includes(q.toLowerCase())).length} matching location(s) found` : "Enter a location or dustbin ID";
  });

  try {
    const [{data: binRows,error:binError},{data: recordRows,error:recordError}] = await Promise.all([
      client.from("bins").select("id,bin_code,name,area,latitude,longitude,status").order("name",{ascending:true}).limit(1000),
      client.from("cleaning_records").select("id,bin_id,area,cleaned_at,activity,status,notes").eq("verified",true).order("cleaned_at",{ascending:false}).limit(100)
    ]);
    if (binError) throw binError;
    bins = binRows || [];
    records = recordError ? [] : (recordRows || []);
    renderDirectory();
    renderRecords();
    const binCount = $("binGrid")?.querySelector(".directory-results-count");
    if (!bins.length) $("map-message") && ($("map-message").textContent = "No registered dustbin locations are available yet");
  } catch (error) {
    console.error("[HYSACAM] Could not load public collection data", error);
    grid.innerHTML = `<div class="directory-empty directory-error"><h3>Unable to load collection points</h3><p>Please refresh and try again</p></div>`;
    if (table) table.innerHTML = `<tr><td colspan="6">Cleaning records could not be loaded</td></tr>`;
  }
});
