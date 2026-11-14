"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.getElementById("dustbin-map");
  const mapMessage = document.getElementById("map-message");
  if (!mapElement) return;

  const showMessage = (message) => { if (mapMessage) mapMessage.textContent = message; };
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
  const hasCoordinates = bin => {
    if (bin.latitude === null || bin.latitude === "" || bin.longitude === null || bin.longitude === "") return false;
    const lat = Number(bin.latitude), lng = Number(bin.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  };
  const normalizeStatus = status => String(status || "available").trim().toLowerCase();

  if (!window.L) { showMessage("The map could not load. Check your internet connection and reload the page."); return; }
  if (typeof supabaseClient === "undefined") { showMessage("The map database connection is not configured."); return; }

  const mapFrame = mapElement.parentElement;
  const section = mapFrame?.parentElement;
  if (!mapFrame || !section) return;

  // Search and filter toolbar is placed directly under the map heading.
  let toolbar = document.getElementById("map-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "map-toolbar";
    toolbar.className = "map-toolbar map-toolbar-pro";
    toolbar.innerHTML = `
      <label class="map-search-pro" for="map-location-search">
        <span class="map-search-icon" aria-hidden="true">⌕</span>
        <input id="map-location-search" type="search" placeholder="Search dustbin, street or area" aria-label="Search dustbin, street or area" autocomplete="off">
        <button id="map-search-clear" class="map-search-clear" type="button" aria-label="Clear search" hidden>×</button>
      </label>
      <div class="map-filter-wrap">
        <button id="map-filter-button" class="map-filter-trigger" type="button" aria-expanded="false" aria-controls="map-filter-panel">
          <span aria-hidden="true">☷</span> Filter <span class="map-filter-chevron" aria-hidden="true">⌄</span>
        </button>
        <div id="map-filter-panel" class="map-filter-panel map-filter-panel-pro" hidden>
          <div class="map-filter-heading"><strong>Filter dustbins</strong><button id="map-filter-close" type="button" aria-label="Close filters">×</button></div>
          <label for="map-status-filter">Collection point status</label>
          <select id="map-status-filter">
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="full">Full</option>
            <option value="maintenance">Maintenance</option>
            <option value="pending">Pending collection</option>
          </select>
          <button id="map-filter-reset" class="map-filter-reset" type="button">Reset filters</button>
        </div>
      </div>
      <span id="map-result-count" class="map-result-count" aria-live="polite">Loading locations…</span>
    `;
    section.insertBefore(toolbar, mapFrame);
  }

  let legend = document.getElementById("map-legend");
  if (!legend) {
    legend = document.createElement("div");
    legend.id = "map-legend";
    legend.className = "map-legend map-legend-pro";
    legend.innerHTML = `
      <span><i class="legend-dot bin-dot"></i> Dustbin Location</span>
      <span><i class="legend-dot selected-dot"></i> Selected Location</span>
      <span class="map-legend-note">Select a pin to view its details</span>
    `;
    mapFrame.insertAdjacentElement("afterend", legend);
  }

  // Custom, touch-friendly controls remain visible even when the global stylesheet hides Leaflet's default controls.
  let controls = document.getElementById("map-custom-controls");
  if (!controls) {
    controls = document.createElement("div");
    controls.id = "map-custom-controls";
    controls.className = "map-custom-controls";
    controls.innerHTML = `
      <button type="button" id="map-zoom-in" aria-label="Zoom in">+</button>
      <button type="button" id="map-zoom-out" aria-label="Zoom out">−</button>
      <span class="map-control-divider"></span>
      <button type="button" id="map-locate-me" aria-label="Show my current location" title="Show my location"><span aria-hidden="true">◎</span></button>
    `;
    mapFrame.appendChild(controls);
  }

  const search = document.getElementById("map-location-search");
  ["home-map-search","map-page-search"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", e => { if (search) { search.value = e.target.value; search.dispatchEvent(new Event("input", {bubbles:true})); } });
  });
  ["home-map-filter","map-page-filter"].forEach(id => document.getElementById(id)?.addEventListener("click", () => {
    if (filterPanel) { filterPanel.hidden = !filterPanel.hidden; filterButton?.setAttribute("aria-expanded", String(!filterPanel.hidden)); }
  }));

  const clearSearch = document.getElementById("map-search-clear");
  const filterButton = document.getElementById("map-filter-button");
  const filterPanel = document.getElementById("map-filter-panel");
  const filterClose = document.getElementById("map-filter-close");
  const statusFilter = document.getElementById("map-status-filter");
  const resultCount = document.getElementById("map-result-count");
  const filterReset = document.getElementById("map-filter-reset");

  const map = L.map(mapElement, {
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    touchRotate: true,
    rotate: true,
    rotateControl: { closeOnZeroBearing: false },
    boxZoom: false,
    keyboard: true,
    dragging: true,
    tap: true,
    attributionControl: true,
    minZoom: 11,
    maxZoom: 19
  }).setView([4.6363, 9.4469], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 11,
    maxZoom: 19,
    attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a> contributors"
  }).addTo(map);

  const layer = L.layerGroup().addTo(map);
  const items = new Map();
  let selected = null;
  let userMarker = null;
  let userAccuracy = null;
  let allValidBins = [];

  function pinIcon(isSelected = false, status = "available") {
    const state = String(status || "available").toLowerCase();
    const stateClass = state.includes("maint") || state.includes("damage") ? " is-maintenance" : state.includes("full") || state.includes("overflow") || state.includes("pending") ? " is-attention" : "";
    return L.divIcon({
      className: "hysacam-map-pin-wrap",
      html: `<span class="hysacam-map-pin${isSelected ? " is-selected" : stateClass}"><span class="pin-recycle" aria-hidden="true">♻</span></span>`,
      iconSize: isSelected ? [38, 46] : [34, 42],
      iconAnchor: isSelected ? [19, 44] : [17, 40],
      popupAnchor: [0, -36]
    });
  }

  function popupContent(bin) {
    const code = escapeHTML(bin.bin_code || `BIN-${String(bin.id || "").slice(0, 8).toUpperCase()}`);
    const name = escapeHTML(bin.name || "Registered collection point");
    const area = escapeHTML(bin.area || "Kumba");
    const status = escapeHTML(bin.status || "available");
    return `<div class="hysacam-bin-popup">
      <div class="hysacam-popup-top"><span class="hysacam-popup-code">${code}</span><span class="hysacam-popup-status">${status}</span></div>
      <strong>${name}</strong>
      <p><span aria-hidden="true">⌖</span> ${area}</p>
      <button type="button" class="hysacam-popup-details" data-view-bin="${escapeHTML(bin.id)}">View Details <span aria-hidden="true">→</span></button>
    </div>`;
  }

  function selectItem(item, openPopup = true) {
    if (!item) return;
    if (selected && selected !== item) selected.marker.setIcon(pinIcon(false, selected.bin.status));
    selected = item;
    item.marker.setIcon(pinIcon(true));
    if (openPopup) item.marker.openPopup();
    document.dispatchEvent(new CustomEvent("hysacam:bin-selected", { detail: { bin: item.bin } }));
    if (resultCount) resultCount.textContent = `${visibleCount()} location${visibleCount() === 1 ? "" : "s"} shown`;
  }

  function addBin(bin) {
    if (!hasCoordinates(bin)) return;
    const lat = Number(bin.latitude), lng = Number(bin.longitude);
    const marker = L.marker([lat, lng], {
      icon: pinIcon(false, bin.status),
      title: `${bin.bin_code || "Dustbin"} — ${bin.name || bin.area || "Kumba"}`,
      keyboard: true,
      riseOnHover: true
    });
    marker.bindPopup(() => popupContent(bin), { maxWidth: 260, minWidth: 190, closeButton: true, autoPan: true });
    const item = { bin, marker };
    marker.on("click", () => selectItem(item, false));
    marker.addTo(layer);
    items.set(String(bin.id), item);
    allValidBins.push(item);
  }

  function matchesFilter(bin) {
    const q = (search?.value || "").trim().toLowerCase();
    const wanted = (statusFilter?.value || "all").toLowerCase();
    const text = [bin.bin_code, bin.name, bin.area, bin.status].join(" ").toLowerCase();
    const status = normalizeStatus(bin.status);
    const statusMatch = wanted === "all" || status === wanted || (wanted === "pending" && (status.includes("pending") || status.includes("collection")));
    return text.includes(q) && statusMatch;
  }

  function visibleCount() {
    return allValidBins.filter(item => matchesFilter(item.bin)).length;
  }

  function applyFilters() {
    let count = 0;
    allValidBins.forEach(item => {
      const match = matchesFilter(item.bin);
      if (match) {
        if (!layer.hasLayer(item.marker)) item.marker.addTo(layer);
        count++;
      } else if (layer.hasLayer(item.marker)) {
        layer.removeLayer(item.marker);
        if (selected === item) { item.marker.setIcon(pinIcon(false, item.bin.status)); selected = null; }
      }
    });
    clearSearch.hidden = !(search.value || "").length;
    if (resultCount) resultCount.textContent = `${count} of ${allValidBins.length} mapped locations`;
    showMessage(count ? `Showing ${count} registered dustbin location${count === 1 ? "" : "s"} around Kumba` : "No mapped dustbin locations match these filters");
    return count;
  }

  function setFilterOpen(open) {
    filterPanel.hidden = !open;
    filterButton.setAttribute("aria-expanded", String(open));
    filterButton.classList.toggle("is-open", open);
  }

  search.addEventListener("input", applyFilters);
  clearSearch.addEventListener("click", () => { search.value = ""; applyFilters(); search.focus(); });
  filterButton.addEventListener("click", () => setFilterOpen(filterPanel.hidden));
  filterClose.addEventListener("click", () => setFilterOpen(false));
  statusFilter.addEventListener("change", () => { applyFilters(); setFilterOpen(false); });
  filterReset.addEventListener("click", () => { search.value = ""; statusFilter.value = "all"; applyFilters(); setFilterOpen(false); });
  document.addEventListener("click", event => {
    if (!filterPanel.hidden && !event.target.closest(".map-filter-wrap")) setFilterOpen(false);
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") setFilterOpen(false); });

  document.getElementById("map-zoom-in").addEventListener("click", () => map.zoomIn());
  document.getElementById("map-zoom-out").addEventListener("click", () => map.zoomOut());
  document.getElementById("map-locate-me").addEventListener("click", () => {
    if (!navigator.geolocation) { showMessage("Location services are not available in this browser"); return; }
    showMessage("Finding your current location…");
    navigator.geolocation.getCurrentPosition(position => {
      const latlng = [position.coords.latitude, position.coords.longitude];
      if (userMarker) map.removeLayer(userMarker);
      if (userAccuracy) map.removeLayer(userAccuracy);
      userAccuracy = L.circle(latlng, {
        radius: Math.max(30, Math.min(position.coords.accuracy || 100, 700)),
        color: "#2875d8", weight: 1, fillColor: "#2875d8", fillOpacity: .10
      }).addTo(map);
      userMarker = L.circleMarker(latlng, {
        radius: 7, color: "#fff", weight: 3, fillColor: "#2875d8", fillOpacity: 1
      }).addTo(map).bindPopup("<strong>Your current location</strong>");
      map.setView(latlng, Math.max(map.getZoom(), 15), { animate: true });
      userMarker.openPopup();
      showMessage("Your current location is shown in blue. It has not been saved to HYSACAM.");
    }, error => {
      const message = error.code === 1 ? "Location permission was denied. Allow location access in your browser to use this feature." : "Could not determine your location. Check your device location settings and try again.";
      showMessage(message);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });

  // Popup action: select the exact bin, populate its details, and navigate
  // through the shared page router so hidden mobile sections become visible.
  map.on("popupopen", event => {
    const popupElement = event.popup.getElement();
    const button = popupElement?.querySelector("[data-view-bin]");
    if (!button || button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", clickEvent => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      const item = items.get(String(button.dataset.viewBin));
      if (!item) {
        showMessage("This dustbin could not be found. Refresh the map and try again.");
        return;
      }
      selectItem(item, false);
      map.closePopup();
      if (typeof window.hysacamNavigate === "function") {
        window.hysacamNavigate("details");
      } else {
        const details = document.getElementById("details");
        details?.classList.remove("route-hidden");
        if (location.hash !== "#details") location.hash = "#details";
        requestAnimationFrame(() => details?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      showMessage(`Showing details for ${item.bin.name || item.bin.bin_code || "selected dustbin"}`);
    });
  });

  document.addEventListener("hysacam:show-bin", event => {
    const id = event.detail?.binId;
    const item = id != null ? items.get(String(id)) : null;
    if (!item) { showMessage("This collection point has no verified GPS location yet"); return; }
    search.value = "";
    statusFilter.value = "all";
    applyFilters();
    map.setView(item.marker.getLatLng(), Math.max(map.getZoom(), 16), { animate: true });
    selectItem(item, true);
    showMessage(`Selected ${item.bin.name || "collection point"} in ${item.bin.area || "Kumba"}`);
  });

  showMessage("Loading registered dustbin locations around Kumba…");
  try {
    const allBins = [];
    const pageSize = 500;
    let from = 0;
    while (true) {
      const { data, error } = await supabaseClient.from("bins")
        .select("id, bin_code, name, area, latitude, longitude, status")
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = data || [];
      allBins.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    allBins.forEach(addBin);
    if (allValidBins.length) {
      const bounds = L.featureGroup(allValidBins.map(item => item.marker)).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15, animate: false });
      applyFilters();
      const withoutCoordinates = allBins.length - allValidBins.length;
      showMessage(`Showing ${allValidBins.length} mapped dustbin locations${withoutCoordinates ? ` · ${withoutCoordinates} without GPS coordinates` : ""}`);
    } else {
      if (resultCount) resultCount.textContent = "0 mapped locations";
      showMessage(allBins.length ? "Dustbins are registered, but none has verified map coordinates yet" : "No dustbins have been registered yet");
    }
  } catch (error) {
    console.error("Could not load dustbin locations:", error);
    showMessage("Could not load dustbin locations. Check your connection and database permissions.");
  }

  // Leaflet needs a size refresh after mobile viewport changes or section navigation.
  const invalidate = () => requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  setTimeout(invalidate, 250);
  window.addEventListener("resize", invalidate, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(invalidate, 250), { passive: true });
  document.querySelectorAll('a[href="#map"]').forEach(link => link.addEventListener("click", () => setTimeout(invalidate, 350)));
  if (window.ResizeObserver) new ResizeObserver(invalidate).observe(mapFrame);
});
