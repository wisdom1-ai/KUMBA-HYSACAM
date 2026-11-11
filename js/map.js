"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.getElementById("dustbin-map");
  const mapMessage = document.getElementById("map-message");
  const showMessage = (message) => { if (mapMessage) mapMessage.textContent = message; };
  if (!mapElement) return;
  if (!window.L) { showMessage("Map could not load — check your internet connection"); return; }
  if (typeof supabaseClient === "undefined") { showMessage("Database connection is not configured"); return; }

  const mapFrame = mapElement.parentElement;
  const section = mapFrame.parentElement;
  let toolbar = document.getElementById("map-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "map-toolbar";
    toolbar.className = "map-toolbar";
    toolbar.innerHTML = `<div class="map-search"><input id="map-location-search" type="search" placeholder="Search a Kumba location" aria-label="Search dustbin locations" autocomplete="off"><button id="map-filter-button" type="button">Filter</button></div><div id="map-filter-panel" class="map-filter-panel" hidden><label for="map-status-filter">Dustbin status</label><select id="map-status-filter"><option value="all">All statuses</option><option value="available">Available</option><option value="full">Full</option><option value="maintenance">Maintenance</option><option value="pending">Pending collection</option></select></div>`;
    section.insertBefore(toolbar, mapFrame);
  }
  let legend = document.getElementById("map-legend");
  if (!legend) {
    legend = document.createElement("div"); legend.id = "map-legend"; legend.className = "map-legend";
    legend.innerHTML = `<span><i class="legend-dot bin-dot"></i> Registered dustbin locations</span><span><i class="legend-dot selected-dot"></i> Selected location</span>`;
    mapFrame.insertAdjacentElement("afterend", legend);
  }
  const search = document.getElementById("map-location-search");
  const filterButton = document.getElementById("map-filter-button");
  const filterPanel = document.getElementById("map-filter-panel");
  const statusFilter = document.getElementById("map-status-filter");

  // Gestures are enabled only on the map canvas
  const map = L.map(mapElement, {
    zoomControl: true, scrollWheelZoom: true, doubleClickZoom: true,
    touchZoom: true, touchRotate: true, rotate: true,
    rotateControl: { closeOnZeroBearing: false },
    boxZoom: false, keyboard: true, dragging: true,
    tap: true, attributionControl: true, minZoom: 11, maxZoom: 19
  }).setView([4.6363, 9.4469], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 11, maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const layer = L.layerGroup().addTo(map);
  const items = new Map();
  let selected = null;
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const greenDot = (active = false) => L.divIcon({
    className: "hysacam-green-indicator",
    html: `<span class="hysacam-green-dot${active ? " is-selected" : ""}"></span>`,
    iconSize: [22, 22], iconAnchor: [11, 11]
  });
  function addBin(bin) {
    const lat = Number(bin.latitude), lng = Number(bin.longitude);
    if (bin.latitude == null || bin.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const marker = L.marker([lat, lng], { icon: greenDot(), title: bin.name || `Dustbin ${bin.id}`, keyboard: false });
    marker.bindPopup(`<div class="bin-popup"><strong>${escapeHTML(bin.name || "Registered collection point")}</strong><p>${escapeHTML(bin.area || "Kumba")}</p><p>Status: ${escapeHTML(bin.status || "Not specified")}</p></div>`);
    const item = { bin, marker };
    marker.on("click", () => {
      if (selected) selected.marker.setIcon(greenDot());
      selected = item; marker.setIcon(greenDot(true));
    });
    marker.addTo(layer); items.set(String(bin.id), item);
  }
  function filterMarkers() {
    const q = (search.value || "").trim().toLowerCase();
    const wanted = (statusFilter.value || "all").toLowerCase();
    let count = 0;
    items.forEach(item => {
      const b = item.bin;
      const text = [b.id, b.name, b.area, b.status].join(" ").toLowerCase();
      const match = text.includes(q) && (wanted === "all" || String(b.status || "").toLowerCase().includes(wanted));
      if (match) { if (!layer.hasLayer(item.marker)) item.marker.addTo(layer); count++; }
      else if (layer.hasLayer(item.marker)) layer.removeLayer(item.marker);
    });
    showMessage(count ? `${count} registered location${count === 1 ? "" : "s"} shown on the Kumba map` : "No registered locations match this search");
  }
  search.addEventListener("input", filterMarkers);
  filterButton.addEventListener("click", () => { filterPanel.hidden = !filterPanel.hidden; });
  statusFilter.addEventListener("change", filterMarkers);

  document.addEventListener("hysacam:show-bin", event => {
    const id = event.detail?.binId;
    const item = id != null ? items.get(String(id)) : null;
    if (!item) { showMessage("This collection point has no verified map location yet"); return; }
    search.value = ""; statusFilter.value = "all"; filterMarkers();
    if (selected) selected.marker.setIcon(greenDot());
    selected = item; item.marker.setIcon(greenDot(true)); item.marker.openPopup();
    showMessage(`Selected ${item.bin.name || "collection point"} in ${item.bin.area || "Kumba"}`);
  });

  showMessage("Loading all registered dustbin locations in Kumba");
  try {
    // Supabase returns a limited page by default — retrieve every page so no saved locations are omitted
    const allBins = []; const pageSize = 500; let from = 0;
    while (true) {
      const { data, error } = await supabaseClient.from("bins")
        .select("id, name, area, latitude, longitude, status")
        .order("name", { ascending: true }).range(from, from + pageSize - 1);
      if (error) throw error;
      const page = data || []; allBins.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    allBins.forEach(addBin);
    if (items.size) {
      const bounds = L.featureGroup([...items.values()].map(x => x.marker)).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14, animate: false });
      showMessage(`Showing all ${items.size} registered dustbin locations in Kumba`);
    } else showMessage("No verified dustbin locations with Kumba coordinates are registered yet");
  } catch (error) {
    console.error("Could not load dustbin locations", error);
    showMessage("Could not load locations — check the bins table permissions and Supabase connection");
  }
  setTimeout(() => map.invalidateSize(), 250);
  window.addEventListener("resize", () => map.invalidateSize());
});
