"use strict";

/* HYSACAM Kumba Tracker: landing page map preview
   Light, fast preview of the dustbin map. Tapping a pin opens a summary,
   and "Open full map" goes to map.html (deep-linked to the chosen dustbin). */
(function () {
  const boot = () => init().catch((err) => {
    console.error("Home map failed:", err);
    const s = document.getElementById("map-message");
    if (s) s.textContent = "The map could not start";
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  async function init() {
    const $ = (id) => document.getElementById(id);
    const mapEl = $("dustbin-map"), frame = $("hmc-frame");
    if (!mapEl || !frame) return;

    const say = (t) => { const s = $("map-message"); if (s) s.textContent = t; };
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const cap = (s) => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const withTimeout = (p, ms) => Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
    async function waitFor(test, ms) {
      const end = Date.now() + ms;
      while (Date.now() < end) { try { const v = test(); if (v) return v; } catch {} await sleep(100); }
      try { return test(); } catch { return null; }
    }
    const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

    const loader = $("hmc-load");
    const showLoad = (html) => { if (loader) { loader.hidden = false; loader.innerHTML = `<div>${html}</div>`; } };
    const hideLoad = () => { if (loader) loader.hidden = true; };
    showLoad('<span class="hmc-spin"></span>Loading the Kumba map…');

    /* Leaflet, with a fallback CDN */
    if (!(await waitFor(() => window.L, 4000))) {
      try {
        const css = document.createElement("link");
        css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
        document.head.appendChild(css);
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js");
      } catch {}
    }
    const L = window.L;
    if (!L) { say("The map could not load"); showLoad('The map library could not load<button type="button" onclick="location.reload()">Reload</button>'); return; }

    const GROUPS = {
      available: "Available", full: "Full", pending: "Pending", maintenance: "Maintenance"
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
      const a = Number(r.latitude), b = Number(r.longitude);
      return Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180;
    };
    const fmtDist = (m) => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;

    /* Map: a preview, so page scrolling is never hijacked on phones */
    const KUMBA = [4.6363, 9.4469];
    const touch = L.Browser.mobile || L.Browser.touch;
    const map = L.map(mapEl, {
      zoomControl: false, attributionControl: true, minZoom: 11, maxZoom: 19,
      scrollWheelZoom: false, doubleClickZoom: true, boxZoom: false, keyboard: true,
      dragging: !touch, touchZoom: !touch, tap: false
    }).setView(KUMBA, 13);
    map.attributionControl.setPrefix(false);

    const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
    const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { minZoom: 11, maxZoom: 19, attribution: OSM }).addTo(map);
    const backup = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { minZoom: 11, maxZoom: 19, subdomains: "abcd", attribution: OSM + ' &copy; CARTO' });
    let errs = 0, ok = 0, swapped = false;
    streets.on("tileload", () => { ok++; });
    streets.on("tileerror", () => { errs++; if (!swapped && errs >= 6 && !ok) { swapped = true; map.removeLayer(streets); backup.addTo(map); } });

    $("hmc-zin")?.addEventListener("click", () => map.zoomIn());
    $("hmc-zout")?.addEventListener("click", () => map.zoomOut());
    if (touch) { const h = $("hmc-hint"); if (h) h.textContent = "Tap a pin for details"; }

    const layer = L.layerGroup().addTo(map);
    let bins = [], selected = null, userLL = null, userMarker = null, userCircle = null;
    const byId = new Map();
    const cache = {};
    const pinIcon = (g, sel) => cache[g + sel] || (cache[g + sel] = L.divIcon({
      className: "hm-pin-wrap",
      html: `<span class="hm-pin g-${g}${sel ? " sel" : ""}"><svg viewBox="0 0 36 46" aria-hidden="true"><path d="M18 2C9.7 2 3 8.6 3 16.8 3 28 18 44 18 44s15-16 15-27.2C33 8.6 26.3 2 18 2z"/><circle cx="18" cy="17" r="6.5"/></svg></span>`,
      iconSize: [34, 44], iconAnchor: [17, 42]
    }));

    /* Counters */
    function drawStats() {
      const c = { available: 0, full: 0, pending: 0, maintenance: 0 };
      bins.forEach((b) => { c[b.group]++; });
      $("hmc-stats").innerHTML = Object.keys(GROUPS).map((g) =>
        `<div class="hmc-stat g-${g}"><b>${c[g]}</b><span><i></i>${GROUPS[g]}</span></div>`).join("");
    }

    /* Selected bar */
    const info = $("hmc-info");
    function closeInfo() {
      if (selected) { selected.marker.setIcon(pinIcon(selected.group, false)); selected.marker.setZIndexOffset(0); }
      selected = null; info.hidden = true;
    }
    function select(b) {
      if (selected && selected !== b) { selected.marker.setIcon(pinIcon(selected.group, false)); selected.marker.setZIndexOffset(0); }
      selected = b;
      b.marker.setIcon(pinIcon(b.group, true));
      b.marker.setZIndexOffset(1000);
      const d = userLL ? fmtDist(userLL.distanceTo(L.latLng(b.lat, b.lng))) : "";
      const dir = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=walking`;
      info.innerHTML = `
        <button type="button" class="hmc-x" id="hmc-x" aria-label="Close">×</button>
        <div class="hmc-i-top"><span class="hmc-code">${esc(b.code)}</span><span class="hmc-pill g-${b.group}">${esc(cap(b.status))}</span></div>
        <h3>${esc(b.name)}</h3>
        <p>${esc(b.area)}${d ? ` · <b>${esc(d)} away</b>` : ""}</p>
        <div class="hmc-i-act"><a class="hmc-a primary" href="${dir}" target="_blank" rel="noopener">Directions</a><a class="hmc-a" href="map.html?bin=${encodeURIComponent(b.id)}">View on map</a></div>`;
      info.hidden = false;
      $("hmc-x").addEventListener("click", closeInfo);
      map.panTo([b.lat, b.lng], { animate: true });
    }
    map.on("click", closeInfo);

    function ingest(rows) {
      layer.clearLayers(); bins = []; byId.clear(); selected = null; info.hidden = true;
      rows.forEach((r) => {
        if (!validCoords(r)) return;
        const b = {
          id: String(r.id), code: r.bin_code || `BIN-${String(r.id).slice(0, 8).toUpperCase()}`,
          name: r.name || "Registered collection point", area: r.area || "Kumba",
          status: r.status || "available", group: groupOf(r.status), lat: Number(r.latitude), lng: Number(r.longitude)
        };
        b.marker = L.marker([b.lat, b.lng], { icon: pinIcon(b.group, false), title: `${b.code} - ${b.name}`, keyboard: true, riseOnHover: true });
        if (!L.Browser.mobile) b.marker.bindTooltip(`<b>${esc(b.name)}</b><br>${esc(b.area)}`, { direction: "top", offset: [0, -38], opacity: 0.96, className: "hm-tip" });
        b.marker.on("click", (e) => { if (e.originalEvent) L.DomEvent.stopPropagation(e); select(b); });
        layer.addLayer(b.marker);
        bins.push(b); byId.set(b.id, b);
      });
      drawStats();
      if (bins.length) say(`${bins.length} dustbin locations across Kumba`);
      else say("No dustbin locations are available yet");
    }
    function fitAll() {
      if (!bins.length) return;
      map.fitBounds(L.latLngBounds(bins.map((b) => [b.lat, b.lng])), { padding: [36, 36], maxZoom: 15, animate: false });
    }

    /* Locate */
    $("hmc-locate")?.addEventListener("click", (e) => {
      const btn = e.currentTarget;
      if (!navigator.geolocation) { say("Location is not available in this browser"); return; }
      btn.classList.add("busy"); say("Finding your location…");
      navigator.geolocation.getCurrentPosition((pos) => {
        btn.classList.remove("busy");
        userLL = L.latLng(pos.coords.latitude, pos.coords.longitude);
        if (userMarker) map.removeLayer(userMarker);
        if (userCircle) map.removeLayer(userCircle);
        userCircle = L.circle(userLL, { radius: Math.max(25, Math.min(pos.coords.accuracy || 100, 700)), color: "#2875d8", weight: 1, fillColor: "#2875d8", fillOpacity: 0.1, interactive: false }).addTo(map);
        userMarker = L.marker(userLL, { icon: L.divIcon({ className: "hm-me-wrap", html: '<span class="hm-me"></span>', iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(map);
        let nearest = null, best = Infinity;
        bins.forEach((b) => { const d = userLL.distanceTo(L.latLng(b.lat, b.lng)); if (d < best) { best = d; nearest = b; } });
        if (nearest && best <= 15000) {
          say(`Nearest dustbin is ${fmtDist(best)} away`);
          select(nearest);
          map.fitBounds(L.latLngBounds([userLL, [nearest.lat, nearest.lng]]), { paddingTopLeft: [40, 40], paddingBottomRight: [40, 150], maxZoom: 17 });
        } else {
          map.setView(userLL, 15);
          say(nearest ? "You are far from the mapped dustbins" : "Your location is shown in blue");
        }
      }, (err) => {
        btn.classList.remove("busy");
        say(err.code === 1 ? "Location permission was denied" : "Could not find your location");
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    });

    /* Data (shares the cache with map.html) */
    const CK = "hysacam-map-bins-v1";
    const getClient = () => { try { return (typeof supabaseClient !== "undefined" && supabaseClient) || window.supabaseClient || null; } catch { return window.supabaseClient || null; } };
    async function fetchBins() {
      const client = await waitFor(getClient, 8000);
      if (!client) throw new Error("no client");
      const all = []; let from = 0; const size = 500;
      while (true) {
        const { data, error } = await withTimeout(client.from("bins").select("id, bin_code, name, area, latitude, longitude, status").order("name", { ascending: true }).range(from, from + size - 1), 15000);
        if (error) throw error;
        const page = data || []; all.push(...page);
        if (page.length < size) break; from += size;
      }
      return all;
    }

    let have = false;
    try {
      const c = JSON.parse(localStorage.getItem(CK) || "null");
      if (c && Array.isArray(c.rows) && c.rows.length) { ingest(c.rows); fitAll(); have = true; hideLoad(); }
    } catch {}

    async function refresh() {
      try {
        const rows = await fetchBins();
        const first = !have;
        ingest(rows);
        if (first) fitAll();
        try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), rows })); } catch {}
        have = true; hideLoad();
      } catch (e) {
        console.error("Could not load dustbins:", e);
        if (have) say("Showing saved locations · could not refresh");
        else {
          say("Could not load dustbin locations");
          showLoad('Dustbin locations could not be loaded<button type="button" id="hmc-retry">Try again</button>');
          $("hmc-retry")?.addEventListener("click", () => { showLoad('<span class="hmc-spin"></span>Loading dustbin locations…'); refresh(); });
        }
      }
    }
    refresh();
    document.addEventListener("visibilitychange", () => { if (!document.hidden && have) refresh(); });

    const invalidate = () => requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    [0, 200, 600, 1500].forEach((t) => setTimeout(invalidate, t));
    window.addEventListener("load", invalidate);
    window.addEventListener("resize", invalidate, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(invalidate).observe(mapEl);
  }
})();
function countUp(el, target) {
  let current = 0;
  const step = Math.ceil(target / 40);

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current;
  }, 30);
}
