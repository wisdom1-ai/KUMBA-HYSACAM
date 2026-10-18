(function hysacamMapController() {
"use strict";

/*
 * HYSACAM KUMBA TRACKER
 * Map controller using Leaflet.
 *
 * Features:
 * - Interactive map
 * - Dustbin markers
 * - Search for dustbins
 * - Show all dustbins
 * - Reset map
 * - Connects with app.js using custom events
 */

const getDustbins = () => window.HysacamDB?.getDustbins() || [];

let map = null;
let markersLayer = null;
let allDustbins = [];
let mapInitialized = false;

const DEFAULT_CENTER = [4.636, 9.446];
const DEFAULT_ZOOM = 13;

const $ = (selector) => document.querySelector(selector);

function setText(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function getCoordinates(bin) {
  const lat = Number(
    bin.latitude ?? bin.lat ?? bin.coordinates?.lat
  );

  const lng = Number(
    bin.longitude ??
    bin.lng ??
    bin.lon ??
    bin.coordinates?.lng ??
    bin.coordinates?.lon
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return [lat, lng];
}

function getBinName(bin, index) {
  return (
    bin.name ||
    bin.binName ||
    bin.location ||
    `Dustbin ${index + 1}`
  );
}

function getBinStatus(bin) {
  const status = String(
    bin.status || bin.condition || "Available"
  ).toLowerCase();

  if (
    status.includes("full") ||
    status.includes("overflow")
  ) {
    return "Full";
  }

  if (
    status.includes("damaged") ||
    status.includes("broken") ||
    status.includes("maintenance")
  ) {
    return "Needs repair";
  }

  if (
    status.includes("collect") ||
    status.includes("pending")
  ) {
    return "Collection needed";
  }

  return "Available";
}

function getStatusColor(status) {
  if (status === "Full") return "#e74c3c";
  if (status === "Needs repair") return "#8e44ad";
  if (status === "Collection needed") return "#f39c12";
  return "#27ae60";
}

function createBinIcon(status) {
  const color = getStatusColor(status);

  return L.divIcon({
    className: "hysacam-map-marker-wrapper",
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 50% 50% 50% 0;
        background: ${color};
        border: 3px solid #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,.3);
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 16px;
          font-weight: bold;
        ">♻</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34]
  });
}

function ensureMap() {
  const mapElement = $("#map");

  if (!mapElement) {
    console.warn(
      "Map element #map was not found in index.html."
    );
    return false;
  }

  if (mapInitialized && map) {
    return true;
  }

  if (!window.L || typeof window.L.map !== "function") {
    setText("#mapStatus", "Map library could not load.");
    setText(
      "#mapMessage",
      "Connect this computer to the internet, then reload the page. The interactive map requires Leaflet and online map tiles."
    );
    return false;
  }

  map = L.map(mapElement, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  const tiles = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  );

  tiles.on("tileerror", () => {
    setText("#mapStatus", "Map tiles are not loading.");
    setText(
      "#mapMessage",
      "Check your internet connection or allow access to OpenStreetMap tiles. Collection records remain saved on this device."
    );
  });

  tiles.addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  mapInitialized = true;

  window.setTimeout(() => {
    map?.invalidateSize();
  }, 200);

  return true;
}

function buildPopup(bin, index) {
  const name = getBinName(bin, index);
  const status = getBinStatus(bin);
  const area =
    bin.area || bin.neighborhood || bin.location || "Not specified";
  const color = getStatusColor(status);

  return `
    <div style="min-width: 190px; font-family: Arial, sans-serif;">
      <h3 style="margin: 0 0 8px; font-size: 16px;">
        ${escapeHTML(name)}
      </h3>

      <p style="margin: 4px 0;">
        <strong>Area:</strong> ${escapeHTML(area)}
      </p>

      <p style="margin: 4px 0;">
        <strong>Status:</strong>
        <span style="color: ${color}; font-weight: bold;">
          ${escapeHTML(status)}
        </span>
      </p>

      ${
        bin.description
          ? `<p style="margin: 6px 0;">${escapeHTML(bin.description)}</p>`
          : ""
      }
    </div>
  `;
}

function updateMapCount(count) {
  setText(
    "#mapResultCount",
    `${count} dustbin${count === 1 ? "" : "s"} found`
  );

  setText("#mapStatus", `${count} dustbin locations displayed`);
}

function renderDustbins(dustbins = allDustbins) {
  if (!ensureMap()) return;

  markersLayer.clearLayers();

  const validLocations = [];

  dustbins.forEach((bin, index) => {
    const coordinates = getCoordinates(bin);

    if (!coordinates) {
      console.warn(
        "Skipping dustbin with invalid coordinates:",
        bin
      );
      return;
    }

    const name = getBinName(bin, index);
    const status = getBinStatus(bin);

    const marker = L.marker(coordinates, {
      icon: createBinIcon(status),
      title: name,
      alt: name
    });

    marker.bindPopup(buildPopup(bin, index));

    marker.on("click", () => {
      window.dispatchEvent(
        new CustomEvent("hysacam:bin-selected", {
          detail: { bin }
        })
      );
    });

    marker.addTo(markersLayer);
    validLocations.push(coordinates);
  });

  updateMapCount(validLocations.length);

  if (validLocations.length === 1) {
    map.setView(validLocations[0], 16);
  } else if (validLocations.length > 1) {
    map.fitBounds(validLocations, {
      padding: [35, 35],
      maxZoom: 15
    });
  }

  if (validLocations.length === 0) {
    setText(
      "#mapMessage",
      "No saved collection points have valid coordinates yet. Use Dustbin Directory → Add Collection Point to add a verified location. The map is centered on Kumba, Cameroon."
    );
  } else {
    setText("#mapMessage", "");
  }

  window.setTimeout(() => map?.invalidateSize(), 150);
}

async function loadDustbinsOnMap() {
  if (!ensureMap()) return;

  setText("#mapStatus", "Loading dustbin locations...");

  try {
    const result = await getDustbins();

    allDustbins = Array.isArray(result) ? result : [];

    renderDustbins(allDustbins);
  } catch (error) {
    console.error("Could not load dustbins:", error);

    setText(
      "#mapStatus",
      "Could not load dustbins. Check database.js."
    );

    setText(
      "#mapMessage",
      "The map loaded, but the dustbin data could not be loaded."
    );
  }
}

function searchDustbins(query) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();

  if (!normalizedQuery) {
    renderDustbins(allDustbins);
    return;
  }

  const filtered = allDustbins.filter((bin) => {
    const searchable = [
      bin.name,
      bin.binName,
      bin.area,
      bin.location,
      bin.neighborhood,
      bin.status,
      bin.condition,
      bin.description,
      bin.id
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  });

  renderDustbins(filtered);

  if (filtered.length === 0) {
    setText(
      "#mapMessage",
      `No dustbins matched "${query}". Try another name or area.`
    );
  }
}

function resetMap() {
  if (!ensureMap()) return;

  const search = $("#mapSearch");
  if (search) search.value = "";

  renderDustbins(allDustbins);

  if (!allDustbins.length) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }
}

function focusBin(bin) {
  if (!ensureMap() || !bin) return;

  const coordinates = getCoordinates(bin);
  if (!coordinates) return;

  map.setView(coordinates, 17);

  markersLayer.eachLayer((marker) => {
    const position = marker.getLatLng();

    if (
      Math.abs(position.lat - coordinates[0]) < 0.000001 &&
      Math.abs(position.lng - coordinates[1]) < 0.000001
    ) {
      marker.openPopup();
    }
  });
}

function initializeMapControls() {
  const search = $("#mapSearch");

  search?.addEventListener("input", () => {
    searchDustbins(search.value);
  });

  $("#resetMapButton")?.addEventListener("click", (event) => {
    event.preventDefault();
    resetMap();
  });

  $("#showAllBinsButton")?.addEventListener("click", (event) => {
    event.preventDefault();

    const input = $("#mapSearch");
    if (input) input.value = "";

    renderDustbins(allDustbins);
  });

  window.addEventListener("hysacam:map-search", (event) => {
    searchDustbins(event.detail?.query || "");
  });

  window.addEventListener("hysacam:map-reset", resetMap);

  window.addEventListener("hysacam:map-request", async () => {
    addMapStyles();

    if (!map && !ensureMap()) return;

    await loadDustbinsOnMap();

    window.setTimeout(() => {
      if (map) {
        map.invalidateSize(true);
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        renderDustbins(allDustbins);
      }
    }, 250);
  });

  window.addEventListener("hysacam:focus-bin", (event) => {
    const requested = event.detail?.bin || event.detail;

    if (requested) {
      focusBin(requested);
      return;
    }

    const id = event.detail?.id;

    if (id != null) {
      const bin = allDustbins.find(
        (item) => String(item.id) === String(id)
      );

      if (bin) focusBin(bin);
    }
  });

  window.addEventListener("hysacam:dustbins-changed", async () => {
    await loadDustbinsOnMap();
  });

  window.addEventListener("hysacam:reports-cleared", () => {
    console.info("Report history cleared.");
  });
}

function addMapStyles() {
  if ($("#hysacamMapStyles")) return;

  const style = document.createElement("style");
  style.id = "hysacamMapStyles";

  style.textContent = `
    #map {
      width: 100%;
      min-height: 360px;
      height: 100%;
      border-radius: 12px;
      z-index: 1;
      background: #e8ecef;
    }

    .hysacam-map-marker-wrapper {
      background: transparent;
      border: none;
    }

    .leaflet-popup-content {
      line-height: 1.5;
    }

    @media (max-width: 600px) {
      #map {
        min-height: 320px;
      }
    }
  `;

  document.head.appendChild(style);
}

function initialize() {
  addMapStyles();
  initializeMapControls();

  if (ensureMap()) {
    loadDustbinsOnMap();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, {
    once: true
  });
} else {
  initialize();
}
})();