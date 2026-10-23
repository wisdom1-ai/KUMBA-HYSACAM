"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.getElementById("dustbin-map");
  const mapMessage = document.getElementById("map-message");

  const showMessage = (message) => {
    if (mapMessage) mapMessage.textContent = message;
  };

  if (!mapElement || !window.L || typeof supabaseClient === "undefined") {
    showMessage("The map or database connection is unavailable.");
    return;
  }

  // Build the map toolbar without replacing your existing HTML.
  const section = mapElement.parentElement;

  const toolbar = document.createElement("div");
  toolbar.className = "map-toolbar";

  toolbar.innerHTML = `
    <div class="map-search">
      <input
        id="map-location-search"
        type="search"
        placeholder="⌕  Search location..."
        aria-label="Search dustbin locations"
      >

      <button id="map-filter-button" type="button">
        ☷ Filter
      </button>
    </div>

    <div id="map-filter-panel" class="map-filter-panel" hidden>
      <label for="map-status-filter">Dustbin status</label>
      <select id="map-status-filter">
        <option value="all">All statuses</option>
        <option value="available">Available</option>
        <option value="full">Full</option>
        <option value="maintenance">Maintenance</option>
        <option value="pending">Pending collection</option>
      </select>
    </div>
  `;

  section.insertBefore(toolbar, mapElement);

  const legend = document.createElement("div");
  legend.className = "map-legend";
  legend.innerHTML = `
    <span><i class="legend-dot bin-dot"></i> Dustbin Location</span>
    <span><i class="legend-dot selected-dot"></i> Selected Location</span>
    <button id="map-my-location" type="button">
      ◎ My Location
    </button>
  `;

  mapElement.insertAdjacentElement("afterend", legend);

  // Map setup
  const map = L.map(mapElement).setView([4.636, 9.446], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  const markers = [];
  let selectedMarker = null;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function statusColor(status) {
    const value = String(status || "").toLowerCase();

    if (value.includes("full") || value.includes("overflow")) {
      return "#e74c3c";
    }

    if (
      value.includes("damage") ||
      value.includes("broken") ||
      value.includes("maintenance")
    ) {
      return "#8e44ad";
    }

    if (value.includes("pending") || value.includes("collect")) {
      return "#f39c12";
    }

    return "#168653";
  }

  function createMarkerIcon(status, selected = false) {
    const color = selected ? "#2475e8" : statusColor(status);

    return L.divIcon({
      className: "hysacam-marker",
      html: `
        <div class="hysacam-pin" style="--pin-color:${color}">
          <span>♻</span>
        </div>
      `,
      iconSize: [34, 42],
      iconAnchor: [17, 40],
      popupAnchor: [0, -38]
    });
  }

  function selectMarker(item) {
    if (selectedMarker) {
      selectedMarker.marker.setIcon(
        createMarkerIcon(selectedMarker.bin.status)
      );
    }

    selectedMarker = item;

    item.marker.setIcon(
      createMarkerIcon(item.bin.status, true)
    );
  }

  function makePopup(bin) {
    const id = escapeHTML(bin.id);
    const name = escapeHTML(bin.name || "Unnamed collection point");
    const area = escapeHTML(bin.area || "Not specified");
    const status = escapeHTML(bin.status || "Available");

    return `
      <div class="bin-popup">
        <strong>${name}</strong>
        <p>${id}</p>
        <p>📍 ${area}</p>
        <p>Status: <strong>${status}</strong></p>
        <button
          type="button"
          class="bin-details-button"
          data-bin-id="${id}"
        >
          View Details
        </button>
      </div>
    `;
  }

  function addBinMarker(bin) {
    const marker = L.marker(
      [Number(bin.latitude), Number(bin.longitude)],
      { icon: createMarkerIcon(bin.status) }
    );

    const item = { bin, marker };

    marker.bindPopup(makePopup(bin));

    marker.on("click", () => selectMarker(item));

    marker.addTo(markerLayer);
    markers.push(item);
  }

  function applyFilters() {
    const query = document
      .getElementById("map-location-search")
      .value.trim().toLowerCase();

    const statusFilter = document
      .getElementById("map-status-filter")
      .value.toLowerCase();

    const visibleItems = [];

    markers.forEach((item) => {
      const bin = item.bin;
      const searchableText = [
        bin.id,
        bin.name,
        bin.area,
        bin.status
      ].join(" ").toLowerCase();

      const matchesSearch = searchableText.includes(query);
      const binStatus = String(bin.status || "available").toLowerCase();
      const matchesStatus =
        statusFilter === "all" || binStatus.includes(statusFilter);

      if (matchesSearch && matchesStatus) {
        if (!map.hasLayer(item.marker)) item.marker.addTo(markerLayer);
        visibleItems.push(item);
      } else {
        if (map.hasLayer(item.marker)) markerLayer.removeLayer(item.marker);
      }
    });

    if (
      selectedMarker &&
      !visibleItems.includes(selectedMarker)
    ) {
      selectedMarker = null;
    }

    if (visibleItems.length > 0) {
      const bounds = L.featureGroup(
        visibleItems.map((item) => item.marker)
      ).getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [30, 30],
          maxZoom: 15
        });
      }

      showMessage(
        `Showing ${visibleItems.length} matching dustbin location(s).`
      );
    } else {
      showMessage("No dustbin locations match your search and filter.");
    }
  }

  // Search and filter controls
  document
    .getElementById("map-location-search")
    .addEventListener("input", applyFilters);

  document
    .getElementById("map-status-filter")
    .addEventListener("change", applyFilters);

  document
    .getElementById("map-filter-button")
    .addEventListener("click", () => {
      const panel = document.getElementById("map-filter-panel");
      panel.hidden = !panel.hidden;
    });

  // Browser location control
  document
    .getElementById("map-my-location")
    .addEventListener("click", () => {
      if (!navigator.geolocation) {
        showMessage("Your browser does not support location services.");
        return;
      }

      showMessage("Finding your location...");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          L.circleMarker([lat, lng], {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#2475e8",
            fillOpacity: 1
          })
            .bindPopup("Your current location")
            .addTo(map)
            .openPopup();

          map.setView([lat, lng], 16);
          showMessage("Your current location is shown on the map.");
        },
        () => {
          showMessage(
            "Unable to get your location. Check browser location permissions."
          );
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  // Load registered dustbins from Supabase
  showMessage("Loading registered dustbin locations...");

  try {
    const { data, error } = await supabaseClient
      .from("bins")
      .select("id, name, area, latitude, longitude, status");

    if (error) throw error;

    const validBins = (data || []).filter((bin) => {
      const lat = Number(bin.latitude);
      const lng = Number(bin.longitude);

      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180
      );
    });

    validBins.forEach(addBinMarker);

    if (markers.length > 0) {
      const bounds = L.featureGroup(
        markers.map((item) => item.marker)
      ).getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [30, 30],
          maxZoom: 15
        });
      }

      showMessage(`Loaded ${markers.length} registered dustbin location(s).`);
    } else {
      showMessage(
        "No dustbins with valid coordinates were found in the database."
      );
    }

    applyFilters();

  } catch (error) {
    console.error("Could not load dustbin locations:", error);

    showMessage(
      "Could not load dustbins. Check your Supabase connection and table permissions."
    );
  }

  // Handle the View Details button inside map popups.
  mapElement.addEventListener("click", (event) => {
    const button = event.target.closest(".bin-details-button");
    if (!button) return;

    const binId = button.dataset.binId;

    // Dispatch an event for the details page or directory script to handle.
    document.dispatchEvent(
      new CustomEvent("hysacam:bin-details", {
        detail: { binId }
      })
    );
  });

  setTimeout(() => map.invalidateSize(), 250);
});