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

  /* MAP TOOLBAR */

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
          placeholder="Search location..."
          aria-label="Search dustbin locations"
          autocomplete="off"
        >
        <button id="map-filter-button" type="button">Filter</button>
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

  let legend = document.getElementById("map-legend");

  if (!legend) {
    legend = document.createElement("div");
    legend.id = "map-legend";
    legend.className = "map-legend";

    legend.innerHTML = `
      <span><i class="legend-dot bin-dot"></i> Dustbin Location</span>
      <span><i class="legend-dot selected-dot"></i> Selected Location</span>
      <button id="map-my-location" type="button">◎ My Location</button>
    `;

    section.insertAdjacentElement("afterend", legend);
  }

  const mapSearch = document.getElementById("map-location-search");
  const filterButton = document.getElementById("map-filter-button");
  const filterPanel = document.getElementById("map-filter-panel");
  const statusFilter = document.getElementById("map-status-filter");
  const myLocationButton = document.getElementById("map-my-location");

  /* CREATE MAP */

  const map = L.map(mapElement, {
    zoomControl: true
  }).setView([4.636, 9.446], 13);

  map.zoomControl.setPosition("topleft");

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  const markerItems = new Map();

  let selectedItem = null;
  let currentLocationMarker = null;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  /* MARKER APPEARANCE */

  function markerColor(status) {
    const value = String(status || "").toLowerCase();

    if (value.includes("full") || value.includes("overflow")) {
      return "#e74c3c";
    }

    if (
      value.includes("maintenance") ||
      value.includes("broken") ||
      value.includes("damage")
    ) {
      return "#8e44ad";
    }

    if (value.includes("pending") || value.includes("collect")) {
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

  /* DUSTBIN DETAILS POPUP */

  function createPopup(bin) {
    return `
      <div class="bin-popup">
        <strong>${escapeHTML(bin.name || "Unnamed collection point")}</strong>
        <p><strong>ID:</strong> ${escapeHTML(bin.id)}</p>
        <p><strong>Area:</strong> ${escapeHTML(bin.area || "Not specified")}</p>
        <p><strong>Status:</strong> ${escapeHTML(bin.status || "Available")}</p>
      </div>
    `;
  }

  function selectItem(item, openPopup = true) {
    if (selectedItem && selectedItem.marker !== item.marker) {
      selectedItem.marker.setIcon(
        createMarkerIcon(selectedItem.bin.status)
      );
    }

    selectedItem = item;
    item.marker.setIcon(createMarkerIcon(item.bin.status, true));

    if (!markerLayer.hasLayer(item.marker)) {
      item.marker.addTo(markerLayer);
    }

    if (openPopup) {
      item.marker.openPopup();
    }
  }

  function addBin(bin) {
    const latitude = Number(bin.latitude);
    const longitude = Number(bin.longitude);

    const marker = L.marker([latitude, longitude], {
      icon: createMarkerIcon(bin.status),
      title: bin.name || "Dustbin location"
    });

    const item = { bin, marker };

    marker.bindPopup(createPopup(bin));

    marker.on("click", () => {
      selectItem(item, false);
    });

    marker.addTo(markerLayer);
    markerItems.set(String(bin.id), item);
  }

  /* SEARCH AND FILTER */

  function applyFilters() {
    const query = (mapSearch.value || "").trim().toLowerCase();
    const wantedStatus = (statusFilter.value || "all").toLowerCase();
    let visibleCount = 0;

    markerItems.forEach((item) => {
      const bin = item.bin;

      const searchable = [
        bin.id,
        bin.name,
        bin.area,
        bin.status
      ].join(" ").toLowerCase();

      const actualStatus = String(bin.status || "available").toLowerCase();

      const matchesQuery = searchable.includes(query);
      const matchesStatus =
        wantedStatus === "all" || actualStatus.includes(wantedStatus);

      if (matchesQuery && matchesStatus) {
        if (!markerLayer.hasLayer(item.marker)) {
          item.marker.addTo(markerLayer);
        }
        visibleCount++;
      } else {
        if (markerLayer.hasLayer(item.marker)) {
          markerLayer.removeLayer(item.marker);
        }

        if (selectedItem === item) {
          selectedItem = null;
        }
      }
    });

    showMessage(
      visibleCount
        ? `Showing ${visibleCount} matching dustbin location(s).`
        : "No dustbin locations match your search and filter."
    );
  }

  mapSearch.addEventListener("input", applyFilters);

  filterButton.addEventListener("click", () => {
    filterPanel.hidden = !filterPanel.hidden;
  });

  statusFilter.addEventListener("change", applyFilters);

  /* VIEW A DUSTBIN FROM PAGE 3 */

  document.addEventListener("hysacam:show-bin", (event) => {
    const detail = event.detail || {};
    const binId = detail.binId;

    // Prefer the exact database ID sent by the directory.
    let item = binId != null
      ? markerItems.get(String(binId))
      : null;

    // Fall back to the supplied coordinates if no ID match exists.
    if (!item) {
      const latitude = Number(detail.latitude);
      const longitude = Number(detail.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        showMessage("This dustbin has no valid map coordinates.");
        return;
      }

      item = [...markerItems.values()].find(({ bin }) =>
        Math.abs(Number(bin.latitude) - latitude) < 0.000001 &&
        Math.abs(Number(bin.longitude) - longitude) < 0.000001
      );
    }

    if (!item) {
      showMessage("This dustbin could not be found on the map.");
      return;
    }

    // Ensure filters do not hide the selected location.
    mapSearch.value = "";
    statusFilter.value = "all";
    applyFilters();

    selectItem(item, false);

    const latitude = Number(item.bin.latitude);
    const longitude = Number(item.bin.longitude);

    map.setView([latitude, longitude], 17, {
      animate: true
    });

    // Open the popup after Leaflet begins moving to the location.
    map.once("moveend", () => {
      item.marker.openPopup();
    });

    // Also handle cases where the map is already at the same location.
    setTimeout(() => {
      if (selectedItem === item) {
        item.marker.openPopup();
      }
    }, 350);

    showMessage(
      `Selected collection point: ${item.bin.name || item.bin.id}`
    );
  });

  /* CURRENT LOCATION */

  const locationControl = L.control({ position: "topright" });

  locationControl.onAdd = function () {
    const button = L.DomUtil.create("button", "map-floating-location");

    button.type = "button";
    button.title = "Find my location";
    button.setAttribute("aria-label", "Find my location");
    button.textContent = "◎";

    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.disableScrollPropagation(button);

    button.addEventListener("click", () => myLocationButton.click());

    return button;
  };

  locationControl.addTo(map);

  myLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showMessage("Your browser does not support location services.");
      return;
    }

    showMessage("Finding your current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        if (currentLocationMarker) {
          map.removeLayer(currentLocationMarker);
        }

        currentLocationMarker = L.circleMarker(
          [latitude, longitude],
          {
            radius: 8,
            color: "#fff",
            weight: 3,
            fillColor: "#2475e8",
            fillOpacity: 1
          }
        )
          .bindPopup("Your current location")
          .addTo(map);

        map.setView([latitude, longitude], 16);
        currentLocationMarker.openPopup();

        showMessage("Your current location is shown on the map.");
      },
      (error) => {
        console.warn("Could not get current location:", error.message);

        if (error.code === 1) {
          showMessage("Location permission was denied. Check your browser settings.");
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
  });

  /* LOAD FROM SUPABASE */

  showMessage("Loading registered dustbin locations...");

  try {
    const { data, error } = await supabaseClient
      .from("bins")
      .select("id, name, area, latitude, longitude, status");

    if (error) throw error;

    const validBins = (data || []).filter((bin) => {
      const latitude = Number(bin.latitude);
      const longitude = Number(bin.longitude);

      return (
        bin.latitude !== null &&
        bin.latitude !== "" &&
        bin.longitude !== null &&
        bin.longitude !== "" &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      );
    });

    validBins.forEach(addBin);

    if (validBins.length > 0) {
      const bounds = L.featureGroup(
        [...markerItems.values()].map((item) => item.marker)
      ).getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [30, 30],
          maxZoom: 15
        });
      }

      showMessage(
        `Showing ${validBins.length} registered dustbin location(s).`
      );
    } else {
      showMessage("No registered dustbins with valid coordinates were found.");
    }
  } catch (error) {
    console.error("Could not load dustbin locations:", error);

    showMessage(
      "Could not load dustbins. Check your Supabase connection, bins table and permissions."
    );
  }

  setTimeout(() => map.invalidateSize(), 250);

  window.addEventListener("resize", () => {
    map.invalidateSize();
  });
});