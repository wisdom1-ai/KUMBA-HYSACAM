const db = window.HysacamDB;
if (!db) {
  console.error("HYSACAM database did not load. Check css/js/database.js.");
}
const getDustbins = (...args) => db?.getDustbins(...args) ?? [];
const addDustbin = (...args) => { if (!db) throw new Error("Database is unavailable. Reload the tracker and try again."); return db.addDustbin(...args); };
const updateDustbin = (...args) => { if (!db) throw new Error("Database is unavailable. Reload the tracker and try again."); return db.updateDustbin(...args); };
const deleteDustbin = (...args) => { if (!db) throw new Error("Database is unavailable. Reload the tracker and try again."); return db.deleteDustbin(...args); };

const $ = selector => document.querySelector(selector);
let bins = [];
let editingId = null;

function notify(message, isError = false) {
  let toast = $("#toast") || $("#toastContainer");
  if (!toast) {
    toast = document.createElement("div"); toast.id = "toast"; toast.className = "toast";
    toast.setAttribute("role", "status"); toast.setAttribute("aria-live", "polite"); document.body.appendChild(toast);
  }
  toast.textContent = message; toast.hidden = false; toast.classList.add("visible");
  toast.classList.toggle("error", isError);
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.classList.remove("visible", "error"); if (toast.id === "toast") toast.hidden = true; }, 3000);
}
function safe(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function statusLabel(status) { return ({available:"Available",full:"Full",damaged:"Damaged",unknown:"Unknown"})[String(status || "unknown").toLowerCase()] || String(status); }
function statusClass(status) { return ["available","full","damaged","unknown"].includes(String(status).toLowerCase()) ? String(status).toLowerCase() : "unknown"; }
function filteredBins() {
  const query = ($("#directorySearch")?.value || "").trim().toLowerCase();
  const sort = $("#sortBins")?.value || "name";
  return bins.filter(bin => [bin.name,bin.area,bin.address,bin.status,bin.id].join(" ").toLowerCase().includes(query)).sort((a,b) => String(a[sort] ?? a.name).localeCompare(String(b[sort] ?? b.name)));
}
function renderDirectory() {
  bins = getDustbins();
  const grid = $("#binGrid"); if (!grid) return;
  const filtered = filteredBins(); grid.replaceChildren();
  $("#directoryStatus").textContent = filtered.length ? "Collection points saved on this device." : "No matching collection points found.";
  $("#directoryCount").textContent = `${filtered.length} point${filtered.length === 1 ? "" : "s"}`;
  if (!filtered.length) {
    const empty = document.createElement("div"); empty.className = "empty-state"; empty.innerHTML = '<span>♻</span><p>No collection points match your search. Add a point or clear the search.</p>'; grid.appendChild(empty); return;
  }
  filtered.forEach(bin => {
    const card = document.createElement("article"); card.className = "bin-card";
    card.innerHTML = `<div class="bin-card-top"><span class="status-badge ${statusClass(bin.status)}">${safe(statusLabel(bin.status))}</span><small>#${safe(bin.id)}</small></div><h3>${safe(bin.name || "Unnamed collection point")}</h3><p><strong>Area:</strong> ${safe(bin.area || "Not specified")}</p><p><strong>Address:</strong> ${safe(bin.address || "Not specified")}</p><p><strong>Coordinates:</strong> ${Number(bin.latitude).toFixed(5)}, ${Number(bin.longitude).toFixed(5)}</p><p><strong>Updated:</strong> ${safe(bin.lastUpdated ? new Date(bin.lastUpdated).toLocaleString() : "Not recorded")}</p><div class="bin-card-actions"><button type="button" class="btn btn-outline" data-bin-action="map" data-bin-id="${safe(bin.id)}">View on Map</button><button type="button" class="btn btn-outline" data-bin-action="edit" data-bin-id="${safe(bin.id)}">Edit</button><button type="button" class="btn btn-outline" data-bin-action="delete" data-bin-id="${safe(bin.id)}">Delete</button></div>`;
    grid.appendChild(card);
  });
}
function resetForm() {
  editingId = null; $("#binForm")?.reset(); if ($("#binRecordId")) $("#binRecordId").value = "";
  $("#binFormTitle").textContent = "Add Collection Point"; $("#saveBinButton").textContent = "Save Collection Point";
}
function openForm(bin = null) {
  resetForm();
  if (bin) {
    editingId = bin.id; $("#binRecordId").value = bin.id;
    $("#binNameInput").value = bin.name || ""; $("#binAreaInput").value = bin.area || "";
    $("#binStatusInput").value = ["available","full","damaged","unknown"].includes(String(bin.status).toLowerCase()) ? String(bin.status).toLowerCase() : "unknown";
    $("#binAddressInput").value = bin.address || ""; $("#binLatitudeInput").value = bin.latitude ?? ""; $("#binLongitudeInput").value = bin.longitude ?? "";
    $("#binFormTitle").textContent = "Edit Collection Point"; $("#saveBinButton").textContent = "Update Collection Point";
  }
  $("#binForm").hidden = false; $("#binForm").scrollIntoView({behavior:"smooth",block:"nearest"}); $("#binNameInput").focus();
}
function goToMap(bin) {
  window.dispatchEvent(new CustomEvent("hysacam:focus-bin", {detail:{bin}}));
  const nav = document.querySelector('[data-go="map-section"]');
  if (nav) nav.click(); else window.dispatchEvent(new CustomEvent("hysacam:map-request"));
  // Re-issue after navigation so the map can finish initializing.
  setTimeout(() => window.dispatchEvent(new CustomEvent("hysacam:focus-bin", {detail:{bin}})), 350);
}
function init() {
  renderDirectory();
  $("#directorySearch")?.addEventListener("input", renderDirectory);
  $("#sortBins")?.addEventListener("change", renderDirectory);
  $("#clearFiltersButton")?.addEventListener("click", () => { $("#directorySearch").value = ""; $("#sortBins").value = "name"; renderDirectory(); });
  $("#toggleBinFormButton")?.addEventListener("click", () => { const form = $("#binForm"); if (!form) { notify("The collection-point form is missing from this page.", true); return; } if (!form.hidden && !editingId) { form.hidden = true; return; } openForm(); });
  $("#cancelBinEditButton")?.addEventListener("click", () => { $("#binForm").hidden = true; resetForm(); });
  $("#binForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const record = {name:$("#binNameInput").value, area:$("#binAreaInput").value, status:$("#binStatusInput").value, address:$("#binAddressInput").value, latitude:$("#binLatitudeInput").value, longitude:$("#binLongitudeInput").value};
    try {
      const wasEditing = editingId !== null;
      if (wasEditing) updateDustbin(editingId, record); else addDustbin(record);
      $("#binForm").hidden = true; resetForm(); renderDirectory(); notify(wasEditing ? "Collection point updated." : "Collection point saved.");
    } catch (error) { notify(error.message || "Could not save collection point.", true); }
  });
  $("#binGrid")?.addEventListener("click", event => {
    const button = event.target.closest("[data-bin-action]"); if (!button) return;
    const bin = getDustbins().find(item => String(item.id) === String(button.dataset.binId)); if (!bin) { notify("That collection point no longer exists.", true); renderDirectory(); return; }
    if (button.dataset.binAction === "map") goToMap(bin);
    if (button.dataset.binAction === "edit") openForm(bin);
    if (button.dataset.binAction === "delete") {
      if (!window.confirm(`Delete "${bin.name}" from this device? This cannot be undone unless you have an export.`)) return;
      if (deleteDustbin(bin.id)) { renderDirectory(); notify("Collection point deleted."); } else notify("Could not find that collection point.", true);
    }
  });
  window.addEventListener("hysacam:dustbins-changed", renderDirectory);
  window.addEventListener("storage", event => { if (event.key === "hysacam_kumba_bins") renderDirectory(); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true}); else init();
