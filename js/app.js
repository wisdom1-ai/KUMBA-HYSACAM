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
    } catch {
      toast("Could not save: browser storage may be disabled.");
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
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(
      () => el.classList.remove("show"),
      2800
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

  // Load real bin records from Supabase.
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
      console.error("Failed to load bins:", error.message);
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

        if (!location || !Number.isFinite(location.lat) ||
            !Number.isFinite(location.lng)) {
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

  function ensureMap(which) {
    if (!window.L) return;

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
      <small>Database record. Status has not been independently verified.</small>
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
          <p>When you submit a report, it will appear here.</p>
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

  // Navigation and directory controls.
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

  // GPS: requires the user to grant location permission.
  $("#get-current-location")?.addEventListener("click", () => {
    const status = $("#location-status");

    if (!navigator.geolocation) {
      if (status) {
        status.textContent = "GPS is not supported by this browser.";
      }
      return;
    }

    if (status) status.textContent = "Getting your location...";

    navigator.geolocation.getCurrentPosition(
      position => {
        const latInput = $("#report-latitude");
        const lngInput = $("#report-longitude");

        if (!latInput || !lngInput) {
          if (status) {
            status.textContent = "GPS input fields are missing from the page.";
          }
          return;
        }

        latInput.value = position.coords.latitude;
        lngInput.value = position.coords.longitude;

        if (status) {
          status.textContent = "Location captured successfully.";
        }

        toast("GPS location captured.");
      },
      error => {
        console.error("GPS error:", error.message);

        if (status) {
          status.textContent =
            "Location unavailable. Check permission and try again.";
        }

        toast("Could not get your location. You can submit without GPS.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });

  // Submit the report to Supabase.
  $("#report-form")?.addEventListener("submit", async event => {
    event.preventDefault();

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

    const latitude = latitudeValue === ""
      ? null
      : Number(latitudeValue);

    const longitude = longitudeValue === ""
      ? null
      : Number(longitudeValue);

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

    // Browser validation usually checks email format too.
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(reporterEmail)) {
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
      toast("The GPS coordinates are invalid. Capture your location again.");
      return;
    }

    if (typeof supabaseClient === "undefined") {
      toast("Database connection is unavailable. Please try again.");
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
      area: area,
      description: details,
      latitude: latitude,
      longitude: longitude,
      status: "submitted"
    };

    if (submitButton) submitButton.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("reports")
        .insert(databaseReport);

      if (error) {
        console.error("Supabase report submission failed:", error);
        toast("Report could not be submitted. Please check the database setup.");
        return;
      }

      // Preserve the existing local report history.
      const localReport = {
        id: reference,
        type,
        location,
        area,
        details,
        date: now.toLocaleString(),
        status: "submitted"
      };

      reports.push(localReport);

      if (!write(storage.reports, reports)) {
        reports.pop();
        toast("Report reached the database, but local history could not be saved.");
      }

      form.reset();

      if ($("#location-status")) {
        $("#location-status").textContent = "";
      }

      updateStats();
      renderReports();

      toast("Report submitted successfully!");
      setPage("reports");
    } catch (error) {
      console.error("Unexpected report submission error:", error);
      toast("Something went wrong. Check your connection and try again.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // Save the existing profile locally.
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

  $("#export-reports")?.addEventListener("click", exportCSV);

  $("#clear-local-data")?.addEventListener("click", () => {
    if (!confirm(
      "Clear locally saved reports and profile settings on this browser? This will not delete reports from Supabase."
    )) return;

    reports = [];
    profile = { name: "", area: "", notifications: false };

    try {
      localStorage.removeItem(storage.reports);
      localStorage.removeItem(storage.profile);
    } catch {
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

  // Initial page setup.
  renderDirectory();
  updateStats();
  renderProfile();
  ensureMap("mini");
  loadBins();
})();