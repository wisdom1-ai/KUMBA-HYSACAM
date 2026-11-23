"use strict";

/* HYSACAM Kumba Tracker: dustbin map page
   - Map appears immediately; pins load on top
   - Saved locations show instantly, then refresh from the database
   - Timeouts, retries, and fallbacks so the page never sticks on "Loading" */
(function () {
  const boot = () => {
    init().catch((err) => {
      console.error("Map failed to start:", err);
      const s = document.getElementById("map-message");
      if (s) s.textContent = "The map hit an error. Please refresh the page";
      const l = document.getElementById("hm-loading");
      if (l) {
        l.hidden = false;
        l.innerHTML = '<div class="hm-load-card"><b>The map could not start</b><p>Check your connection and try again</p><button type="button" onclick="location.reload()">Reload</button></div>';
      }
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  async function init() {
    const $ = (id) => document.getElementById(id);
    const root = $("hm"), mapEl = $("dustbin-map"), statusEl = $("map-message");
    if (!root || !mapEl) return;

    const say = (t) => { if (statusEl) statusEl.textContent = t; };
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const cap = (s) => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const withTimeout = (p, ms, label) => Promise.race([
      Promise.resolve(p),
      new Promise((_, rej) => setTimeout(() => rej(new Error((label || "Request") + " timed out")), ms))
    ]);
    async function waitFor(test, ms) {
      const end = Date.now() + ms;
      while (Date.now() < end) { try { const v = test(); if (v) return v; } catch {} await sleep(100); }
      try { return test(); } catch { return null; }
    }
    function loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    /* ---------- loading / error overlay ---------- */
    const loadingEl = $("hm-loading");
    const hideLoading = () => { if (loadingEl) loadingEl.hidden = true; };
    const showError = (text, retry) => {
      if (!loadingEl) return;
      loadingEl.hidden = false;
      loadingEl.innerHTML = `<div class="hm-load-card"><b>${esc(text)}</b><p>Check your connection and try again</p>${retry ? '<button type="button" id="hm-retry">Try again</button>' : ""}</div>`;
      const btn = $("hm-retry");
      if (btn) btn.addEventListener("click", () => { hideLoading(); retry(); });
    };

    /* ---------- make sure Leaflet exists (fallback CDN) ---------- */
    if (!(await waitFor(() => window.L, 4000))) {
      try {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
        document.head.appendChild(css);
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js");
      } catch {}
    }
    if (!window.L) { say("The map could not load"); showError("The map library could not load", () => location.reload()); return; }
    const L = window.L;

    /* ---------- status groups ---------- */
    const GROUPS = {
      available:   { label: "Available" },
      full:        { label: "Full" },
      pending:     { label: "Pending collection" },
      maintenance: { label: "Maintenance" }
    };
    const groupOf = (s) => {
      s = String(s || "available").toLowerCase();
      if (s.includes("maint") || s.includes("broken") || s.includes("damage")) return "maintenance";
      if (s.includes("full") || s.includes("overflow")) return "full";
      if (s.includes("pending") || s.includes("collect")) return "pending";
      return "available";
    };
    const validCoords = (r) => {
      if (!r || r.latitude == null || r.longitude == null || r.latitude === "" || r.longitude === "") return false;
      const lat = Number(r.latitude), lng = Number(r.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    };
    const signedIn = () => { try { const c = JSON.parse(localStorage.getItem("hysacam-auth-cache") || "null"); return !!(c && c.a === 1); } catch { return false; } };
    const fmtDist = (m) => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;

    const ICON = {
      pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
      nav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8z"/></svg>',
      flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>'
    };

    /* ---------- map (rotation is optional and never blocks the map) ---------- */
    const KUMBA = [4.6363, 9.4469];
    let hasRotate = typeof L.Map.prototype.setBearing === "function";
    const baseOpts = {
      zoomControl: false, attributionControl: true, minZoom: 11, maxZoom: 19,
      scrollWheelZoom: true, doubleClickZoom: true, touchZoom: true, boxZoom: false,
      keyboard: true, dragging: true
    };
    let map;
    try {
      map = L.map(mapEl, Object.assign({}, baseOpts, hasRotate ? { rotate: true, touchRotate: true, rotateControl: false } : {}));
    } catch (e) {
      console.warn("Rotation unavailable, using a standard map", e);
      hasRotate = false;
      if (mapEl._leaflet_id) { try { delete mapEl._leaflet_id; } catch { mapEl._leaflet_id = undefined; } }
      map = L.map(mapEl, baseOpts);
    }
    map.setView(KUMBA, 13);
    map.attributionControl.setPrefix(false);

    const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
    const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { minZoom: 11, maxZoom: 19, attribution: OSM_ATTR }).addTo(map);
    const backup = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      minZoom: 11, maxZoom: 19, subdomains: "abcd",
      attribution: OSM_ATTR + ' &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
    });
    const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      minZoom: 11, maxZoom: 19, maxNativeZoom: 18, attribution: "Tiles &copy; Esri"
    });

    let sat = false, usingBackup = false, tileErrors = 0, tileOk = 0;
    streets.on("tileload", () => { tileOk++; });
    streets.on("tileerror", () => {
      tileErrors++;
      if (!usingBackup && !sat && tileErrors >= 6 && tileOk === 0) {
        usingBackup = true;
        map.removeLayer(streets);
        backup.addTo(map);
      }
    });

    /* Map is visible straight away; data loads on top */
    hideLoading();
    say("Loading dustbin locations…");

    const layer = L.layerGroup().addTo(map);
    let bins = [];
    const byId = new Map();
    let selected = null;
    let userLL = null, userMarker = null, userCircle = null;
    const f = { q: "", group: "all" };

    /* ---------- markers ---------- */
    const iconCache = {};
    function pinIcon(group, isSelected) {
      const key = group + (isSelected ? "-sel" : "");
      return iconCache[key] || (iconCache[key] = L.divIcon({
        className: "hm-pin-wrap",
        html: `<span class="hm-pin g-${group}${isSelected ? " sel" : ""}"><svg viewBox="0 0 36 46" aria-hidden="true"><path d="M18 2C9.7 2 3 8.6 3 16.8 3 28 18 44 18 44s15-16 15-27.2C33 8.6 26.3 2 18 2z"/><circle cx="18" cy="17" r="6.5"/></svg></span>`,
        iconSize: [34, 44],
        iconAnchor: [17, 42]
      }));
    }

    function ingest(rows) {
      layer.clearLayers();
      bins = [];
      byId.clear();
      rows.forEach((r) => {
        if (!validCoords(r)) return;
        const b = {
          raw: r,
          id: String(r.id),
          code: r.bin_code || `BIN-${String(r.id).slice(0, 8).toUpperCase()}`,
          name: r.name || "Registered collection point",
          area: r.area || "Kumba",
          status: r.status || "available",
          group: groupOf(r.status),
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          marker: null
        };
        b.marker = L.marker([b.lat, b.lng], { icon: pinIcon(b.group, false), title: `${b.code} - ${b.name}`, keyboard: true, riseOnHover: true });
        if (!L.Browser.mobile) b.marker.bindTooltip(`<b>${esc(b.name)}</b><br>${esc(b.area)}`, { direction: "top", offset: [0, -38], opacity: 0.96, className: "hm-tip" });
        b.marker.on("click", () => select(b, { fly: true }));
        bins.push(b);
        byId.set(b.id, b);
      });
      selected = null;
    }

    /* ---------- filters ---------- */
    const matchesQuery = (b) => {
      const q = f.q.trim().toLowerCase();
      return !q || `${b.code} ${b.name} ${b.area} ${b.status}`.toLowerCase().includes(q);
    };
    const matches = (b) => (f.group === "all" || b.group === f.group) && matchesQuery(b);

    function drawChips() {
      const counts = { all: 0 };
      bins.forEach((b) => { if (matchesQuery(b)) { counts.all++; counts[b.group] = (counts[b.group] || 0) + 1; } });
      const present = Object.keys(GROUPS).filter((g) => bins.some((b) => b.group === g));
      const chips = [["all", "All"]].concat(present.map((g) => [g, GROUPS[g].label]));
      $("hm-chips").innerHTML = chips.map(([g, label]) =>
        `<button type="button" class="hm-chip${g === "all" ? "" : " g-" + g}" data-g="${g}" aria-pressed="${f.group === g}">${g === "all" ? "" : '<i class="hm-dot-c"></i>'}${esc(label)}<em>${counts[g] || 0}</em></button>`).join("");
    }

    function render() {
      let n = 0;
      bins.forEach((b) => {
        if (matches(b)) { if (!layer.hasLayer(b.marker)) layer.addLayer(b.marker); n++; }
        else { layer.removeLayer(b.marker); if (selected === b) closeSheet(); }
      });
      drawChips();
      const filtered = f.q.trim() || f.group !== "all";
      const missing = window.__hmMissing || 0;
      if (!bins.length) say("No dustbin locations are available yet");
      else if (!n) say("No dustbins match your search");
      else if (filtered) say(`${n} of ${bins.length} dustbins shown`);
      else say(`${bins.length} dustbin locations${missing ? ` · ${missing} without GPS` : ""}`);
      $("hm-clear").hidden = !f.q;
      return n;
    }

    function fitAll() {
      const shown = bins.filter(matches);
      if (!shown.length) return;
      const bounds = L.latLngBounds(shown.map((b) => [b.lat, b.lng]));
      const mobile = window.innerWidth < 760;
      map.fitBounds(bounds, { paddingTopLeft: [36, mobile ? 150 : 140], paddingBottomRight: [36, 48], maxZoom: 16, animate: true });
    }

    /* ---------- details sheet ---------- */
    const sheet = $("hm-sheet");
    const cleanedCache = new Map();
    const distanceTo = (b) => userLL ? userLL.distanceTo(L.latLng(b.lat, b.lng)) : null;

    function renderSheet(b) {
      const d = distanceTo(b);
      const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=walking`;
      sheet.innerHTML = `
        <button type="button" class="hm-grab" id="hm-grab" aria-label="Close details"><span></span></button>
        <button type="button" class="hm-s-close" id="hm-s-close" aria-label="Close details">×</button>
        <div class="hm-s-tags"><span class="hm-code">${esc(b.code)}</span><span class="hm-pill g-${b.group}">${esc(cap(b.status))}</span></div>
        <h3 id="hm-s-title">${esc(b.name)}</h3>
        <p class="hm-s-area">${ICON.pin}<span>${esc(b.area)}</span>${d != null ? `<span class="hm-sep">•</span><span class="hm-away">${esc(fmtDist(d))} away</span>` : ""}</p>
        <dl class="hm-s-grid">
          <div><dt>Status</dt><dd>${esc(GROUPS[b.group].label)}</dd></div>
          <div><dt>Coordinates</dt><dd>${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}</dd></div>
          <div id="hm-last" hidden><dt>Last cleaned</dt><dd id="hm-last-v">Checking…</dd></div>
        </dl>
        <div class="hm-s-actions">
          <a class="hm-btn primary" href="${dirUrl}" target="_blank" rel="noopener">${ICON.nav}Directions</a>
          <a class="hm-btn" href="report.html">${ICON.flag}Report issue</a>
        </div>`;
      sheet.setAttribute("aria-labelledby", "hm-s-title");
      loadLastCleaned(b);
    }

    const getClient = () => {
      try { return (typeof supabaseClient !== "undefined" && supabaseClient) || window.supabaseClient || null; } catch { return window.supabaseClient || null; }
    };

    async function loadLastCleaned(b) {
      if (!signedIn()) return;
      const row = $("hm-last"), val = $("hm-last-v");
      const client = getClient();
      if (!row || !val || !client) return;
      row.hidden = false;
      const show = (rec) => {
        if (selected !== b) return;
        if (!rec) { val.textContent = "No record yet"; return; }
        const t = new Date(rec.cleaned_at);
        val.textContent = isNaN(t.getTime()) ? "No record yet" : t.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
      };
      if (cleanedCache.has(b.id)) { show(cleanedCache.get(b.id)); return; }
      try {
        const { data, error } = await withTimeout(
          client.from("cleaning_records").select("cleaned_at").eq("bin_id", b.raw.id).eq("verified", true).order("cleaned_at", { ascending: false }).limit(1),
          10000, "Cleaning record"
        );
        if (error) throw error;
        const rec = (data && data[0]) || null;
        cleanedCache.set(b.id, rec);
        show(rec);
      } catch { if (selected === b) row.hidden = true; }
    }

    function openSheet() {
      sheet.classList.add("open");
      root.classList.add("sheet-open");
      requestAnimationFrame(() => root.style.setProperty("--sheet-h", sheet.offsetHeight + "px"));
    }
    function closeSheet() {
      if (selected) { selected.marker.setIcon(pinIcon(selected.group, false)); selected.marker.setZIndexOffset(0); }
      selected = null;
      sheet.classList.remove("open");
      root.classList.remove("sheet-open");
      root.style.setProperty("--sheet-h", "0px");
    }

    function select(b, opts = {}) {
      if (!b) return;
      if (selected && selected !== b) { selected.marker.setIcon(pinIcon(selected.group, false)); selected.marker.setZIndexOffset(0); }
      selected = b;
      if (!layer.hasLayer(b.marker)) layer.addLayer(b.marker);
      b.marker.setIcon(pinIcon(b.group, true));
      b.marker.setZIndexOffset(1000);
      renderSheet(b);
      openSheet();
      document.dispatchEvent(new CustomEvent("hysacam:bin-selected", { detail: { bin: b.raw } }));
      if (opts.fly) {
        const mobile = window.innerWidth < 760;
        const z = Math.max(map.getZoom(), 16);
        requestAnimationFrame(() => {
          const h = mobile ? sheet.offsetHeight : 0;
          const p = map.project([b.lat, b.lng], z).add([0, mobile ? (h - 140) / 2 : 0]);
          map.flyTo(map.unproject(p, z), z, { duration: 0.6 });
        });
      }
    }

    sheet.addEventListener("click", (e) => { if (e.target.closest("#hm-s-close, #hm-grab")) closeSheet(); });
    let touchY = null;
    sheet.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener("touchend", (e) => {
      if (touchY === null) return;
      const dy = e.changedTouches[0].clientY - touchY; touchY = null;
      if (dy > 70) closeSheet();
    }, { passive: true });
    map.on("click", () => { closeSheet(); hideSuggest(); });

    /* ---------- search with suggestions ---------- */
    const input = $("hm-q"), suggest = $("hm-suggest");
    let activeIdx = -1, suggestItems = [];

    function hideSuggest() { suggest.hidden = true; activeIdx = -1; input.setAttribute("aria-expanded", "false"); }
    function drawSuggest() {
      const q = f.q.trim();
      if (!q) { hideSuggest(); return; }
      suggestItems = bins.filter(matches).slice(0, 6);
      if (!suggestItems.length) {
        suggest.innerHTML = '<li class="hm-sg-empty">No dustbins match your search</li>';
      } else {
        suggest.innerHTML = suggestItems.map((b, i) =>
          `<li role="option" data-id="${esc(b.id)}" class="${i === activeIdx ? "active" : ""}"><span class="hm-sg-dot g-${b.group}"></span><span class="hm-sg-t"><b>${esc(b.name)}</b><small>${esc(b.code)} · ${esc(b.area)}</small></span></li>`).join("");
      }
      suggest.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    function pick(b) { hideSuggest(); input.blur(); select(b, { fly: true }); }

    input.addEventListener("input", () => { f.q = input.value; activeIdx = -1; render(); drawSuggest(); });
    input.addEventListener("focus", () => { if (f.q.trim()) drawSuggest(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (suggest.hidden || !suggestItems.length) return;
        e.preventDefault();
        activeIdx = (activeIdx + (e.key === "ArrowDown" ? 1 : -1) + suggestItems.length) % suggestItems.length;
        drawSuggest();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const b = suggestItems[Math.max(activeIdx, 0)];
        if (b) pick(b);
      }
    });
    suggest.addEventListener("pointerdown", (e) => e.preventDefault());
    suggest.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-id]");
      if (li) pick(byId.get(li.dataset.id));
    });
    $("hm-clear").addEventListener("click", () => { input.value = ""; f.q = ""; render(); hideSuggest(); input.focus(); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".hm-search")) hideSuggest(); });

    $("hm-chips").addEventListener("click", (e) => {
      const chip = e.target.closest(".hm-chip");
      if (!chip) return;
      f.group = chip.dataset.g;
      render();
      hideSuggest();
      if (bins.some(matches)) fitAll();
    });

    /* ---------- controls ---------- */
    $("hm-zoom-in").addEventListener("click", () => map.zoomIn());
    $("hm-zoom-out").addEventListener("click", () => map.zoomOut());
    $("hm-fit").addEventListener("click", () => { closeSheet(); if (bins.some(matches)) fitAll(); else map.setView(KUMBA, 13); });

    $("hm-layers").addEventListener("click", (e) => {
      sat = !sat;
      const base = usingBackup ? backup : streets;
      if (sat) { map.removeLayer(base); satellite.addTo(map); }
      else { map.removeLayer(satellite); base.addTo(map); }
      root.classList.toggle("is-sat", sat);
      e.currentTarget.setAttribute("aria-pressed", String(sat));
      e.currentTarget.setAttribute("aria-label", sat ? "Switch to street map" : "Switch to satellite view");
    });

    const compass = $("hm-compass");
    if (hasRotate && compass) {
      map.on("rotate", () => {
        const bearing = map.getBearing ? map.getBearing() : 0;
        compass.hidden = Math.abs(bearing) < 1;
        compass.firstElementChild.style.transform = `rotate(${-bearing}deg)`;
      });
      compass.addEventListener("click", () => map.setBearing(0));
    }

    $("hm-locate").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      if (!navigator.geolocation) { say("Location is not available in this browser"); return; }
      btn.classList.add("busy");
      say("Finding your location…");
      navigator.geolocation.getCurrentPosition((pos) => {
        btn.classList.remove("busy");
        userLL = L.latLng(pos.coords.latitude, pos.coords.longitude);
        if (userMarker) map.removeLayer(userMarker);
        if (userCircle) map.removeLayer(userCircle);
        userCircle = L.circle(userLL, { radius: Math.max(25, Math.min(pos.coords.accuracy || 100, 700)), color: "#2875d8", weight: 1, fillColor: "#2875d8", fillOpacity: 0.1, interactive: false }).addTo(map);
        userMarker = L.marker(userLL, { icon: L.divIcon({ className: "hm-me-wrap", html: '<span class="hm-me"></span>', iconSize: [20, 20], iconAnchor: [10, 10] }), keyboard: false, interactive: false, zIndexOffset: 500 }).addTo(map);

        const pool = bins.filter(matches);
        let nearest = null, best = Infinity;
        pool.forEach((b) => { const d = userLL.distanceTo(L.latLng(b.lat, b.lng)); if (d < best) { best = d; nearest = b; } });
        if (nearest && best <= 15000) {
          say(`Nearest dustbin is ${fmtDist(best)} away`);
          select(nearest, { fly: false });
          const mobile = window.innerWidth < 760;
          requestAnimationFrame(() => {
            map.fitBounds(L.latLngBounds([userLL, [nearest.lat, nearest.lng]]), {
              paddingTopLeft: [40, mobile ? 150 : 140], paddingBottomRight: [40, (mobile ? sheet.offsetHeight : 0) + 40], maxZoom: 17, animate: true
            });
          });
        } else {
          map.setView(userLL, Math.max(map.getZoom(), 15), { animate: true });
          say(nearest ? "You are far from the mapped dustbins" : "Your location is shown in blue");
        }
      }, (err) => {
        btn.classList.remove("busy");
        say(err.code === 1 ? "Location permission was denied. Allow location access to use this" : "Could not find your location. Check your device settings and try again");
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!suggest.hidden) hideSuggest(); else closeSheet();
    });

    /* Other pages can ask the map to show a dustbin */
    document.addEventListener("hysacam:show-bin", (e) => {
      const b = byId.get(String(e.detail && e.detail.binId));
      if (!b) { say("This collection point has no verified GPS location yet"); return; }
      f.q = ""; f.group = "all"; input.value = ""; render();
      select(b, { fly: true });
    });

    /* ---------- data ---------- */
    const CK = "hysacam-map-bins-v1";

    async function fetchBins() {
      const client = await waitFor(getClient, 8000);
      if (!client) throw new Error("Database client not available");
      const all = [], size = 500;
      let from = 0;
      while (true) {
        const { data, error } = await withTimeout(
          client.from("bins")
            .select("id, bin_code, name, area, latitude, longitude, status")
            .order("name", { ascending: true })
            .range(from, from + size - 1),
          15000, "Loading dustbins"
        );
        if (error) throw error;
        const page = data || [];
        all.push(...page);
        if (page.length < size) break;
        from += size;
      }
      return all;
    }

    function useRows(rows, firstFit) {
      const keepId = selected ? selected.id : null;
      window.__hmMissing = rows.filter((r) => !validCoords(r)).length;
      ingest(rows);
      render();
      if (keepId && byId.has(keepId)) {
        const b = byId.get(keepId);
        selected = b;
        b.marker.setIcon(pinIcon(b.group, true));
        b.marker.setZIndexOffset(1000);
        renderSheet(b);
      } else if (keepId) closeSheet();
      if (firstFit) fitAll();
    }

    function deepLink() {
      let want = "";
      try { want = (new URLSearchParams(location.search).get("bin") || decodeURIComponent(location.hash.replace(/^#/, ""))).trim().toLowerCase(); } catch {}
      if (!want) return;
      const b = bins.find((x) => x.id.toLowerCase() === want || x.code.toLowerCase() === want);
      if (b) select(b, { fly: true });
    }

    let hadData = false, refreshing = false;
    try {
      const c = JSON.parse(localStorage.getItem(CK) || "null");
      if (c && Array.isArray(c.rows) && c.rows.length) { useRows(c.rows, true); hadData = true; deepLink(); }
    } catch {}

    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const rows = await fetchBins();
        const first = !hadData;
        useRows(rows, first);
        try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), rows })); } catch {}
        hideLoading();
        if (first) deepLink();
        hadData = true;
        if (!bins.length) say(rows.length ? "Dustbins are registered, but none has verified map coordinates yet" : "No dustbins have been registered yet");
      } catch (error) {
        console.error("Could not load dustbin locations:", error);
        if (bins.length) say("Showing saved locations · could not refresh");
        else {
          say("Could not load dustbin locations");
          showError("Dustbin locations could not be loaded", () => { say("Loading dustbin locations…"); refresh(); });
        }
      } finally {
        refreshing = false;
      }
    }
    refresh();

    /* Keep pins fresh while the page is open */
    setInterval(() => { if (!document.hidden) refresh(); }, 90000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && hadData) refresh(); });
    window.addEventListener("online", () => refresh());

    /* ---------- layout upkeep ---------- */
    const invalidate = () => requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    [0, 150, 500, 1200].forEach((t) => setTimeout(invalidate, t));
    window.addEventListener("load", invalidate);
    window.addEventListener("resize", invalidate, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(invalidate, 250), { passive: true });
    if (window.ResizeObserver) new ResizeObserver(invalidate).observe(mapEl);
  }
})();
