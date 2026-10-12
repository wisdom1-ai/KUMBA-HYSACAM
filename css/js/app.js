"use strict";

/*
 * HYSACAM KUMBA TRACKER
 * Main interface controller.
 *
 * Profile, preferences, notifications and reports are stored locally.
 * Reports are not sent online without a connected backend.
 */

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const KEYS = {
    profile: "hysacam_tracker_profile_v5",
    preferences: "hysacam_tracker_preferences_v5",
    notifications: "hysacam_tracker_notifications_v5",
    reports: "hysacam_tracker_reports_v5",
    notice: "hysacam_tracker_notice_v5"
  };

  const DEFAULT_PROFILE = {
    name: "",
    email: "",
    phone: "",
    area: "",
    photo: ""
  };

  const DEFAULT_PREFERENCES = {
    appearance: "system",
    textSize: "normal",
    reducedMotion: false,
    language: "en",
    dateFormat: "local"
  };

  const DEFAULT_NOTIFICATIONS = {
    updates: true,
    reports: true,
    tips: false
  };

  let profile = {
    ...DEFAULT_PROFILE,
    ...readJSON(KEYS.profile, {})
  };

  let preferences = {
    ...DEFAULT_PREFERENCES,
    ...readJSON(KEYS.preferences, {})
  };

  let notifications = {
    ...DEFAULT_NOTIFICATIONS,
    ...readJSON(KEYS.notifications, {})
  };

  let toastTimer;
  let photoInput;
  let reportPhotoData = "";
  // Reports are delivered by the local Python backend when SMTP is configured.
  const REPORTS_EMAIL = "the configured recipient inbox";

  function readJSON(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? fallback : JSON.parse(saved);
    } catch (error) {
      console.warn("Could not read saved data:", error);
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Could not save data:", error);
      notify("Could not save. Browser storage may be full.");
      return false;
    }
  }

  function notify(message) {
    let toast = $("#toast") || $("#toastContainer");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("visible");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("visible");
      if (toast.id === "toast") toast.hidden = true;
    }, 3200);
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value ?? "";
  }

  function setValue(selector, value) {
    const element = $(selector);
    if (element) element.value = value ?? "";
  }

  function setChecked(selector, value) {
    const element = $(selector);
    if (element) element.checked = Boolean(value);
  }

  function initials(name) {
    const words = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return words.length
      ? words.slice(0, 2).map(word => word[0].toUpperCase()).join("")
      : "HK";
  }

  function updateAvatar(element, name, photo) {
    if (!element) return;

    element.replaceChildren();

    if (photo) {
      const image = document.createElement("img");
      image.src = photo;
      image.alt = "Profile picture";
      image.className = "profile-avatar-image";
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "cover";
      image.style.borderRadius = "inherit";
      element.appendChild(image);
    } else {
      element.textContent = initials(name);
    }

    element.setAttribute("aria-label", name || "Profile");
  }

  function renderProfile() {
    const name = profile.name || "Your profile";

    setText("#profileNameDisplay", name);
    setText("#profileNameTop", name);
    setText("#topProfileName", name);

    updateAvatar($("#profileAvatarLarge"), name, profile.photo);
    updateAvatar($("#profileAvatar"), name, profile.photo);
    updateAvatar($("#topAvatar"), name, profile.photo);

    setValue("#displayName", profile.name);
    setValue("#profileEmail", profile.email);
    setValue("#profilePhone", profile.phone);
    setValue("#preferredArea", profile.area);
  }

  function systemPrefersDark() {
    return window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ).matches ?? false;
  }

  function translateInterface() {
    const fr = preferences.language === "fr";
    document.documentElement.lang = fr ? "fr" : "en";
    const text = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
    const attr = (selector, name, value) => { const el = $(selector); if (el) el.setAttribute(name, value); };
    const translations = fr ? {
      '[data-page="overview"] span:not(.nav-icon)': 'Tableau de bord',
      '[data-page="map-section"] span:not(.nav-icon)': 'Carte de collecte',
      '[data-page="directory-section"] span:not(.nav-icon)': 'Points de collecte',
      '[data-page="report-section"] span:not(.nav-icon)': 'Signaler un problème',
      '[data-page="reports-section"] span:not(.nav-icon)': 'Historique des signalements',
      '[data-page="settings-section"] span:not(.nav-icon)': 'Paramètres',
      '[data-page="support-section"] span:not(.nav-icon)': 'Aide et assistance',
      '#report-section .page-intro h1': 'Signaler un problème de déchets',
      '#report-section .page-intro p:not(.eyebrow)': 'Fournissez des informations précises sur le problème de collecte.',
      '#report-section .panel-heading h2': 'Détails du problème',
      '#report-section .panel-heading p': 'Remplissez les champs obligatoires ci-dessous. Ils sont clairement indiqués.',
      'label[for="issueType"]': 'Type de problème — Obligatoire',
      'label[for="issuePriority"]': 'Priorité — Obligatoire',
      'label[for="issueArea"]': 'Quartier à Kumba — Obligatoire',
      'label[for="issueLandmark"]': 'Point de repère à proximité',
      'label[for="issueDescription"]': 'Description — Obligatoire',
      'label[for="reporterName"]': 'Votre nom — Obligatoire',
      'label[for="reporterEmail"]': 'Adresse e-mail — Obligatoire',
      '#resetReportForm': 'Effacer le formulaire',
      '#reportForm button[type="submit"]': 'Envoyer le signalement',
      '#report-section .info-panel h2': 'Avant l’envoi',
      '#settings-section .page-intro h1': 'Paramètres',
      '#settings-section .page-intro p:not(.eyebrow)': 'Gérez votre profil et vos préférences.',
      '[data-settings-tab="profile-settings"]': 'Mon profil',
      '[data-settings-tab="appearance"]': 'Apparence',
      '[data-settings-tab="preferences"]': 'Préférences',
      '[data-settings-tab="notifications-settings"]': 'Notifications',
      '[data-settings-tab="privacy"]': 'Confidentialité et données',
      '[data-settings-tab="security"]': 'Sécurité',
      '[data-settings-tab="about"]': 'À propos',
      '[data-settings-pane="profile-settings"] h2': 'Mon profil',
      '#chooseProfilePhotoButton': 'Choisir ou modifier la photo',
      '#resetProfileButton': 'Annuler les modifications',
      '#profileForm button[type="submit"]': 'Enregistrer le profil',
      '[data-settings-pane="appearance"] h2': 'Apparence',
      '[data-settings-pane="appearance"] p': 'Personnalisez l’apparence du suivi.',
      '[data-settings-pane="preferences"] h2': 'Préférences',
      '[data-settings-pane="preferences"] p': 'Choisissez la langue de l’interface.',
      '#savePreferences': 'Enregistrer les préférences',
      '#saveAppearance': 'Enregistrer l’apparence'
    } : {
      '[data-page="overview"] span:not(.nav-icon)': 'Dashboard',
      '[data-page="map-section"] span:not(.nav-icon)': 'Collection Map',
      '[data-page="directory-section"] span:not(.nav-icon)': 'Dustbin Directory',
      '[data-page="report-section"] span:not(.nav-icon)': 'Report an Issue',
      '[data-page="reports-section"] span:not(.nav-icon)': 'Report History',
      '[data-page="settings-section"] span:not(.nav-icon)': 'Settings',
      '[data-page="support-section"] span:not(.nav-icon)': 'Help & Support',
      '#report-section .page-intro h1': 'Report a Waste Issue',
      '#report-section .page-intro p:not(.eyebrow)': 'Provide accurate information about a collection problem.',
      '#report-section .panel-heading h2': 'Issue Details',
      '#report-section .panel-heading p': 'Complete the required fields below. Required fields are clearly labelled.',
      'label[for="issueType"]': 'Issue Type — Required',
      'label[for="issuePriority"]': 'Priority — Required',
      'label[for="issueArea"]': 'Area in Kumba — Required',
      'label[for="issueLandmark"]': 'Nearby Landmark',
      'label[for="issueDescription"]': 'Description — Required',
      'label[for="reporterName"]': 'Your Name — Required',
      'label[for="reporterEmail"]': 'Email Address — Required',
      '#resetReportForm': 'Clear Form',
      '#reportForm button[type="submit"]': 'Submit Report',
      '#report-section .info-panel h2': 'Before You Submit',
      '#settings-section .page-intro h1': 'Settings',
      '#settings-section .page-intro p:not(.eyebrow)': 'Manage your profile and preferences.',
      '[data-settings-tab="profile-settings"]': 'My Profile',
      '[data-settings-tab="appearance"]': 'Appearance',
      '[data-settings-tab="preferences"]': 'Preferences',
      '[data-settings-tab="notifications-settings"]': 'Notifications',
      '[data-settings-tab="privacy"]': 'Privacy & Data',
      '[data-settings-tab="security"]': 'Security',
      '[data-settings-tab="about"]': 'About',
      '[data-settings-pane="profile-settings"] h2': 'My Profile',
      '#chooseProfilePhotoButton': 'Select or change photo',
      '#resetProfileButton': 'Reset Changes',
      '#profileForm button[type="submit"]': 'Save Profile',
      '[data-settings-pane="appearance"] h2': 'Appearance',
      '[data-settings-pane="appearance"] p': 'Change the way the tracker looks.',
      '[data-settings-pane="preferences"] h2': 'Preferences',
      '[data-settings-pane="preferences"] p': 'Choose your preferred display language.',
      '#savePreferences': 'Save Preferences',
      '#saveAppearance': 'Save Appearance'
    };
    Object.entries(translations).forEach(([selector, value]) => {
      // Preserve nested icons by translating the visible label where possible.
      const elements = $$(selector);
      elements.forEach(el => {
        if (el.matches('button') && el.querySelector('.nav-icon')) {
          const label = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
          if (label) label.textContent = ` ${value} `;
          else el.setAttribute('aria-label', value);
        } else if (el.matches('span') && el.closest('.nav-link')) el.textContent = value;
        else el.textContent = value;
      });
    });
    const issueType = $('#issueType');
    if (issueType && issueType.options.length) {
      const opts = fr ? ['Choisir le type de problème','Poubelle pleine','Collecte manquée','Poubelle endommagée','Dépôt illégal','Accumulation de déchets','Autre'] : ['Select issue type','Full dustbin','Missed collection','Damaged dustbin','Illegal dumping','Waste accumulation','Other'];
      [...issueType.options].forEach((o,i) => { if (opts[i]) o.textContent = opts[i]; });
    }
    const priority = $('#issuePriority');
    if (priority) [...priority.options].forEach((o,i) => { const en=['Normal','High','Urgent'], frv=['Normale','Élevée','Urgente']; o.textContent=(fr?frv:en)[i] || o.textContent; });
    attr('#issueArea','placeholder',fr?'Ex. Fiango, Kumba Town':'e.g. Fiango, Kumba Town');
    attr('#issueLandmark','placeholder',fr?'Rue, carrefour ou bâtiment proche':'Street, junction or nearby building');
    attr('#issueDescription','placeholder',fr?'Décrivez le problème et son emplacement…':'Describe the problem and its location...');
    attr('#reporterName','placeholder',fr?'Saisissez votre nom complet':'Enter your full name');
    attr('#reporterEmail','placeholder',fr?'nom@exemple.com':'name@example.com');
  }

  function applyPreferences() {
    const dark =
      preferences.appearance === "dark" ||
      (
        preferences.appearance === "system" &&
        systemPrefersDark()
      );

    document.body.classList.toggle("dark-theme", dark);

    document.documentElement.style.colorScheme =
      dark ? "dark" : "light";

    setValue("#appearanceMode", preferences.appearance);
    translateInterface();

    const toggle = $("#themeToggle");

    if (toggle) {
      toggle.setAttribute("aria-pressed", String(dark));
      toggle.setAttribute(
        "aria-label",
        dark ? "Switch to light appearance" : "Switch to dark appearance"
      );
      toggle.title = dark
        ? "Switch to light appearance"
        : "Switch to dark appearance";
    }
  }

  function renderOtherPreferences() {
    setValue("#languagePreference", preferences.language);
    setValue("#datePreference", preferences.dateFormat);

    setChecked("#notifyUpdates", notifications.updates);
    setChecked("#notifyReports", notifications.reports);
    setChecked("#notifyTips", notifications.tips);
  }

  function closeSidebar() {
    $("#sidebar")?.classList.remove("open", "active");
    $("#sidebarOverlay")?.classList.remove("visible", "active");
    document.body.classList.remove("sidebar-open");
  }

  function goTo(sectionId) {
    // Support both "overview" and "overview-section" naming.
    const candidates = [
      sectionId,
      sectionId === "overview" ? "overview-section" : null,
      sectionId.endsWith("-section")
        ? sectionId.replace(/-section$/, "")
        : `${sectionId}-section`
    ].filter(Boolean);

    const section = candidates
      .map(id => document.getElementById(id))
      .find(Boolean);

    if (!section) {
      notify("This section is not available.");
      return false;
    }

    // Show the selected page and hide other page sections.
    $$(".page-section").forEach(item => {
      item.hidden = item !== section;
    });

    section.hidden = false;

    const navLinks = $$(".nav-link");

    const matchingLink = navLinks.find(link => {
      const page = link.dataset.page || "";
      return candidates.includes(page) ||
        page === section.id ||
        (
          page === "overview" &&
          section.id === "overview"
        );
    });

    navLinks.forEach(link => {
      const active = link === matchingLink;
      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    const pageTitle = $("#pageTitle");
    const pageLabel = $("#pageLabel");

    if (matchingLink) {
      const label = matchingLink.textContent.trim();
      if (pageLabel) pageLabel.textContent = label;
      if (pageTitle) pageTitle.textContent = label;
    }

    closeSidebar();

    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    if (section.id === "map-section") {
      window.dispatchEvent(
        new CustomEvent("hysacam:map-request")
      );
    }

    if (section.id === "reports-section") {
      renderReportHistory();
    }

    return true;
  }

  function openProfile() {
    goTo("settings-section");
    activateSettingsTab($('[data-settings-tab="profile-settings"]'));
  }

  function activateSettingsTab(button) {
    if (!button) return;

    const tabName = button.dataset.settingsTab;

    const pane = $$("[data-settings-pane]").find(
      item => item.dataset.settingsPane === tabName
    );

    if (!pane) {
      notify("This settings panel is not available.");
      return;
    }

    $$("[data-settings-tab]").forEach(tab => {
      const active = tab === button;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.setAttribute("tabindex", active ? "0" : "-1");
    });

    $$("[data-settings-pane]").forEach(item => {
      item.hidden = item !== pane;
    });
  }

  function saveProfile(event) {
    event?.preventDefault();

    const name = ($("#displayName")?.value || "").trim();
    const email = ($("#profileEmail")?.value || "").trim();
    const phone = ($("#profilePhone")?.value || "").trim();
    const area = ($("#preferredArea")?.value || "").trim();

    if (!name) {
      notify("Please enter your name.");
      $("#displayName")?.focus();
      return;
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      notify("Please enter a valid email address.");
      $("#profileEmail")?.focus();
      return;
    }

    profile = { ...profile, name, email, phone, area };

    if (saveJSON(KEYS.profile, profile)) {
      renderProfile();
      setText("#settingsProfileSummary", `${profile.name || "Resident"}${profile.email ? ` · ${profile.email}` : ""}${profile.area ? ` · ${profile.area}` : ""}`);
      notify("Profile saved on this device.");
    }
  }

  function saveAppearance() {
    preferences.appearance =
      $("#appearanceMode")?.value || "system";

    if (saveJSON(KEYS.preferences, preferences)) {
      applyPreferences();
      notify("Appearance settings saved.");
    }
  }

  function saveGeneralPreferences() {
    preferences.language =
      $("#languagePreference")?.value || "en";

    preferences.dateFormat =
      $("#datePreference")?.value || "local";

    if (saveJSON(KEYS.preferences, preferences)) {
      translateInterface();
      notify(
        preferences.language === "fr"
          ? "Préférences enregistrées sur cet appareil."
          : "Preferences saved on this device."
      );
    }
  }

  function saveNotificationPreferences() {
    notifications = {
      updates: Boolean($("#notifyUpdates")?.checked),
      reports: Boolean($("#notifyReports")?.checked),
      tips: Boolean($("#notifyTips")?.checked)
    };

    if (saveJSON(KEYS.notifications, notifications)) {
      notify("Notification preferences saved.");
    }
  }

  function downloadFile(
    filename,
    content,
    type = "application/json"
  ) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportProfile() {
    downloadFile(
      "hysacam-profile-settings.json",
      JSON.stringify({
        profile,
        preferences,
        notifications,
        exportedAt: new Date().toISOString()
      }, null, 2)
    );

    notify("Your profile data export is ready.");
  }

  function readReports() {
    const reports = readJSON(KEYS.reports, []);
    return Array.isArray(reports) ? reports : [];
  }

  function exportReports() {
    const reports = readReports();

    if (!reports.length) {
      notify("There are no locally saved reports to export.");
      return;
    }

    downloadFile(
      "hysacam-report-history.json",
      JSON.stringify(reports, null, 2)
    );

    notify("Report history exported.");
  }

  function clearLocalReports() {
    if (!window.confirm(
      "Delete locally saved reports from this browser? This cannot be undone."
    )) {
      return;
    }

    try {
      localStorage.removeItem(KEYS.reports);

      window.dispatchEvent(
        new CustomEvent("hysacam:reports-cleared")
      );

      renderReportHistory();
      notify("Locally saved reports cleared.");
    } catch (error) {
      notify("Could not clear saved reports.");
    }
  }

  function clearAllLocalData() {
    if (!window.confirm(
      "This removes the saved profile, preferences, notifications and local reports from this browser. Continue?"
    )) {
      return;
    }

    try {
      Object.values(KEYS).forEach(key => {
        localStorage.removeItem(key);
      });

      profile = { ...DEFAULT_PROFILE };
      preferences = { ...DEFAULT_PREFERENCES };
      notifications = { ...DEFAULT_NOTIFICATIONS };

      renderProfile();
      renderOtherPreferences();
      applyPreferences();
      renderReportHistory();

      window.dispatchEvent(
        new CustomEvent("hysacam:reports-cleared")
      );

      notify("This application's local data has been cleared.");
    } catch (error) {
      notify("Some local data could not be cleared.");
    }
  }

  function resetProfile() {
    if (!window.confirm("Reset your saved profile details?")) {
      return;
    }

    profile = { ...DEFAULT_PROFILE };

    if (saveJSON(KEYS.profile, profile)) {
      renderProfile();
      notify("Profile details reset.");
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString(
      preferences.language === "fr" ? "fr-FR" : undefined
    );
  }

  function renderDashboardSummary() {
    let bins = [];
    try {
      const storedBins = localStorage.getItem("hysacam_kumba_bins");
      if (storedBins !== null) {
        const parsed = JSON.parse(storedBins);
        if (Array.isArray(parsed)) bins = parsed;
      }
    } catch (error) {
      console.warn("Could not read collection-point summary:", error);
    }
    const reports = readReports();
    setText("#totalBins", bins.length);
    setText("#availableBins", bins.filter(bin => String(bin.status || "").toLowerCase() === "available").length);
    setText("#problemBins", bins.filter(bin => ["full", "damaged", "collection needed", "needs repair"].includes(String(bin.status || "").toLowerCase())).length);
    setText("#totalReports", reports.length);

    const recent = $("#recentReports");
    if (recent) {
      recent.replaceChildren();
      if (!reports.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        const message = document.createElement("p");
        message.textContent = "No reports have been saved yet.";
        empty.appendChild(message);
        recent.appendChild(empty);
      } else {
        reports.slice(0, 4).forEach(report => {
          const item = document.createElement("article");
          item.className = "recent-report-item";
          const title = document.createElement("strong");
          title.textContent = report.type || report.issueType || "Waste issue";
          const meta = document.createElement("p");
          meta.textContent = `${report.reference || report.id || "Report"} · ${report.area || "Area not specified"} · ${report.status || "Saved locally"}`;
          const date = document.createElement("small");
          date.textContent = formatDate(report.createdAt || report.date || report.timestamp);
          item.append(title, meta, date);
          recent.appendChild(item);
        });
      }
    }
  }

  function renderReportHistory() {
    const table = $("#reportTable");
    if (!table) return;

    const reports = readReports();

    const query = (
      $("#reportSearch")?.value || ""
    ).trim().toLowerCase();

    const statusFilter = (
      $("#reportStatusFilter")?.value || "all"
    ).toLowerCase();

    const filtered = reports.filter(report => {
      const searchable = [
        report.id,
        report.reference,
        report.type,
        report.issueType,
        report.area,
        report.location,
        report.landmark,
        report.description,
        report.status,
        report.priority
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const status = String(
        report.status || "saved locally"
      ).toLowerCase();

      const normalizedStatus = status.replace(/\s*\(local\)$/i, "");
      return searchable.includes(query) &&
        (statusFilter === "all" || !statusFilter || normalizedStatus === statusFilter);
    });

    let tbody = $("tbody", table);

    if (!tbody) {
      tbody = document.createElement("tbody");
      table.appendChild(tbody);
    }

    tbody.replaceChildren();

    if (!filtered.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "table-empty";
      cell.textContent = reports.length ? "No reports match your search or status filter." : "No reports saved yet. Submit an issue report to begin your history.";
      row.appendChild(cell);
      tbody.appendChild(row);
    }

    filtered.forEach(report => {
      const row = document.createElement("tr");

      const values = [
        report.id || report.reference || "—",
        report.type || report.issueType || "—",
        report.area || report.location || report.landmark || "—",
        report.status || "Saved locally",
        formatDate(
          report.createdAt || report.date || report.timestamp
        )
      ];

      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    setText(
      "#reportTableCount",
      `${filtered.length} report${filtered.length === 1 ? "" : "s"}`
    );
    setText("#reportStatus", reports.length
      ? `Showing ${filtered.length} of ${reports.length} saved report${reports.length === 1 ? "" : "s"}.`
      : "No reports have been saved on this device yet.");
  }

  function bindClick(selector, handler) {
    document.addEventListener("click", event => {
      const target = event.target.closest(selector);

      if (!target) return;

      event.preventDefault();
      handler(target, event);
    });
  }

  function bindForm(selector, handler) {
    document.addEventListener("submit", event => {
      if (!event.target.matches(selector)) return;
      handler(event);
    });
  }

  function initializeNavigation() {
    bindClick(
      "#profileShortcut, #topProfileButton, #sidebarProfileButton, .profile-shortcut",
      openProfile
    );

    bindClick("[data-go]", button => {
      if (button.dataset.go) goTo(button.dataset.go);
    });

    bindClick("[data-page]", link => {
      const page = link.dataset.page;
      if (!page) return;

      // Prefer an exact matching section ID.
      const destination = document.getElementById(page)
        ? page
        : page === "overview"
          ? "overview"
          : `${page}-section`;

      goTo(destination);
    });

    bindClick("[data-settings-tab]", button => {
      activateSettingsTab(button);
    });

    bindClick("#menuToggle", () => {
      const sidebar = $("#sidebar");
      const overlay = $("#sidebarOverlay");

      const open = !sidebar?.classList.contains("open");

      sidebar?.classList.toggle("open", open);
      overlay?.classList.toggle("visible", open);
      document.body.classList.toggle("sidebar-open", open);
    });

    bindClick("#sidebarOverlay", closeSidebar);
  }

  function initializeSettings() {
    bindForm("#profileForm", saveProfile);

    bindClick("#saveAppearance", saveAppearance);
    bindClick("#savePreferences", saveGeneralPreferences);
    bindClick("#saveNotifications", saveNotificationPreferences);

    bindClick("#resetProfileButton", resetProfile);
    bindClick("#exportProfileData", exportProfile);
    bindClick("#clearLocalReports", clearLocalReports);
    bindClick("#clearAllLocalData", clearAllLocalData);

    bindClick("#themeToggle", () => {
      const isDark =
        document.body.classList.contains("dark-theme");

      preferences.appearance = isDark ? "light" : "dark";

      if (saveJSON(KEYS.preferences, preferences)) {
        applyPreferences();
      }
    });

    bindClick("#exportHistoryButton, #exportReportsButton", exportReports);
    bindClick("#printHistoryButton", () => window.print());
    bindClick("#refreshDashboard", () => { renderDashboardSummary(); notify("Dashboard updated."); });

    bindClick("#resetReportForm", () => {
      $("#reportForm")?.reset();

      const counter = $("#descriptionCount");
      if (counter) counter.textContent = "0";

      notify("Report form cleared.");
    });

    bindClick("#dismissNotice", () => {
      const notice = $("#serviceNotice");

      if (notice) notice.hidden = true;

      try {
        localStorage.setItem(KEYS.notice, "dismissed");
      } catch (error) {
        console.warn("Could not save notice preference.");
      }
    });

    bindClick("#notificationButton", () => {
      goTo("notifications-section");
    });

    bindClick("#markAllReadButton", () => {
      $$(".notification-item.unread, .notification-card.unread")
        .forEach(item => item.classList.remove("unread"));

      setText("#navNotificationCount", "0");

      const dot = $("#topNotificationDot");
      if (dot) dot.hidden = true;

      notify("Visible notifications marked as read.");
    });

    $("#reportSearch")?.addEventListener(
      "input",
      renderReportHistory
    );

    $("#reportStatusFilter")?.addEventListener(
      "change",
      renderReportHistory
    );

    const systemTheme = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    );

    systemTheme?.addEventListener?.("change", () => {
      if (preferences.appearance === "system") {
        applyPreferences();
      }
    });
  }

  function initializeReportForm() {
    const description = $("#issueDescription");
    const counter = $("#descriptionCount");

    function updateCounter() {
      if (description && counter) {
        counter.textContent = String(description.value.length);
      }
    }

    description?.addEventListener("input", updateCounter);
    updateCounter();

    const reportPhotoInput = $("#reportPhoto");
    const photoPreview = $("#reportPhotoPreview");
    const photoPreviewImage = $("#reportPhotoPreviewImage");
    const removePhotoButton = $("#removeReportPhoto");

    function compressImage(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
          reject(new Error("Please select an image file."));
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the selected image."));
        reader.onload = () => {
          const image = new Image();
          image.onerror = () => reject(new Error("This image could not be opened."));
          image.onload = () => {
            const maxSide = 1200;
            const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.72));
          };
          image.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      });
    }

    reportPhotoInput?.addEventListener("change", async () => {
      const file = reportPhotoInput.files?.[0];
      if (!file) return;
      if (file.size > 12 * 1024 * 1024) {
        reportPhotoInput.value = "";
        notify(preferences.language === "fr" ? "Choisissez une image de moins de 12 Mo." : "Please choose an image smaller than 12 MB.");
        return;
      }
      try {
        reportPhotoData = await compressImage(file);
        if (photoPreviewImage) photoPreviewImage.src = reportPhotoData;
        if (photoPreview) photoPreview.hidden = false;
      } catch (error) {
        reportPhotoData = "";
        notify(error.message || "Could not load photo.");
      }
    });
    removePhotoButton?.addEventListener("click", () => {
      reportPhotoData = "";
      if (reportPhotoInput) reportPhotoInput.value = "";
      if (photoPreviewImage) photoPreviewImage.removeAttribute("src");
      if (photoPreview) photoPreview.hidden = true;
    });

    bindForm("#reportForm", async event => {
      event.preventDefault();
      const form = event.target;
      if (!form.reportValidity()) return;

      const existing = readReports();
      const now = new Date().toISOString();
      const reference = `HK-${Date.now().toString(36).toUpperCase()}`;
      const report = {
        id: reference,
        reference,
        issueType: $("#issueType")?.value || "Other",
        type: $("#issueType")?.value || "Other",
        priority: $("#issuePriority")?.value || "Normal",
        area: $("#issueArea")?.value.trim() || "",
        landmark: $("#issueLandmark")?.value.trim() || "",
        description: $("#issueDescription")?.value.trim() || "",
        photoData: reportPhotoData,
        photoName: reportPhotoInput?.files?.[0]?.name || "",
        reporterName: $("#reporterName")?.value.trim() || profile.name || "",
        reporterEmail: $("#reporterEmail")?.value.trim() || profile.email || "",
        status: "Pending",
        createdAt: now,
        updatedAt: now,
        storage: "local-and-server"
      };

      existing.unshift(report);
      if (!saveJSON(KEYS.reports, existing)) return;
      renderReportHistory();
      renderDashboardSummary();
      const feedback = $("#reportFeedback");
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = preferences.language === "fr"
          ? `Signalement ${report.reference} enregistré. Connexion au service de transmission…`
          : `Report ${report.reference} saved. Connecting to the email delivery service…`;
      }
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      try {
        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'The reporting service could not accept this report.');
        report.emailStatus = result.emailSent ? 'sent' : 'pending-configuration';
        if (feedback) feedback.textContent = result.emailSent
          ? `Report ${report.reference} submitted successfully. Email notification sent to ${REPORTS_EMAIL}.`
          : `Report ${report.reference} is saved, but email has NOT been sent yet. Configure SMTP in email_config.json to enable delivery to ${REPORTS_EMAIL}.`;
        const latest = readReports();
        const savedIndex = latest.findIndex(item => item.reference === report.reference);
        if (savedIndex >= 0) { latest[savedIndex] = { ...latest[savedIndex], emailStatus: report.emailStatus }; saveJSON(KEYS.reports, latest); }
        notify(result.emailSent ? 'Report submitted and email sent.' : 'Report saved; email delivery needs setup.');
      } catch (error) {
        if (feedback) feedback.textContent = `Report ${report.reference} is saved in this browser, but the server/email service is unavailable. It has NOT been emailed to ${REPORTS_EMAIL}. Start the website with START_HYSACAM_TRACKER.bat and configure email_config.json.`;
        notify('Report saved locally, but server delivery failed.');
        console.error('Report submission failed:', error);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
      form.reset();
      reportPhotoData = "";
      if (photoPreviewImage) photoPreviewImage.removeAttribute("src");
      if (photoPreview) photoPreview.hidden = true;
      const counter = $("#descriptionCount");
      if (counter) counter.textContent = "0/1000";
    });
  }

  function initializeProfilePhoto() {
    photoInput = $(
      'input[type="file"][data-profile-photo], #profilePhotoInput'
    );

    if (!photoInput) {
      const avatar = $("#profileAvatarLarge");
      if (!avatar) return;

      const wrapper = avatar.parentElement || avatar;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button profile-photo-trigger";
      button.textContent = "Change profile picture";

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.hidden = true;
      input.id = "profilePhotoInput";

      button.addEventListener("click", () => input.click());

      wrapper.append(button, input);
      photoInput = input;
    }

    $("#chooseProfilePhotoButton")?.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      setText("#profilePhotoFileName", file.name);

      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        notify("Choose a JPG, PNG or WebP image.");
        photoInput.value = "";
        return;
      }

      if (file.size > 1.5 * 1024 * 1024) {
        notify("Choose an image smaller than 1.5 MB.");
        photoInput.value = "";
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        profile.photo = String(reader.result || "");

        if (saveJSON(KEYS.profile, profile)) {
          renderProfile();
          notify("Profile picture saved on this device.");
        }
      };

      reader.onerror = () => {
        notify("Could not read that image.");
      };

      reader.readAsDataURL(file);
    });
  }

  function initialize() {
    renderProfile();
    renderDashboardSummary();
    setText("#settingsProfileSummary", `${profile.name || "Resident"}${profile.email ? ` · ${profile.email}` : ""}${profile.area ? ` · ${profile.area}` : ""}`);
    renderOtherPreferences();
    applyPreferences();

    initializeNavigation();
    initializeSettings();
    initializeReportForm();
    initializeProfilePhoto();
    renderReportHistory();

    const firstTab = $('[data-settings-tab="profile-settings"]');

    if (
      firstTab &&
      !$$("[data-settings-pane]").some(pane => !pane.hidden)
    ) {
      activateSettingsTab(firstTab);
    }

    if (readJSON(KEYS.notice, "") === "dismissed") {
      const notice = $("#serviceNotice");
      if (notice) notice.hidden = true;
    }

    // Show the overview when no page has been selected yet.
    const visiblePage = $$(".page-section").find(
      section => !section.hidden
    );

    if (!visiblePage && $("#overview")) {
      goTo("overview");
    }

    console.info(
      "HYSACAM Kumba Tracker interface initialized."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();