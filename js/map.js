"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.getElementById("dustbin-map");
  const mapMessage = document.getElementById("map-message");

  function showMessage(message) {
    if (mapMessage) mapMessage.textContent = message;
  }

  if (!mapElement) {
    console.error("Map container #dustbin-map was not found.");
    return;
  }

  if (!window.L) {
    showMessage("The map library did not load. Check your internet connection.");
    console.error("Leaflet is not available.");
    return;
  }

  if (typeof supabaseClient === "undefined") {
    showMessage("Database connection is not configured.");
    console.error("supabaseClient is unavailable.");
    return;
  }

  // Create the interactive map centred around Kumba.
  const map = L.map(mapElement).setView([4.636, 9.446], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

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

    return "#27ae60";
  }

  function createMarkerIcon(status) {
    const color = markerColor(status);

    return L.divIcon({
      className: "hysacam-marker",
      html: `<div style="
        width:30px;
        height:30px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${color};
        border:3px solid white;
        box-shadow:0 2px 6px #0004;
        display:flex;
        align-items:center;
        justify-content:center;
      "><span style="
        transform:rotate(45deg);
        color:white;
        font-size:15px;
      ">♻</span></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  }

  showMessage("Loading dustbin locations...");

  try {
    const { data, error } = await supabaseClient
      .from("bins")
      .select("id, name, area, latitude, longitude, status");

    if (error) throw error;

    markerLayer.clearLayers();

    const validBins = (data || []).filter(bin => {
      const lat = Number(bin.latitude);
      const lng = Number(bin.longitude);

      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    });

    validBins.forEach(bin => {
      const lat = Number(bin.latitude);
      const lng = Number(bin.longitude);
      const name = bin.name || "Unnamed collection point";
      const area = bin.area || "Not specified";
      const status = bin.status || "Available";

      L.marker([lat, lng], {
        icon: createMarkerIcon(status)
      })
        .bindPopup(`
          <div>
            <strong>${escapeHTML(name)}</strong>
            <p>Area: ${escapeHTML(area)}</p>
            <p>Status: ${escapeHTML(status)}</p>
          </div>
        `)
        .addTo(markerLayer);
    });

    if (validBins.length > 0) {
    const bounds = L.featureGroup(markerLayer.getLayers()).getBounds();

if (bounds.isValid()) {
  map.fitBounds(bounds, {
    padding: [30, 30],
    maxZoom: 15
  });
}
      showMessage(
        `Showing ${validBins.length} collection point(s) on the map.`
      );
    } else {
      showMessage(
        "No collection points with valid coordinates were found in the database."
      );
    }

    // Allow the map to calculate its size after the section is displayed.
    setTimeout(() => map.invalidateSize(), 250);

  } catch (error) {
    console.error("Could not load dustbin locations:", error);

    showMessage(
      "Could not load dustbins. Check your Supabase connection, table permissions, and browser console."
    );
  }
});