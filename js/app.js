(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const storage = {
    reports: "hysac_kumba_reports_v1",
    profile: "hysac_kumba_profile_v1"
  };

  let locations = [];
  let reports = read(storage.reports, []);
  let profile = read(storage.profile, {
    name: "",
    area: "",
    notifications: false
  });

  let mainMap = null;
  let miniMap = null;
  let mainMarkers = [];
  let miniMarkers = [];
  let toastTimeout;

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Browser storage error:", error);
      toast("Could not save data on this device.");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function toast(message) {
    const el = $("#toast");
    if (!el) {
      console.log(message);
      return;
    }

    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(
      () => el.classList.remove("show"),
      3500
    );
  }

  function statusClass(status) {
    return status === "Available"
      ? "status-available"
      : status === "Maintenance"
        ? "status-maintenance"
        : "status-attention";
  }

  function statusBadge(status) {
    return `<span class="status-badge ${statusClass(status)}">${escapeHTML(status)}</span>`;
  }

  function normalizeStatus(status) {
    const value = String(status || "").toLowerCase();

    if (value === "available") return "Available";
    if (value === "maintenance") return "Maintenance";

    return "Needs attention";
  }

  // ------------------------------
  // SUPABASE: LOAD BIN LOCATIONS
  // ------------------------------

  async function loadBins() {
    if (typeof supabaseClient === "undefined") {
      console.error("Supabase client is not available.");
      toast("Database connection is not initialized.");
      return;
    }

    const { data, error } = await supabaseClient
      .from("bins")
      .select("id, name, area, latitude, longitude, status, notes")
      .order("name");

    if (error) {
      console.error("Failed to load bins:", error);
      toast("Could not load bins from the database.");
      return;
    }

    locations = (data || []).map(bin => ({
      id: bin.id,
      name: bin.name,
      area: bin.area,
      lat: bin.latitude,
      lng: bin.longitude,
      status: normalizeStatus(bin.status),
      checked: bin.notes || "Database record"
    }));

    renderDirectory();
    updateStats();
    renderMainMarkers();
    renderMiniMarkers();

    console.log("Website bins loaded:", locations);
  }

  // ------------------------------
  // NAVIGATION
  // ------------------------------

  function setPage(name) {
    const valid = [
      "home", "map", "directory", "report",
      "reports", "profile", "help"
    ];

    if (!valid.includes(name)) name = "home";

    $$(".page").forEach(page => {
      page.classList.toggle("active", page.id === `page-${name}`);
    });

    $$("[data-page]").forEach(button => {
      button.classList.toggle("active", button.dataset.page === name);
    });

    const titles = {
      home: "Overview",
      map: "Community map",
      directory: "Dustbin directory",
      report: "Submit a report",
      reports: "My reports",
      profile: "My profile",
      help: "Help & support"
    };

    if ($("#page-crumb")) {
      $("#page-crumb").textContent = titles[name];
    }

    if (name === "map") {
      ensureMap("main");

      setTimeout(() => {
        if (mainMap) mainMap.invalidateSize();
      }, 120);

      renderMainMarkers();
    }

    if (name === "home") {
      ensureMap("mini");

      setTimeout(() => {
        if (miniMap) miniMap.invalidateSize();
      }, 120);
    }

    if (name === "directory") renderDirectory();
    if (name === "reports") renderReports();
    if (name === "profile") renderProfile();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ------------------------------
  // BIN DIRECTORY
  // ------------------------------

  function renderDirectory() {
    const body = $("#directory-body");
    if (!body) return;

    const query = ($("#directory-search")?.value || "")
      .trim()
      .toLowerCase();

    const status = $("#status-filter")?.value || "all";

    const found = locations.filter(location =>
      (status === "all" || location.status === status) &&
      `${location.name} ${location.area} ${location.status}`
        .toLowerCase()
        .includes(query)
    );

    body.innerHTML = found.length
      ? found.map(location => `
          <tr>
            <td>
              <strong>${escapeHTML(location.name)}</strong>
              <small>Bin record</small>
            </td>
            <td>${escapeHTML(location.area)}</td>
            <td>${statusBadge(location.status)}</td>
            <td>${escapeHTML(location.checked)}</td>
            <td>
              <button
                class="text-button locate-button"
                data-location="${escapeHTML(location.id)}">
                View on map ↗️
              </button>
            </td>
          </tr>
        `).join("")
      : `
          <tr>
            <td colspan="5">
              <div class="empty-state">
                <h3>No locations found</h3>
                <p>Try a different search or status filter.</p>
              </div>
            </td>
          </tr>
        `;

    if ($("#directory-result-count")) {
      $("#directory-result-count").textContent =
        `${found.length} location${found.length === 1 ? "" : "s"}`;
    }

    $$(".locate-button").forEach(button => {
      button.addEventListener("click", () => {
        const location = locations.find(
          item => String(item.id) === button.dataset.location
        );

        if (!location || !validCoordinates(location)) {
          toast("This bin has no valid map coordinates.");
          return;
        }

        setPage("map");

        setTimeout(() => {
          if (mainMap) {
            mainMap.setView([location.lat, location.lng], 16);
          }
        }, 200);
      });
    });
  }

  // ------------------------------
  // MAPS
  // ------------------------------

  function ensureMap(which) {
    if (!window.L) {
      console.warn("Leaflet is not loaded.");
      return;
    }

    if (which === "main" && !mainMap && $("#main-map")) {
      mainMap = L.map("main-map", {
        zoomControl: true
      }).setView([4.638, 9.445], 14);

      addTileLayer(mainMap);
    }

    if (which === "mini" && !miniMap && $("#mini-map")) {
      miniMap = L.map("mini-map", {
        zoomControl: false,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false
      }).setView([4.638, 9.445], 13);

      addTileLayer(miniMap);
    }

    if (which === "main") renderMainMarkers();
    else renderMiniMarkers();
  }

  function addTileLayer(map) {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
  }

  function markerColor(status) {
    return status === "Available"
      ? "#258552"
      : status === "Maintenance"
        ? "#3477b9"
        : "#d8942d";
  }

  function markerIcon(status) {
    return L.divIcon({
      className: "custom-map-pin",
      html: `
        <div style="
          background:${markerColor(status)};
          width:15px;
          height:15px;
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 7px #173b2b55">
        </div>`,
      iconSize: [15, 15],
      iconAnchor: [7, 7]
    });
  }

  function popup(location) {
    return `
      <strong>${escapeHTML(location.name)}</strong><br>
      ${escapeHTML(location.area)}
      <div class="map-popup-status">
        ${statusBadge(location.status)}
      </div>
      <small>Status has not been independently verified.</small>
    `;
  }

  function validCoordinates(location) {
    return Number.isFinite(location.lat) &&
      Number.isFinite(location.lng) &&
      location.lat >= -90 && location.lat <= 90 &&
      location.lng >= -180 && location.lng <= 180;
  }

  function renderMainMarkers() {
    if (!mainMap || !window.L) return;

    mainMarkers.forEach(marker => marker.remove());
    mainMarkers = [];

    const filter = $("#map-filter")?.value || "all";

    locations
      .filter(location =>
        (filter === "all" || location.status === filter) &&
        validCoordinates(location)
      )
      .forEach(location => {
        const marker = L.marker(
          [location.lat, location.lng],
          { icon: markerIcon(location.status) }
        )
          .addTo(mainMap)
          .bindPopup(popup(location));

        mainMarkers.push(marker);
      });
  }

  function renderMiniMarkers() {
    if (!miniMap || !window.L) return;

    miniMarkers.forEach(marker => marker.remove());
    miniMarkers = [];

    locations
      .filter(validCoordinates)
      .slice(0, 8)
      .forEach(location => {
        const marker = L.marker(
          [location.lat, location.lng],
          { icon: markerIcon(location.status) }
        )
          .addTo(miniMap)
          .bindPopup(popup(location));

        miniMarkers.push(marker);
      });
  }

  // ------------------------------
  // DASHBOARD STATISTICS
  // ------------------------------

  function updateStats() {
    if ($("#stat-bins")) {
      $("#stat-bins").textContent = locations.length;
    }

    if ($("#stat-attention")) {
      $("#stat-attention").textContent =
        locations.filter(location =>
          location.status !== "Available"
        ).length;
    }

    if ($("#stat-reports")) {
      $("#stat-reports").textContent = reports.length;
    }

    if ($("#report-count")) {
      $("#report-count").textContent = reports.length;
    }
  }

  // ------------------------------
  // REPORT HISTORY
  // ------------------------------

  function renderReports() {
    const subtitle = $("#reports-subtitle");
    const host = $("#reports-list");

    if (!host) return;

    if (subtitle) {
      subtitle.textContent =
        `${reports.length} locally saved report${reports.length === 1 ? "" : "s"}.`;
    }

    if (!reports.length) {
      host.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">☷</div>
          <h3>No reports yet</h3>
          <p>Submit a report to see it in your history.</p>
          <button class="button primary" data-go="report">
            Submit your first report
          </button>
        </div>`;

      host.querySelector("[data-go]")?.addEventListener(
        "click",
        () => setPage("report")
      );

      return;
    }

    host.innerHTML = [...reports].reverse().map(report => `
      <article class="report-record">
        <div class="record-icon">＋</div>
        <div class="record-body">
          <h4>${escapeHTML(report.type)}</h4>
          <p>${escapeHTML(report.location)} · ${escapeHTML(report.area)}</p>
          ${report.details
            ? `<p>${escapeHTML(report.details)}</p>`
            : ""}
          <div class="record-meta">
            ${escapeHTML(report.date)} · Saved on this device
          </div>
        </div>
        <div class="record-id">${escapeHTML(report.id)}</div>
      </article>
    `).join("");
  }

  // ------------------------------
  // PROFILE
  // ------------------------------

  function renderProfile() {
    if ($("#profile-name")) {
      $("#profile-name").value = profile.name || "";
    }

    if ($("#profile-area")) {
      $("#profile-area").value = profile.area || "";
    }

    if ($("#profile-notifications")) {
      $("#profile-notifications").checked = !!profile.notifications;
    }

    if ($("#profile-display-name")) {
      $("#profile-display-name").textContent =
        profile.name || "Community member";
    }

    const initial =
      (profile.name || "W").trim().charAt(0).toUpperCase() || "W";

    if ($("#profile-avatar")) $("#profile-avatar").textContent = initial;
    if ($("#top-avatar")) $("#top-avatar").textContent = initial;
  }

  // ------------------------------
  // CSV EXPORT
  // ------------------------------

  function exportCSV() {
    if (!reports.length) {
      toast("There are no reports to export yet.");
      return;
    }

    const rows = [
      ["Reference", "Issue type", "Location", "Area", "Details", "Date"],
      ...reports.map(report => [
        report.id,
        report.type,
        report.location,
        report.area,
        report.details,
        report.date
      ])
    ];

    const csv = rows.map(row =>
      row.map(value =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      ).join(",")
    ).join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "hysacam-kumba-my-reports.csv";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Your report history was exported.");
  }

  // ------------------------------
  // GPS LOCATION
  // ------------------------------

  $("#get-current-location")?.addEventListener("click", () => {
    const status = $("#location-status");
    const latInput = $("#report-latitude");
    const lngInput = $("#report-longitude");

    if (!latInput || !lngInput) {
      console.error("GPS latitude/longitude inputs are missing.");
      if (status) status.textContent = "GPS fields are missing from the page.";
      return;
    }

    if (!navigator.geolocation) {
      if (status) status.textContent = "GPS is not supported by this browser.";
      return;
    }

    if (status) status.textContent = "Getting your location...";

    navigator.geolocation.getCurrentPosition(
      position => {
        latInput.value = position.coords.latitude;
        lngInput.value = position.coords.longitude;

        if (status) status.textContent = "Location captured successfully.";

        console.log("GPS coordinates captured.");
        toast("GPS location captured.");
      },
      error => {
        console.error("GPS error:", error.code, error.message);

        if (status) {
          status.textContent =
            "Location unavailable. Check permissions and try again.";
        }

        toast("Could not get GPS location. You can submit without it.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });

  // ------------------------------
  // SUPABASE REPORT SUBMISSION
  // ------------------------------

  $("#report-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    console.log("REPORT FORM HANDLER RUNNING");

    const form = $("#report-form");
    const submitButton = form.querySelector('[type="submit"]');

    const reporterName = $("#reporter-name")?.value.trim() || "";
    const reporterEmail = $("#reporter-email")?.value.trim() || "";
    const reporterPhone = $("#reporter-phone")?.value.trim() || "";
    const type = $("#issue-type")?.value.trim() || "";
    const location = $("#issue-location")?.value.trim() || "";
    const area = $("#issue-area")?.value.trim() || "";
    const details = $("#issue-details")?.value.trim() || "";

    const latitudeValue = $("#report-latitude")?.value ?? "";
    const longitudeValue = $("#report-longitude")?.value ?? "";

    const latitude = latitudeValue === "" ? null : Number(latitudeValue);
    const longitude = longitudeValue === "" ? null : Number(longitudeValue);

    if (
      !reporterName ||
      !reporterEmail ||
      !type ||
      !location ||
      !area ||
      !details
    ) {
      toast("Please complete all required fields.");
      return;
    }

    if (
      reporterName.length < 2 ||
      reporterName.length > 100 ||
      reporterEmail.length > 254 ||
      type.length < 3 ||
      type.length > 100 ||
      location.length > 150 ||
      area.length > 100 ||
      details.length < 3 ||
      details.length > 800
    ) {
      toast("Please check your entries and their lengths.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
      toast("Please enter a valid email address.");
      return;
    }

    if (
      (latitude !== null && !Number.isFinite(latitude)) ||
      (longitude !== null && !Number.isFinite(longitude)) ||
      ((latitude === null) !== (longitude === null)) ||
      (latitude !== null &&
        (latitude < -90 || latitude > 90 ||
         longitude < -180 || longitude > 180))
    ) {
      toast("GPS coordinates are invalid. Capture your location again.");
      return;
    }

    if (typeof supabaseClient === "undefined") {
      console.error("Report submission stopped: supabaseClient is undefined.");
      toast("Database connection is not initialized.");
      return;
    }

    const now = new Date();

    const reference = "HKT-" +
      now.getFullYear().toString().slice(-2) +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    const databaseReport = {
      reference_code: reference,
      reporter_name: reporterName,
      reporter_email: reporterEmail,
      reporter_phone: reporterPhone || null,
      title: type,
      location_description: location,
      area,
      description: details,
      latitude,
      longitude,
      status: "submitted"
    };

    if (submitButton) submitButton.disabled = true;

    console.log("Sending report to Supabase.");

    try {
      const { error } = await supabaseClient
        .from("reports")
        .insert(databaseReport);

      if (error) {
        // Show the exact database error in the developer console.
        console.error("SUPABASE REPORT INSERT FAILED:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });

        toast("Report not saved to the database. Check the Console.");
        return;
      }

      console.log("SUPABASE REPORT INSERT SUCCEEDED:", reference);

      const localReport = {
        id: reference,
        type,
        location,
        area,
        details,
        date: now.toLocaleString(),
        status: "submitted"
      };

      const previousReports = [...reports];
      reports.push(localReport);

      if (!write(storage.reports, reports)) {
        reports = previousReports;
      }

      form.reset();

      if ($("#location-status")) {
        $("#location-status").textContent = "";
      }

      updateStats();
      renderReports();

      toast(`Report submitted successfully! Reference: ${reference}`);
      setPage("reports");
    } catch (error) {
      console.error("UNEXPECTED REPORT SUBMISSION ERROR:", error);
      toast("Submission failed. Check the Console for details.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // ------------------------------
  // SAVE PROFILE
  // ------------------------------

  $("#profile-form")?.addEventListener("submit", event => {
    event.preventDefault();

    const nextProfile = {
      name: $("#profile-name").value.trim(),
      area: $("#profile-area").value,
      notifications: $("#profile-notifications").checked
    };

    if (!write(storage.profile, nextProfile)) return;

    profile = nextProfile;
    renderProfile();
    toast("Profile saved on this device.");
  });

  // ------------------------------
  // NAVIGATION AND BUTTONS
  // ------------------------------

  $$("[data-page]").forEach(button => {
    button.addEventListener("click", () => setPage(button.dataset.page));
  });

  $$("[data-go]").forEach(button => {
    button.addEventListener("click", () => setPage(button.dataset.go));
  });

  $("#top-avatar")?.addEventListener("click", () => setPage("profile"));
  $("#directory-search")?.addEventListener("input", renderDirectory);
  $("#status-filter")?.addEventListener("change", renderDirectory);
  $("#map-filter")?.addEventListener("change", renderMainMarkers);

  $("#map-fit")?.addEventListener("click", () => {
    if (!mainMap || !mainMarkers.length) {
      toast("No mapped bins are available.");
      return;
    }

    const group = L.featureGroup(mainMarkers);
    mainMap.fitBounds(group.getBounds().pad(0.15));
  });

  $("#export-reports")?.addEventListener("click", exportCSV);

  $("#clear-local-data")?.addEventListener("click", () => {
    if (!confirm(
      "Clear locally saved reports and profile settings on this browser? " +
      "This will NOT delete reports stored in Supabase."
    )) return;

    const oldReports = reports;
    const oldProfile = profile;

    reports = [];
    profile = { name: "", area: "", notifications: false };

    try {
      localStorage.removeItem(storage.reports);
      localStorage.removeItem(storage.profile);
    } catch (error) {
      reports = oldReports;
      profile = oldProfile;
      console.error("Could not clear local storage:", error);
      toast("Could not clear browser storage.");
      return;
    }

    updateStats();
    renderProfile();
    renderReports();
    toast("Local browser data cleared.");
  });

  window.addEventListener("resize", () => {
    if (mainMap) mainMap.invalidateSize();
    if (miniMap) miniMap.invalidateSize();
  });

  // ------------------------------
  // START THE WEBSITE
  // ------------------------------

  renderDirectory();
  updateStats();
  renderProfile();
  renderReports();
  ensureMap("mini");
  loadBins();

  console.log("HYSACAM Kumba Tracker initialized.");
})();