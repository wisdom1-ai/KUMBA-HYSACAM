
import * as L from "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/+esm";
import { getDustbins } from "./database.js";

let map;
let markers;

const statuses = ["available", "full", "damaged", "unknown"];

function showMessage(message) {
  let box = document.getElementById("map-message");

  if (!box) {
    box = document.createElement("p");
    box.id = "map-message";
    box.setAttribute("role", "status");

    const container = document.getElementById("map");
    if (container) container.prepend(box);
  }

  if (box) box.textContent = message;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function initializeMap() {
  const container = document.getElementById("map");

  if (!container) {
    throw new Error('Map container "#map" was not found.');
  }

  if (map) {
    map.invalidateSize();
    return;
  }

  map = L.map(container).setView([4.6365, 9.4469], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(map);

  markers = L.layerGroup().addTo(map);
}

export function renderDustbins(dustbins) {
  if (!map || !markers) {
    throw new Error("Open the map before displaying dustbins.");
  }

  if (!Array.isArray(dustbins)) {
    throw new Error("Dustbin data must be an array.");
  }

  markers.clearLayers();

  const validBins = dustbins.filter(bin =>
    bin &&
    bin.id &&
    Number.isFinite(Number(bin.latitude)) &&
    Number.isFinite(Number(bin.longitude)) &&
    Number(bin.latitude) >= -90 &&
    Number(bin.latitude) <= 90 &&
    Number(bin.longitude) >= -180 &&
    Number(bin.longitude) <= 180
  );

  if (!validBins.length) {
    showMessage(
      dustbins.length
        ? "No valid dustbin locations were found."
        : "No dustbins have been added yet."
    );
    return;
  }

  validBins.forEach(bin => {
    const status = statuses.includes(bin.status)
      ? bin.status
      : "unknown";

    const popup = `
      <strong>${escapeHTML(bin.name || bin.id)}</strong><br>
      Status: ${escapeHTML(status)}<br>
      Area: ${escapeHTML(bin.area || "Unknown")}<br>
      Address: ${escapeHTML(bin.address || "Not provided")}<br>
      Updated: ${escapeHTML(bin.lastUpdated || "Not available")}
    `;

    L.marker([Number(bin.latitude), Number(bin.longitude)])
      .addTo(markers)
      .bindPopup(popup);
  });

  map.fitBounds(
    L.latLngBounds(
      validBins.map(bin => [
        Number(bin.latitude),
        Number(bin.longitude)
      ])
    ),
    { padding: [25, 25], maxZoom: 16 }
  );

  showMessage(`${validBins.length} dustbin location(s) displayed.`);
}

export async function loadDustbinsOnMap() {
  try {
    initializeMap();
    showMessage("Loading dustbin locations...");

    const dustbins = await getDustbins();
    renderDustbins(dustbins);
  } catch (error) {
    console.error("Failed to load dustbins:", error);
    showMessage(
      "Could not load dustbins. The database may not be connected yet."
    );
  }
}
