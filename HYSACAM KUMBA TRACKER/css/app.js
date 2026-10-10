"use strict";

/*
 * HYSACAM KUMBA TRACKER
 * Frontend demonstration edition.
 *
 * IMPORTANT:
 * - Sample bins are illustrative, not verified service locations.
 * - Reports are stored in this browser only.
 * - No reports are sent to HYSACAM from this frontend.
 * - Connect a secure backend before using real public submissions.
 */

const SUPPORT_EMAIL = "kelechiwisdom19950@gmail.com";
const REPORTS_KEY = "hysacam_tracker_reports_v4";
const PROFILE_KEY = "hysacam_tracker_profile_v4";
const THEME_KEY = "hysacam_tracker_theme_v4";
const NOTICE_KEY = "hysacam_tracker_notice_v4";

const $ = (id) => document.getElementById(id);

const sampleBins = [
  { id: 1, name: "COMMUNITY BIN 01", area: "SAMPLE AREA 01", status: "available", lat: 4.6360, lng: 9.4460 },
  { id: 2, name: "COMMUNITY BIN 02", area: "SAMPLE AREA 02", status: "full", lat: 4.6410, lng: 9.4520 },
  { id: 3, name: "COMMUNITY BIN 03", area: "SAMPLE AREA 03", status: "maintenance", lat: 4.6300, lng: 9.4580 },
  { id: 4, name: "COMMUNITY BIN 04", area: "SAMPLE AREA 04", status: "available", lat: 4.6470, lng: 9.4400 },
  { id: 5, name: "COMMUNITY BIN 05", area: "SAMPLE AREA 05", status: "available", lat: 4.6250, lng: 9.4430 },
  { id: 6, name: "COMMUNITY BIN 06", area: "SAMPLE AREA 06", status: "full", lat: 4.6500, lng: 9.4600 },
  { id: 7, name: "COMMUNITY BIN 07", area: "SAMPLE AREA 07", status: "available", lat: 4.6330, lng: 9.4320 },
  { id: 8, name: "COMMUNITY BIN 08", area: "SAMPLE AREA 08", status: "maintenance", lat: 4.6550, lng: 9.4480 },
  { id: 9, name: "COMMUNITY BIN 09", area: "SAMPLE AREA 09", status: "available", lat: 4.6200, lng: 9.4540 }
];

let mapInstance = null;
let markerLayer = null;
let toastSequence = 0;
let notificationsCleared = false;

/* -------------------- GENERAL HELPERS -------------------- */

function on(id, eventName, handler) {
  const element = $(id);
  if (element) element.addEventListener(eventName, handler);
  return element;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = String(value ?? "");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getReports() {
  const reports = readStorage(REPORTS_KEY, []);
  return Array.isArray(reports) ? reports : [];
}

function saveReports(reports) {
  writeStorage(REPORTS_KEY, reports);
}

function getProfile() {
  const profile = readStorage(PROFILE_KEY, {});
  return profile && typeof profile === "object" && !Array.isArray(profile)
    ? profile
    : {};
}

function showToast(message, type = "success") {
  const region = $("toastRegion");
  if (!region) {
    console.log(message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  toast.setAttribute("role", "status");
  toast.dataset.toastId = String(++toastSequence);
  region.appendChild(toast);

  while (region.children.length > 4) {
    region.firstElementChild?.remove();
  }

  const toastId = toast.dataset.toastId;
  window.setTimeout(() => {
    region.querySelector(`[data-toast-id="${toastId}"]`)?.remove();
  }, 4500);
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "DATE UNAVAILABLE";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function getStatusLabel(status) {
  const labels = {
    available: "AVAILABLE",
    full: "FULL",
    maintenance: "MAINTENANCE"
  };
  return labels[status] || "UNKNOWN";
}

function getReportStatusLabel(report) {
  return report.resolved ? "RESOLVED DEMO" : "PENDING DEMO";
}

function scrollToSection(id) {
  const section = $(id);
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* -------------------- DASHBOARD METRICS -------------------- */

function updateDashboard() {
  const reports = getReports();

  setText("metricBins", sampleBins.length);
  setText(
    "metricAvailable",
    sampleBins.filter((bin) => bin.status === "available").length
  );
  setText("metricReports", reports.length);
  setText("metricPending", reports.filter((report) => !report.resolved).length);
  setText("navReportCount", reports.length);
}

/* -------------------- DUSTBIN DIRECTORY -------------------- */

function getDirectoryBins() {
  const query = ($("directorySearch")?.value || "").trim().toLowerCase();
  const status = $("directoryStatus")?.value || "all";
  const sort = $("sortBins")?.value || "name";

  const filtered = sampleBins.filter((bin) => {
    const matchesText =
      bin.name.toLowerCase().includes(query) ||
      bin.area.toLowerCase().includes(query);

    const matchesStatus = status === "all" || bin.status === status;
    return matchesText && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === "status") {
      return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
    }
    if (sort === "area") {
      return a.area.localeCompare(b.area) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });

  return filtered;
}

function renderDirectory() {
  const grid = $("binGrid");
  if (!grid) return;

  const bins = getDirectoryBins();
  setText("directoryCount", `${bins.length} ${bins.length === 1 ? "RECORD" : "RECORDS"}`);
  setText("directorySummary", `${bins.length} OF ${sampleBins.length} SAMPLE RECORDS DISPLAYED`);

  if (!bins.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>No matching records found.</strong>
        <br>Try another search or clear your filters.
      </div>`;
    return;
  }

  grid.innerHTML = bins.map((bin) => `
    <article class="bin-card">
      <div class="bin-card-top">
        <span class="bin-symbol" aria-hidden="true">♻</span>
        <span class="status-pill status-${escapeHTML(bin.status)}">
          ${escapeHTML(getStatusLabel(bin.status))}
        </span>
      </div>
      <h3>${escapeHTML(bin.name)}</h3>
      <div class="bin-area">⌖ ${escapeHTML(bin.area)}</div>
      <div class="bin-meta">
        <span>REFERENCE BIN-${String(bin.id).padStart(3, "0")}</span>
        <span>DEMO RECORD</span>
      </div>
      <div class="bin-card-footer">
        <small>ILLUSTRATIVE LOCATION</small>
        <button class="bin-map-button" type="button" data-show-bin="${bin.id}">
          View on map ↗
        </button>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll("[data-show-bin]").forEach((button) => {
    button.addEventListener("click", () => {
      const bin = sampleBins.find(
        (item) => item.id === Number(button.dataset.showBin)
      );
      if (!bin) return;

      const mapSearch = $("mapSearch");
      const mapStatus = $("mapStatus");
      if (mapSearch) mapSearch.value = "";
      if (mapStatus) mapStatus.value = "all";

      renderMapMarkers();

      if (!mapInstance || !markerLayer) {
        showToast("The map is unavailable. Check your internet connection.", "error");
        scrollToSection("map-section");
        return;
      }

      mapInstance.setView([bin.lat, bin.lng], 16);

      markerLayer.eachLayer((marker) => {
        if (marker.options.binId === bin.id) marker.openPopup();
      });

      scrollToSection("map-section");
      window.setTimeout(() => mapInstance?.invalidateSize(), 250);
    });
  });
}

/* -------------------- MAP -------------------- */

function markerColour(status) {
  const colours = {
    available: "#0a9966",
    full: "#df9b3c",
    maintenance: "#d85858"
  };
  return colours[status] || "#78867e";
}

function createMarkerIcon(status) {
  return L.divIcon({
    className: "tracker-map-marker",
    html: `
      <div style="
        width:28px;height:28px;display:grid;place-items:center;
        border:3px solid white;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${markerColour(status)};
        color:white;font-weight:800;font-size:10px;
        box-shadow:0 3px 10px #0003
      "><span style="transform:rotate(45deg)">H</span></div>
    `,
    iconSize: [28, 32],
    iconAnchor: [14, 30],
    popupAnchor: [0, -27]
  });
}

function getMapBins() {
  const query = ($("mapSearch")?.value || "").trim().toLowerCase();
  const status = $("mapStatus")?.value || "all";

  return sampleBins.filter((bin) => {
    const matchesText =
      bin.name.toLowerCase().includes(query) ||
      bin.area.toLowerCase().includes(query);
    const matchesStatus = status === "all" || bin.status === status;
    return matchesText && matchesStatus;
  });
}

function renderMapMarkers() {
  if (!mapInstance || !markerLayer) return;

  markerLayer.clearLayers();
  const bins = getMapBins();

  setText(
    "mapResultCount",
    `${bins.length} ${bins.length === 1 ? "LOCATION" : "LOCATIONS"}`
  );

  bins.forEach((bin) => {
    const marker = L.marker([bin.lat, bin.lng], {
      icon: createMarkerIcon(bin.status),
      binId: bin.id
    });

    marker.bindPopup(`
      <div style="min-width:175px;font-family:Arial,sans-serif">
        <strong>${escapeHTML(bin.name)}</strong>
        <p style="margin:6px 0;color:#68776d;font-size:13px">
          ${escapeHTML(bin.area)}
        </p>
        <strong style="color:${markerColour(bin.status)}">
          ${escapeHTML(getStatusLabel(bin.status))}
        </strong>
        <p style="margin:8px 0 0;font-size:11px;color:#78867e">
          Illustrative sample record — verify before use.
        </p>
      </div>
    `);

    marker.addTo(markerLayer);
  });
}

function initializeMap() {
  const mapElement = $("map");
  if (!mapElement) return;

  if (typeof L === "undefined") {
    mapElement.innerHTML = `
      <div class="empty-state">
        Map library could not load.
        <br>Check your internet connection and refresh.
      </div>`;
    setText("mapResultCount", "MAP UNAVAILABLE");
    return;
  }

  try {
    mapInstance = L.map(mapElement, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([4.636, 9.448], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapInstance);

    markerLayer = L.layerGroup().addTo(mapInstance);
    renderMapMarkers();
  } catch (error) {
    console.error("Map initialisation failed:", error);
    mapInstance = null;
    markerLayer = null;
    mapElement.innerHTML = `
      <div class="empty-state">
        The map could not be initialised.
        <br>Refresh the page to try again.
      </div>`;
    setText("mapResultCount", "MAP UNAVAILABLE");
  }
}

/* -------------------- REPORT HISTORY -------------------- */

function createReportReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `HK-${timestamp}-${suffix}`;
}

function renderReportHistory() {
  const tbody = $("reportTable");
  if (!tbody) return;

  const reports = getReports();

  if (!reports.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="table-empty">
        No reports have been submitted yet.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = reports.map((report) => `
    <tr>
      <td>${escapeHTML(report.reference)}</td>
      <td>${escapeHTML(report.type)}</td>
      <td>${escapeHTML(report.area)}</td>
      <td>${escapeHTML(formatDate(report.submittedAt))}</td>
      <td>
        <span class="table-status ${report.resolved ? "resolved" : ""}">
          ${escapeHTML(getReportStatusLabel(report))}
        </span>
      </td>
      <td>
        <button class="table-action" type="button"
          data-delete-report="${escapeHTML(report.reference)}">
          Delete
        </button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-delete-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const reference = button.dataset.deleteReport;
      if (!reference) return;

      if (!window.confirm(`Delete local demo report ${reference}?`)) return;

      try {
        const updated = getReports().filter(
          (report) => report.reference !== reference
        );
        saveReports(updated);
        refreshDashboard();
        showToast("Local demo report deleted.");
      } catch (error) {
        console.error("Could not delete report:", error);
        showToast("Could not update local report history.", "error");
      }
    });
  });
}

/* -------------------- REPORT FORM -------------------- */

function initializeReportForm() {
  const form = $("reportForm");
  const description = $("issueDescription");
  const feedback = $("reportFeedback");
  if (!form || !description || !feedback) return;

  const updateDescriptionCount = () => {
    setText("descriptionCount", description.value.length);
  };

  description.addEventListener("input", updateDescriptionCount);
  updateDescriptionCount();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    feedback.textContent = "";
    feedback.className = "form-feedback";

    if (!form.reportValidity()) return;

    const report = {
      reference: createReportReference(),
      type: $("issueType")?.value || "",
      priority: $("issuePriority")?.value || "Normal",
      area: $("issueArea")?.value.trim() || "",
      landmark: $("issueLandmark")?.value.trim() || "",
      description: description.value.trim(),
      reporterName: $("reporterName")?.value.trim() || "",
      reporterEmail: $("reporterEmail")?.value.trim() || "",
      submittedAt: new Date().toISOString(),
      resolved: false
    };

    if (!report.type || !report.area || !report.description) {
      feedback.textContent = "Please complete all required fields.";
      feedback.classList.add("error");
      return;
    }

    try {
      const reports = getReports();
      reports.unshift(report);
      saveReports(reports);

      refreshDashboard();
      form.reset();
      updateDescriptionCount();

      feedback.textContent =
        `DEMO REPORT SAVED. Reference: ${report.reference}. ` +
        "This report has NOT been sent to HYSACAM.";
      feedback.classList.add("success");
      feedback.setAttribute("tabindex", "-1");
      feedback.focus();

      showToast("Demo report saved in this browser.");
    } catch (error) {
      console.error("Report save failed:", error);
      feedback.textContent =
        "Could not save the report. Check your browser storage settings.";
      feedback.classList.add("error");
    }
  });
}

/* -------------------- CSV EXPORT -------------------- */

function downloadCSV() {
  const reports = getReports();

  if (!reports.length) {
    showToast("There are no reports to export yet.", "error");
    return;
  }

  const columns = [
    ["REFERENCE", "reference"],
    ["ISSUE TYPE", "type"],
    ["PRIORITY", "priority"],
    ["AREA", "area"],
    ["LANDMARK", "landmark"],
    ["DESCRIPTION", "description"],
    ["REPORTER NAME", "reporterName"],
    ["REPORTER EMAIL", "reporterEmail"],
    ["SUBMITTED DATE", "submittedAt"],
    ["LOCAL STATUS", "resolved"]
  ];

  function csvCell(value) {
    let safe = String(value ?? "");

    // Reduce the risk of spreadsheet formula injection from user-entered text.
    if (/^[\s]*[=+\-@]/.test(safe)) safe = "'" + safe;

    return `"${safe.replace(/"/g, '""')}"`;
  }

  const rows = [
    columns.map(([heading]) => csvCell(heading)).join(","),
    ...reports.map((report) => columns.map(([, key]) => {
      if (key === "resolved") {
        return csvCell(report.resolved ? "Resolved demo" : "Pending demo");
      }
      return csvCell(report[key]);
    }).join(","))
  ];

  const blob = new Blob(["\uFEFF" + rows.join("\r\n")], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hysacam-kumba-demo-reports.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("CSV export prepared.");
}

/* -------------------- PROFILE -------------------- */

function initializeProfile() {
  const form = $("profileForm");
  if (!form) return;

  const profile = getProfile();
  if ($("displayName")) $("displayName").value = profile.name || "";
  if ($("preferredArea")) $("preferredArea").value = profile.area || "";

  function applyProfile() {
    const current = getProfile();
    const name = current.name?.trim() || "VISITOR";
    const initial = name.charAt(0).toUpperCase() || "V";

    setText("profileNameTop", name.toUpperCase());
    setText("profileNameDisplay", name.toUpperCase());
    setText("topProfileName", name);

    ["profileAvatar", "topAvatar", "profileAvatarLarge"].forEach((id) => {
      const avatar = $(id);
      if (!avatar) return;
      avatar.textContent = initial;
      avatar.setAttribute("aria-label", `Profile for ${name}`);
      avatar.title = name;
    });
  }

  applyProfile();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("displayName")?.value.trim() || "";
    const area = $("preferredArea")?.value.trim() || "";

    try {
      writeStorage(PROFILE_KEY, { name, area });
      applyProfile();
      showToast("Local profile preferences saved.");
    } catch (error) {
      console.error("Profile save failed:", error);
      showToast("Could not save profile preferences.", "error");
    }
  });

  on("resetProfileButton", "click", () => {
    if (!window.confirm("Reset your local profile preferences?")) return;

    try {
      localStorage.removeItem(PROFILE_KEY);
      form.reset();
      applyProfile();
      showToast("Local profile preferences reset.");
    } catch (error) {
      console.error("Profile reset failed:", error);
      showToast("Could not reset the profile.", "error");
    }
  });
}

/* -------------------- THEME -------------------- */

function initializeTheme() {
  const storedTheme = readStorage(THEME_KEY, "light");
  const dark = storedTheme === "dark";

  document.body.classList.toggle("dark-theme", dark);
  updateThemeButton(dark);

  on("themeToggle", "click", () => {
    const nowDark = document.body.classList.toggle("dark-theme");

    try {
      writeStorage(THEME_KEY, nowDark ? "dark" : "light");
    } catch {
      // The theme can still change for the current page.
    }

    updateThemeButton(nowDark);
    showToast(nowDark ? "Dark theme enabled." : "Light theme enabled.");

    if (mapInstance) {
      window.setTimeout(() => mapInstance?.invalidateSize(), 150);
    }
  });
}

function updateThemeButton(dark) {
  const button = $("themeToggle");
  if (!button) return;

  button.setAttribute(
    "aria-label",
    dark ? "Switch to light theme" : "Switch to dark theme"
  );
  button.title = dark ? "Switch to light theme" : "Switch to dark theme";
  button.textContent = dark ? "☀" : "◐";
}

/* -------------------- SIDEBAR AND NAVIGATION -------------------- */

function initializeSidebar() {
  const sidebar = $("sidebar");
  const toggle = $("menuToggle");
  const overlay = $("sidebarOverlay");

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("visible");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-label", "Open navigation");
  }

  on("menuToggle", "click", () => {
    if (!sidebar) return;
    const open = sidebar.classList.toggle("open");
    overlay?.classList.toggle("visible", open);
    toggle?.setAttribute("aria-expanded", String(open));
    toggle?.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });

  on("sidebarOverlay", "click", closeSidebar);

  document.querySelectorAll(".side-link[href]").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".side-link[href]").forEach((item) => {
        item.classList.remove("active");
      });

      link.classList.add("active");

      const pageName = link.dataset.page || link.textContent.trim();
      setText("pageLabel", pageName);
      closeSidebar();

      if (link.getAttribute("href") === "#map-section" && mapInstance) {
        window.setTimeout(() => mapInstance?.invalidateSize(), 250);
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (
      window.innerWidth <= 1000 &&
      sidebar?.classList.contains("open") &&
      !sidebar.contains(event.target) &&
      !toggle?.contains(event.target)
    ) {
      closeSidebar();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });

  const profileButtons = ["profileShortcut", "topProfileButton"];
  profileButtons.forEach((id) => {
    on(id, "click", () => scrollToSection("profile-section"));
  });
}

/* -------------------- NOTIFICATIONS -------------------- */

function renderNotifications() {
  const list = $("notificationList");
  if (!list) return;

  if (notificationsCleared) {
    list.innerHTML = `
      <div class="empty-state">
        Notifications were cleared from this view.
        <br><button class="button button-secondary" type="button" id="restoreNotificationsButton">
          Restore notices
        </button>
      </div>`;
    const dot = $("notificationDot");
    if (dot) dot.style.display = "none";

    on("restoreNotificationsButton", "click", () => {
      notificationsCleared = false;
      renderNotifications();
      showToast("Notices restored.");
    });
    return;
  }

  const items = [
    {
      icon: "i",
      title: "DEMONSTRATION MODE IS ACTIVE",
      description: "The directory and map use illustrative data, not verified service records."
    },
    {
      icon: "♻",
      title: "SAMPLE DIRECTORY READY",
      description: `${sampleBins.length} illustrative records are available for search and filtering.`
    },
    {
      icon: "✉",
      title: "SUPPORT EMAIL AVAILABLE",
      description: `Website assistance: ${SUPPORT_EMAIL}`
    },
    {
      icon: "▤",
      title: "LOCAL REPORT HISTORY",
      description: "Reports created in this browser can be reviewed and exported from Report History."
    }
  ];

  list.innerHTML = items.map((item) => `
    <article class="notification-item">
      <span class="notification-icon">${escapeHTML(item.icon)}</span>
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.description)}</p>
      </div>
    </article>
  `).join("");

  const dot = $("notificationDot");
  if (dot) dot.style.display = "block";
}

/* -------------------- BUTTONS AND REFRESH -------------------- */

function refreshDashboard() {
  updateDashboard();
  renderDirectory();
  renderReportHistory();
  renderMapMarkers();
}

function initializeButtons() {
  on("refreshButton", "click", () => {
    refreshDashboard();
    if (mapInstance) mapInstance.invalidateSize();
    showToast("Dashboard refreshed.");
  });

  on("resetMapButton", "click", () => {
    if ($("mapSearch")) $("mapSearch").value = "";
    if ($("mapStatus")) $("mapStatus").value = "all";

    renderMapMarkers();
    if (mapInstance) mapInstance.setView([4.636, 9.448], 14);
    showToast("Map view reset.");
  });

  on("showAllBinsButton", "click", () => {
    if ($("mapSearch")) $("mapSearch").value = "";
    if ($("mapStatus")) $("mapStatus").value = "all";

    renderMapMarkers();

    if (mapInstance) {
      const allCoordinates = sampleBins.map((bin) => [bin.lat, bin.lng]);
      if (allCoordinates.length > 1) {
        mapInstance.fitBounds(allCoordinates, { padding: [25, 25], maxZoom: 14 });
      } else {
        mapInstance.setView([4.636, 9.448], 14);
      }
    }
    showToast("All sample locations displayed.");
  });

  on("clearFiltersButton", "click", () => {
    if ($("directorySearch")) $("directorySearch").value = "";
    if ($("directoryStatus")) $("directoryStatus").value = "all";
    if ($("sortBins")) $("sortBins").value = "name";

    renderDirectory();
    showToast("Directory filters cleared.");
  });

  on("exportButton", "click", downloadCSV);
  on("exportHistoryButton", "click", downloadCSV);
  on("printButton", "click", () => window.print());

  on("notificationButton", "click", () => {
    scrollToSection("notifications");
  });

  on("clearNotificationsButton", "click", () => {
    notificationsCleared = true;
    renderNotifications();
    showToast("Notification view cleared.");
  });

  on("dismissNotice", "click", () => {
    $("demoNotice")?.remove();

    try {
      writeStorage(NOTICE_KEY, true);
    } catch {
      // The notice remains dismissed until this page is refreshed.
    }
  });

  if (readStorage(NOTICE_KEY, false)) {
    $("demoNotice")?.remove();
  }

  const backTop = $("backTop");
  const updateBackTop = () => {
    backTop?.classList.toggle("visible", window.scrollY > 500);
  };

  window.addEventListener("scroll", updateBackTop, { passive: true });
  updateBackTop();

  on("backTop", "click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* -------------------- SEARCH AND FOOTER -------------------- */

function initializeSearchFields() {
  on("directorySearch", "input", renderDirectory);
  on("directoryStatus", "change", renderDirectory);
  on("sortBins", "change", renderDirectory);
  on("mapSearch", "input", renderMapMarkers);
  on("mapStatus", "change", renderMapMarkers);
}

function initializeFooter() {
  setText("currentYear", new Date().getFullYear());

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  setText("todayLabel", today);
}

/* -------------------- START APPLICATION -------------------- */

function initializeApp() {
  try {
    initializeTheme();
    initializeSidebar();
    initializeMap();
    initializeSearchFields();
    initializeReportForm();
    initializeProfile();
    initializeButtons();
    initializeFooter();
    renderDirectory();
    renderReportHistory();
    renderNotifications();
    updateDashboard();

    console.info("HYSACAM Kumba Tracker demonstration loaded.");
  } catch (error) {
    console.error("An unexpected application error occurred:", error);
    showToast("Some features could not start. Open the browser console for details.", "error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
} else {
  initializeApp();
}