"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const directory = document.getElementById("binGrid");
  const searchInput = document.getElementById("directorySearch");
  const message = document.getElementById("directory-message");

  if (!directory || !searchInput) {
    console.error("Dustbin directory elements are missing.");
    return;
  }

  let bins = [];

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);

  function setMessage(text) {
    if (message) message.textContent = text;
  }

  function shortId(id) {
    const value = String(id ?? "");
    return value.length > 12 ? `${value.slice(0, 8)}…` : value || "ID unavailable";
  }

  function getStatus(status) {
    const value = String(status || "").toLowerCase();

    if (value.includes("full") || value.includes("overflow")) {
      return { label: status || "Full", className: "full" };
    }

    if (
      value.includes("maintenance") ||
      value.includes("broken") ||
      value.includes("damage")
    ) {
      return { label: status || "Maintenance", className: "maintenance" };
    }

    if (value.includes("pending") || value.includes("collect")) {
      return { label: status || "Pending collection", className: "pending" };
    }

    return { label: status || "Available", className: "available" };
  }

  function validCoordinates(bin) {
    const lat = Number(bin.latitude);
    const lng = Number(bin.longitude);

    return (
      bin.latitude !== null &&
      bin.latitude !== "" &&
      bin.longitude !== null &&
      bin.longitude !== "" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  function renderBins() {
    const query = searchInput.value.trim().toLowerCase();

    const filteredBins = bins.filter((bin) => {
      const searchable = [
        bin.id,
        bin.name,
        bin.area,
        bin.status
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });

    if (filteredBins.length === 0) {
      directory.innerHTML = `
        <div class="directory-empty">
          <span class="directory-empty-icon" aria-hidden="true">⌕</span>
          <h3>${bins.length ? "No matching locations" : "No dustbins registered yet"}</h3>
          <p>${
            bins.length
              ? "Try another dustbin ID, name or area"
              : "Registered collection points will appear here when available"
          }</p>
          ${
            query
              ? '<button type="button" id="directory-clear-search">Clear search</button>'
              : ""
          }
        </div>
      `;

      setMessage("0 collection points found.");

      document.getElementById("directory-clear-search")?.addEventListener(
        "click",
        () => {
          searchInput.value = "";
          renderBins();
          searchInput.focus();
        }
      );

      return;
    }

    directory.innerHTML = `
      <div class="directory-results-heading">
        <span>Collection points</span>
        <span class="directory-results-count">${filteredBins.length} found</span>
      </div>

      <div class="directory-list">
        ${filteredBins.map((bin) => {
          const name = escapeHTML(bin.name || "Unnamed collection point");
          const area = escapeHTML(bin.area || "Area not specified");
          const id = escapeHTML(bin.id || "ID unavailable");
          const status = getStatus(bin.status);
          const coordinatesValid = validCoordinates(bin);

          const coordinates = coordinatesValid
            ? `${Number(bin.latitude).toFixed(4)}, ${Number(bin.longitude).toFixed(4)}`
            : "Coordinates unavailable";

          return `
            <article class="directory-card">
              <div class="directory-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="25" height="25"
                  fill="none" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/>
                  <circle cx="12" cy="10" r="2.5"/>
                </svg>
              </div>

              <div class="directory-card-content">
                <div class="directory-card-title-row">
                  <h3 title="${name}">${name}</h3>
                  <span class="directory-id"
                    title="Full ID: ${id}"
                    aria-label="Dustbin ID ${id}">${escapeHTML(shortId(bin.id))}</span>
                </div>

                <p class="directory-area">${area}</p>

                <p class="directory-coordinates">
                  <span aria-hidden="true">⌖</span>
                  ${coordinates}
                </p>

                <div class="directory-card-bottom">
                  <span class="directory-status ${status.className}">
                    <span class="status-dot"></span>
                    ${escapeHTML(status.label)}
                  </span>

                  ${
                    coordinatesValid
                      ? `<button
                          type="button"
                          class="directory-view-button"
                          data-lat="${Number(bin.latitude)}"
                          data-lng="${Number(bin.longitude)}"
                          data-bin-id="${id}"
                        >View <span aria-hidden="true">→</span></button>`
                      : `<button type="button" class="directory-view-button" disabled>
                          No map location
                        </button>`
                  }
                </div>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;

    setMessage(
      `Showing ${filteredBins.length} of ${bins.length} registered collection point(s).`
    );
  }

  searchInput.addEventListener("input", renderBins);

  directory.addEventListener("click", (event) => {
    const button = event.target.closest(".directory-view-button");

    if (!button || button.disabled) return;

    const latitude = Number(button.dataset.lat);
    const longitude = Number(button.dataset.lng);
    const binId = button.dataset.binId;

    const mapSection = document.getElementById("map");

    if (mapSection) {
      mapSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    document.dispatchEvent(new CustomEvent("hysacam:show-bin", {
      detail: {
        latitude,
        longitude,
        binId
      }
    }));
  });

  if (typeof supabaseClient === "undefined") {
    directory.innerHTML = `
      <div class="directory-empty">
        <h3>Database connection unavailable</h3>
        <p>Check your Supabase configuration and try again</p>
      </div>
    `;

    setMessage("Could not connect to the database.");
    console.error("supabaseClient is not defined.");
    return;
  }

  async function loadBins() {
    directory.innerHTML = `
      <div class="directory-loading">
        <span class="directory-spinner" aria-hidden="true"></span>
        <p>Loading registered collection points...</p>
      </div>
    `;

    setMessage("");

    try {
      const { data, error } = await supabaseClient
        .from("bins")
        .select("id, name, area, latitude, longitude, status")
        .order("name", { ascending: true });

      if (error) throw error;

      bins = data || [];
      renderBins();
    } catch (error) {
      console.error("Could not load the dustbin directory:", error);

      directory.innerHTML = `
        <div class="directory-empty directory-error">
          <h3>Unable to load locations</h3>
          <p>Please check your connection and try again</p>
          <button type="button" id="directory-retry">Try again</button>
        </div>
      `;

      setMessage("Could not retrieve collection points.");
    }
  }

  directory.addEventListener("click", (event) => {
    if (event.target.closest("#directory-retry")) {
      loadBins();
    }
  });

  await loadBins();
});