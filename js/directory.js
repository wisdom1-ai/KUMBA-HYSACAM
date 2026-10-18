"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const directory = document.getElementById("binGrid");
  const searchInput = document.getElementById("directorySearch");
  const message = document.getElementById("directory-message");

  if (!directory || !searchInput) {
    console.error("Directory elements were not found in index.html.");
    return;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function setMessage(text) {
    if (message) message.textContent = text;
  }

  function getStatusClass(status) {
    const value = String(status || "").toLowerCase();

    if (value.includes("full") || value.includes("overflow")) {
      return "full";
    }

    if (
      value.includes("maintenance") ||
      value.includes("broken") ||
      value.includes("damage")
    ) {
      return "maintenance";
    }

    return "available";
  }

  let bins = [];

  function renderBins(searchTerm = "") {
    const query = searchTerm.trim().toLowerCase();

    const filteredBins = bins.filter(bin => {
      const name = String(bin.name || "").toLowerCase();
      const area = String(bin.area || "").toLowerCase();
      const status = String(bin.status || "").toLowerCase();

      return (
        name.includes(query) ||
        area.includes(query) ||
        status.includes(query)
      );
    });

    if (filteredBins.length === 0) {
      directory.innerHTML = `
        <p class="placeholder-note">
          ${
            bins.length === 0
              ? "No registered dustbins are available yet."
              : "No dustbins match your search. Try another name or area."
          }
        </p>
      `;

      setMessage("0 collection points found.");
      return;
    }

    directory.innerHTML = filteredBins.map(bin => {
      const name = escapeHTML(bin.name || "Unnamed collection point");
      const area = escapeHTML(bin.area || "Area not specified");
      const status = escapeHTML(bin.status || "Status unknown");
      const statusClass = getStatusClass(bin.status);

      return `
        <article class="service-card bin-card">
          <h3>${name}</h3>
          <p><strong>Area:</strong> ${area}</p>
          <p>
            <strong>Status:</strong>
            <span class="bin-status ${statusClass}">
              ${status}
            </span>
          </p>
          ${
            Number.isFinite(Number(bin.latitude)) &&
            Number.isFinite(Number(bin.longitude)) &&
            bin.latitude !== null &&
            bin.longitude !== null
              ? `<button
                  type="button"
                  class="bin-map-button"
                  data-lat="${escapeHTML(bin.latitude)}"
                  data-lng="${escapeHTML(bin.longitude)}"
                >View on map</button>`
              : ""
          }
        </article>
      `;
    }).join("");

    setMessage(
      `Showing ${filteredBins.length} of ${bins.length} collection point(s).`
    );
  }

  searchInput.addEventListener("input", () => {
    renderBins(searchInput.value);
  });

  // Clicking "View on map" takes the user to the map section.
  directory.addEventListener("click", event => {
    const button = event.target.closest(".bin-map-button");
    if (!button) return;

    const lat = Number(button.dataset.lat);
    const lng = Number(button.dataset.lng);

    const mapSection = document.getElementById("map");
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: "smooth" });
    }

    // Notify map.js if it exposes the map-view event.
    document.dispatchEvent(new CustomEvent("hysacam:show-bin", {
      detail: { latitude: lat, longitude: lng }
    }));
  });

  if (typeof supabaseClient === "undefined") {
    directory.innerHTML = `
      <p class="placeholder-note">
        The database connection is not available. Please check supabase.js.
      </p>
    `;
    setMessage("Database connection unavailable.");
    console.error("supabaseClient is not defined.");
    return;
  }

  directory.innerHTML = "<p>Loading dustbin locations...</p>";
  setMessage("");

  try {
    const { data, error } = await supabaseClient
      .from("bins")
      .select("id, name, area, latitude, longitude, status")
      .order("name", { ascending: true });

    if (error) throw error;

    bins = data || [];
    renderBins(searchInput.value);

  } catch (error) {
    console.error("Could not load the dustbin directory:", error);

    directory.innerHTML = `
      <p class="placeholder-note">
        Could not load dustbin locations. Please try again later.
      </p>
    `;

    setMessage("Database error. Check the browser console and Supabase permissions.");
  }
});