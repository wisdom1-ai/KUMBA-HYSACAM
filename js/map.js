"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.getElementById("dustbin-map");
  const mapMessage = document.getElementById("map-message");

  const showMessage = (message) => {
    if (mapMessage) mapMessage.textContent = message;
  };

  if (!mapElement) {
    console.error("Map container #dustbin-map was not found.");
    return;
  }

  if (!window.L) {
    showMessage("The map library did not load. Check your internet connection.");
    return;
  }

  if (typeof supabaseClient === "undefined") {
    showMessage("Database connection is not configured.");
    return;
  }

  /* -------------------------------
     MAP TOOLBAR
  -------------------------------- */

  const section = mapElement.parentElement;

  let toolbar = document.getElementById("map-toolbar");

  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "map-toolbar";
    toolbar.className = "map-toolbar";

    toolbar.innerHTML = `
      <div class="map-search">
        <input
          id="map-location-search"
          type="search"
          placeholder="⌕  Search location..."
          aria-label="Search dustbin locations"
          autocomplete="off"
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
  }

  /* -------------------------------
     MAP LEGEND
  -------------------------------- */

  let legend = document.getElementById("map-legend");

  if (!legend) {
    legend = document.createElement("div");
    legend.id = "map-legend";
    legend.className = "map-legend";

    legend.innerHTML = `
      <span>
        <i class="legend-dot bin-dot"></i>
        Dustbin Location
      </span>

      <span>
        <i class="legend-dot selected-dot"></i>
        Selected Location
      </span>

      <button id="map-my-location" type="button">
        ◎ My Location
      </button>
    `;

    mapElement.insertAdjacentElement("afterend", legend);
  }

  const searchInput = document.getElementById("map-location-search");
  const filterButton = document.getElementById("map-filter-button");
  const filterPanel = document.getElementById("map-filter-panel");
  const statusFilter = document.getElementById("map-status-filter");
  const myLocationButton = document.getElementById("map-my-location");

  /* -------------------------------
     CREATE MAP
  -------------------------------- */

  const map = L.map(mapElement, {
    zoomControl: true
  }).setView([4.636, 9.446], 13);

  map.zoomControl.setPosition("topleft");

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  const markers = [];

  let selectedMarker = null;
  let currentLocationMarker = null;

  /* -------------------------------
     SAFE TEXT OUTPUT
  -------------------------------- */

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  /* -------------------------------
     MARKER COLORS
  -------------------------------- */

  function markerColor(status) {
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

    if (value.includes("collect") || value.includes("pending")) {
      return "#f39c12";
    }

    return "#168653";
  }

  function createMarkerIcon(status, selected = false) {
    const color = selected ? "#2475e8" : markerColor(status);

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

  /* -------------------------------
     DUSTBIN POPUPS
  -------------------------------- */

  function createPopup(bin) {
    const id = escapeHTML(bin.id);
    const name = escapeHTML(bin.name || "Unnamed collection point");
    const area = escapeHTML(bin.area || "Not specified");
    const status = escapeHTML(bin.status || "Available");

    return `
      <div class="bin-popup">
        <strong>${name}</strong>

        <p class="bin-popup-id">${id}</p>
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

  function addBinMarker(bin) {
    const marker = L.marker(
      [Number(bin.latitude), Number(bin.longitude)],
      {
        icon: createMarkerIcon(bin.status),
        title: bin.name || "Dustbin location",
        alt: bin.name || "Dustbin location"
      }
    );

    const item = { bin, marker };

    marker.bindPopup(createPopup(bin));

    marker.on("click", () => {
      selectMarker(item);
    });

    marker.addTo(markerLayer);
    markers.push(item);
  }

  /* -------------------------------
     SEARCH AND FILTER
  -------------------------------- */

  function applyFilters() {
    const query = (searchInput.value || "").trim().toLowerCase();
    const chosenStatus = (statusFilter.value || "all").toLowerCase();

    const visibleMarkers = [];

    markers.forEach((item) => {
      const bin = item.bin;

      const searchableText = [
        bin.id,
        bin.name,
        bin.area,
        bin.status
      ].join(" ").toLowerCase();

      const matchesSearch = searchableText.includes(query);

      const status = String(bin.status || "available").toLowerCase();

      const matchesStatus =
        chosenStatus === "all" || status.includes(chosenStatus);

      const visible = matchesSearch && matchesStatus;

      if (visible) {
        if (!markerLayer.hasLayer(item.marker)) {
          item.marker.addTo(markerLayer);
        }

        visibleMarkers.push(item);
      } else {
        if (markerLayer.hasLayer(item.marker)) {
          markerLayer.removeLayer(item.marker);
        }

        if (selectedMarker === item) {
          selectedMarker = null;
        }
      }
    });

    if (visibleMarkers.length > 0) {
      const bounds = L.featureGroup(
        visibleMarkers.map((item) => item.marker)
      ).getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [30, 30],
          maxZoom: 15
        });
      }

      showMessage(
        `Showing ${visibleMarkers.length} matching dustbin location(s).`
      );
    } else {
      showMessage("No dustbin locations match your search and filter.");
    }
  }

  searchInput.addEventListener("input", applyFilters);

  filterButton.addEventListener("click", () => {
    filterPanel.hidden = !filterPanel.hidden;
  });

  statusFilter.addEventListener("change", applyFilters);

  /* -------------------------------
     FLOATING CURRENT-LOCATION BUTTON
  -------------------------------- */

  const locationControl = L.control({
    position: "topright"
  });

  locationControl.onAdd = function () {
    const button = L.DomUtil.create(
      "button",
      "map-floating-location"
    );

    button.type = "button";
    button.title = "Find my location";
    button.setAttribute("aria-label", "Find my location");
    button.innerHTML = "◎";

    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.disableScrollPropagation(button);

    button.addEventListener("click", () => {
      myLocationButton.click();
    });

    return button;
  };

  locationControl.addTo(map);

  function findMyLocation() {
    if (!navigator.geolocation) {
      showMessage("Your browser does not support location services.");
      return;
    }

    showMessage("Finding your current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (currentLocationMarker) {
          map.removeLayer(currentLocationMarker);
        }

        currentLocationMarker = L.circleMarker([lat, lng], {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: "#2475e8",
          fillOpacity: 1
        })
          .bindPopup("Your current location")
          .addTo(map);

        map.setView([lat, lng], 16);
        currentLocationMarker.openPopup();

        showMessage("Your current location is shown on the map.");
      },
      (error) => {
        console.warn("Location unavailable:", error.message);

        if (error.code === 1) {
          showMessage(
            "Location permission was denied. Allow location access in your browser settings."
          );
        } else if (error.code === 3) {
          showMessage("Location request timed out. Please try again.");
        } else {
          showMessage("Unable to determine your location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  myLocationButton.addEventListener("click", findMyLocation);

  /* -------------------------------
     VIEW DETAILS EVENT
  -------------------------------- */

  mapElement.addEventListener("click", (event) => {
    const button = event.target.closest(".bin-details-button");

    if (!button) return;

    document.dispatchEvent(
      new CustomEvent("hysacam:bin-details", {
        detail: {
          binId: button.dataset.binId
        }
      })
    );
  });

  /* -------------------------------
     LOAD DUSTBINS FROM SUPABASE
  -------------------------------- */

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
        bin.latitude !== null &&
        bin.longitude !== null &&
        bin.latitude !== "" &&
        bin.longitude !== "" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
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

      showMessage(
        `Showing ${markers.length} registered dustbin location(s).`
      );
    } else {
      showMessage(
        "No registered dustbins with valid coordinates were found."
      );
    }

    applyFilters();

  } catch (error) {
    console.error("Could not load dustbin locations:", error);

    showMessage(
      "Could not load dustbins. Check your Supabase connection, bins table and access policies."
    );
  }

  /* -------------------------------
     MAP SIZE FIX
  -------------------------------- */

  setTimeout(() => {
    map.invalidateSize();
  }, 250);

  window.addEventListener("resize", () => {
    map.invalidateSize();
  });
});