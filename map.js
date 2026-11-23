"use strict";

/* HYSACAM Kumba Tracker: dustbin map (used on the home page and the Map page).
   Everything the map needs (styles and controls) is created here, so this is the only file to replace.
   Saved locations show instantly, then refresh from the database. */
document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.getElementById("dustbin-map");
  const statusEl = document.getElementById("map-message");
  if (!mapElement) return;
  const mapFrame = mapElement.parentElement;
  if (!mapFrame || mapFrame.dataset.hm === "1") return;
  mapFrame.dataset.hm = "1";

  const FULL = !!mapFrame.closest(".big");            // Map page = full experience, home page = compact map
  const $ = (id) => document.getElementById(id);
  const say = (t) => { if (statusEl) statusEl.textContent = t; };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cap = (s) => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ---------- styles ---------- */
  const css = `
.map-frame.hm{position:relative;isolation:isolate;overflow:hidden;background:#e8efe9}
.hm #dustbin-map{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;border-radius:0;background:#e8efe9;z-index:1}
.home-map.big .map-frame.hm-full{height:calc(100vh - 262px);height:calc(100dvh - 262px - env(safe-area-inset-bottom));min-height:380px}
@media(min-width:901px){.home-map.big .map-frame.hm-full{height:calc(100vh - 230px);height:calc(100dvh - 230px);min-height:480px}}

.hm-top{position:absolute;z-index:900;top:12px;left:12px;right:12px;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.hm-top>*{pointer-events:auto}
@media(min-width:760px){.hm-full .hm-top{right:auto;width:420px}}
.hm-compact .hm-top{top:10px;left:10px;right:10px}
.hm-search{position:relative}
.hm-search>svg{position:absolute;left:15px;top:50%;width:20px;height:20px;margin-top:-10px;stroke:#5c6b62;pointer-events:none}
.hm-search input{display:block;width:100%;height:50px;padding:0 46px 0 44px;border:0;border-radius:16px;background:#fff;box-shadow:0 6px 20px rgba(8,40,24,.2);font-size:16px;font-weight:500;color:#17231d;-webkit-appearance:none;appearance:none}
.hm-compact .hm-search input{height:44px;border-radius:14px}
.hm-search input::placeholder{color:#7a897f}
.hm-search input:focus{outline:2px solid rgba(8,119,71,.45)}
.hm-clear{position:absolute;right:9px;top:50%;width:32px;height:32px;margin-top:-16px;display:grid;place-items:center;border:0;border-radius:50%;background:#eef5f0;color:#17231d;font-size:19px;line-height:1;cursor:pointer}
.hm-clear[hidden]{display:none}
.hm-suggest{position:absolute;left:0;right:0;top:100%;margin:6px 0 0;padding:6px;list-style:none;max-height:300px;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 14px 34px rgba(8,40,24,.26)}
.hm-suggest[hidden]{display:none}
.hm-suggest li{display:flex;align-items:center;gap:12px;padding:11px 10px;border-radius:12px;cursor:pointer}
.hm-suggest li:hover,.hm-suggest li.active{background:#eef6f1}
.hm-sg-t{min-width:0}
.hm-sg-t b{display:block;font-size:14.5px;color:#17231d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-sg-t small{display:block;margin-top:1px;font-size:12px;color:#5c6b62;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-sg-dot{flex:0 0 12px;width:12px;height:12px;border-radius:50%;background:var(--c)}
.hm-suggest li.hm-sg-empty{display:block;padding:14px 10px;text-align:center;font-size:13px;color:#5c6b62;cursor:default}
.hm-suggest li.hm-sg-empty:hover{background:none}

.hm-chips{display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:2px 2px 6px;margin:0 -2px}
.hm-chips::-webkit-scrollbar{display:none}
.hm-compact .hm-chips{display:none}
.hm-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 13px;border:0;border-radius:999px;background:#fff;box-shadow:0 3px 12px rgba(8,40,24,.18);font:inherit;font-size:13px;font-weight:700;color:#26372d;cursor:pointer;white-space:nowrap}
.hm-chip em{font-style:normal;font-size:11.5px;font-weight:700;padding:2px 7px;border-radius:999px;background:#eef5f0;color:#45544b}
.hm-chip[aria-pressed="true"]{background:#087747;color:#fff}
.hm-chip[aria-pressed="true"] em{background:rgba(255,255,255,.22);color:#fff}
.hm-dot-c{display:block;width:10px;height:10px;border-radius:50%;background:var(--c)}
.hm-chip[aria-pressed="true"] .hm-dot-c{box-shadow:0 0 0 2px #fff}

.hm-ctrl{position:absolute;z-index:900;right:12px;bottom:34px;display:flex;flex-direction:column;gap:10px}
.hm-compact .hm-ctrl{right:10px;bottom:30px;gap:8px}
.hm-grp{display:flex;flex-direction:column;overflow:hidden;border-radius:14px;background:#fff;box-shadow:0 4px 16px rgba(8,40,24,.22)}
.hm-grp button+button{border-top:1px solid #e6eee9}
.hm-cbtn{display:grid;place-items:center;width:46px;height:46px;padding:0;border:0;background:#fff;color:#17231d;font-size:24px;font-weight:500;line-height:1;cursor:pointer}
.hm-compact .hm-cbtn{width:42px;height:42px}
.hm-cbtn:active{background:#e6f4ec}
.hm-cbtn svg{width:22px;height:22px}
.hm-solo{border-radius:14px;box-shadow:0 4px 16px rgba(8,40,24,.22)}
.hm-cbtn[aria-pressed="true"]{background:#087747;color:#fff}
.hm-cbtn.busy svg{animation:hmSpin 1s linear infinite}
.hm-cbtn[hidden]{display:none}
.hm-compact #hm-layers,.hm-compact #hm-fit,.hm-compact #hm-compass{display:none}
.hm-compass svg{transition:transform .15s}
.hm-compact.sheet-open .hm-ctrl{display:none}
@media(max-width:759px){.hm-full.sheet-open .hm-ctrl{display:none}}

.hm .leaflet-control-attribution{margin:0;padding:2px 8px;border-top-left-radius:10px;background:rgba(255,255,255,.85);font-size:10.5px}
.hm-compact.sheet-open .leaflet-bottom{margin-bottom:var(--sheet-h,0)}
@media(max-width:759px){.hm-full.sheet-open .leaflet-bottom{margin-bottom:var(--sheet-h,0)}}

.hm-pin-wrap{background:none;border:0}
.hm-pin{position:relative;display:block;width:34px;height:44px;transform-origin:50% 100%;transition:transform .18s ease;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}
.hm-pin svg{display:block;width:100%;height:100%}
.hm-pin path{fill:var(--c);stroke:#fff;stroke-width:2.5;stroke-linejoin:round}
.hm-pin circle{fill:#fff;stroke:none}
.hm-pin.sel{transform:scale(1.24)}
.hm-pin.sel::after{content:"";position:absolute;left:50%;bottom:-4px;width:30px;height:10px;margin-left:-15px;border-radius:50%;background:var(--c);opacity:.35;animation:hmRing 1.6s ease-out infinite;z-index:-1}
.hm .g-available,.hm-pin.g-available,.hm-suggest .g-available{--c:#16a34a;--bg:#d9f5e3;--fg:#0b7a3e}
.hm .g-full,.hm-pin.g-full,.hm-suggest .g-full{--c:#dc2626;--bg:#fde0de;--fg:#c62828}
.hm .g-pending,.hm-pin.g-pending,.hm-suggest .g-pending{--c:#f59e0b;--bg:#ffedc7;--fg:#b45309}
.hm .g-maintenance,.hm-pin.g-maintenance,.hm-suggest .g-maintenance{--c:#2563eb;--bg:#dbeafe;--fg:#1d4ed8}
.hm-me-wrap{background:none;border:0}
.hm-me{display:block;width:20px;height:20px;border-radius:50%;background:#2875d8;border:3px solid #fff;box-shadow:0 0 0 0 rgba(40,117,216,.55);animation:hmMe 2s ease-out infinite}
.hm-tip{padding:7px 10px;border:0;border-radius:10px;box-shadow:0 6px 18px rgba(8,40,24,.25);font-family:inherit;font-size:12.5px;line-height:1.35;color:#17231d}
.hm-tip::before{display:none}

.hm-sheet{position:absolute;z-index:950;left:0;right:0;bottom:0;padding:6px 18px calc(18px + env(safe-area-inset-bottom));background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -12px 36px rgba(8,40,24,.24);transform:translateY(106%);visibility:hidden;transition:transform .3s cubic-bezier(.22,.8,.3,1),visibility 0s linear .3s}
.hm-sheet.open{transform:none;visibility:visible;transition:transform .3s cubic-bezier(.22,.8,.3,1)}
@media(min-width:760px){.hm-full .hm-sheet{left:12px;right:auto;bottom:12px;width:384px;padding:18px 18px 18px;border-radius:22px}.hm-full .hm-grab{display:none}}
.hm-compact .hm-sheet{left:10px;right:10px;bottom:10px;padding:8px 16px 14px;border-radius:18px}
.hm-grab{display:block;width:100%;height:20px;padding:0;border:0;background:none;cursor:pointer}
.hm-grab span{display:block;width:42px;height:4px;margin:8px auto 0;border-radius:4px;background:#d3ddd7}
.hm-s-close{position:absolute;top:12px;right:12px;width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:50%;background:#eef5f0;color:#17231d;font-size:22px;line-height:1;cursor:pointer}
.hm-s-tags{display:flex;align-items:center;gap:8px;margin:2px 44px 8px 0;flex-wrap:wrap}
.hm-code{padding:4px 10px;border-radius:8px;background:#eef2f0;font-size:11.5px;font-weight:800;letter-spacing:.4px;color:#33453a}
.hm-pill{padding:4px 11px;border-radius:999px;background:var(--bg);color:var(--fg);font-size:11.5px;font-weight:800}
.hm-sheet h3{margin:0 0 6px;font-size:20px;line-height:1.2;color:#17231d;overflow-wrap:anywhere}
.hm-compact .hm-sheet h3{font-size:17px}
.hm-s-area{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0 0 14px;font-size:13.5px;color:#45544b}
.hm-s-area svg{flex:0 0 16px;width:16px;height:16px;stroke:#087747}
.hm-compact .hm-s-area{margin-bottom:12px}
.hm-sep{color:#a3b1a8}
.hm-away{font-weight:700;color:#087747}
.hm-s-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}
.hm-s-grid div{padding:11px 12px;border-radius:14px;background:#f5f9f6}
.hm-s-grid div[hidden]{display:none}
.hm-s-grid dt{margin:0;font-size:11.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:#6a796f}
.hm-s-grid dd{margin:3px 0 0;font-size:13.5px;font-weight:700;color:#17231d;overflow-wrap:anywhere}
.hm-s-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hm-btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 12px;border:1.5px solid #087747;border-radius:14px;background:#fff;font-size:15px;font-weight:800;color:#087747;text-decoration:none}
.hm-compact .hm-btn{min-height:44px;font-size:14px}
.hm-btn svg{width:19px;height:19px}
.hm-btn.primary{background:#087747;color:#fff}
.hm-btn:active{transform:scale(.98)}

.hm-loading{position:absolute;z-index:1000;top:0;right:0;bottom:0;left:0;display:grid;place-items:center;padding:20px;background:rgba(232,239,233,.86);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.hm-loading[hidden]{display:none}
.hm-load-card{max-width:300px;padding:24px 22px;text-align:center;background:#fff;border-radius:20px;box-shadow:0 12px 34px rgba(8,40,24,.2)}
.hm-load-card b{display:block;font-size:15px;color:#17231d}
.hm-load-card p{margin:6px 0 0;font-size:13px;color:#5c6b62}
.hm-load-card button{margin-top:14px;padding:11px 22px;border:0;border-radius:12px;background:#087747;color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
.hm-spin{display:block;width:34px;height:34px;margin:0 auto 12px;border:3px solid #cfe6d7;border-top-color:#087747;border-radius:50%;animation:hmSpin .8s linear infinite}

@keyframes hmSpin{to{transform:rotate(360deg)}}
@keyframes hmRing{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.6);opacity:0}}
@keyframes hmMe{0%{box-shadow:0 0 0 0 rgba(40,117,216,.55)}100%{box-shadow:0 0 0 18px rgba(40,117,216,0)}}
@media(prefers-reduced-motion:reduce){.hm-pin.sel::after,.hm-me,.hm-spin,.hm-cbtn.busy svg{animation:none}.hm-sheet,.hm-pin{transition:none}}`;
  if (!document.getElementById("hm-style")) {
    const style = document.createElement("style");
    style.id = "hm-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------- interface ---------- */
  mapFrame.classList.add("hm", FULL ? "hm-full" : "hm-compact");
  mapFrame.insertAdjacentHTML("beforeend", `
    <div class="hm-top">
      <div class="hm-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="hm-q" type="search" placeholder="${FULL ? "Search dustbin, street or area" : "Search dustbins"}" aria-label="Search dustbin, street or area" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="hm-suggest" enterkeyhint="search">
        <button id="hm-clear" class="hm-clear" type="button" aria-label="Clear search" hidden>×</button>
        <ul id="hm-suggest" class="hm-suggest" role="listbox" hidden></ul>
      </div>
      <div id="hm-chips" class="hm-chips" role="group" aria-label="Filter by status"></div>
    </div>
    <div class="hm-ctrl">
      <button type="button" id="hm-compass" class="hm-cbtn hm-solo hm-compass" aria-label="Reset map to north" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 4 9H8z"/><path d="m12 21-4-9h8z"/></svg></button>
      <button type="button" id="hm-layers" class="hm-cbtn hm-solo" aria-label="Switch to satellite view" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg></button>
      <button type="button" id="hm-fit" class="hm-cbtn hm-solo" aria-label="Show all dustbins"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      <button type="button" id="hm-locate" class="hm-cbtn hm-solo" aria-label="Show my location and the nearest dustbin"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button>
      <div class="hm-grp"><button type="button" id="hm-zoom-in" class="hm-cbtn" aria-label="Zoom in">+</button><button type="button" id="hm-zoom-out" class="hm-cbtn" aria-label="Zoom out">−</button></div>
    </div>
    <div id="hm-sheet" class="hm-sheet" role="dialog" aria-modal="false" aria-label="Dustbin details"></div>
    <div id="hm-loading" class="hm-loading" hidden></div>`);

  const loadingEl = $("hm-loading");
  const showLoading = (text) => { loadingEl.hidden = false; loadingEl.innerHTML = `<div class="hm-load-card"><span class="hm-spin"></span><b>${esc(text)}</b></div>`; };
  const hideLoading = () => { loadingEl.hidden = true; };
  const showError = (text, retry) => {
    loadingEl.hidden = false;
    loadingEl.innerHTML = `<div class="hm-load-card"><b>${esc(text)}</b><p>Check your connection and try again</p>${retry ? '<button type="button" id="hm-retry">Try again</button>' : ""}</div>`;
    $("hm-retry")?.addEventListener("click", retry);
  };

  if (!window.L) { say("The map could not load. Check your internet connection and reload the page."); showError("The map could not load"); return; }
  const client = typeof supabaseClient !== "undefined" ? supabaseClient : window.supabaseClient;
  if (!client) { say("The map database connection is not configured."); showError("The map database is not available"); return; }

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
    if (r.latitude === null || r.latitude === undefined || r.latitude === "" || r.longitude === null || r.longitude === undefined || r.longitude === "") return false;
    const lat = Number(r.latitude), lng = Number(r.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  };
  const signedIn = () => { try { const c = JSON.parse(localStorage.getItem("hysacam-auth-cache") || "null"); return !!(c && c.a === 1); } catch { return false; } };
  const fmtDist = (m) => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;

  const ICON = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    nav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8z"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>'
  };

  /* ---------- map ---------- */
  const hasRotate = typeof L.Map.prototype.setBearing === "function";
  const map = L.map(mapElement, {
    zoomControl: false,
    attributionControl: true,
    minZoom: 11,
    maxZoom: 19,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    boxZoom: false,
    keyboard: true,
    dragging: true,
    rotate: hasRotate,
    touchRotate: hasRotate,
    rotateControl: false
  }).setView([4.6363, 9.4469], 13);
  map.attributionControl.setPrefix(false);

  const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 11, maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);
  const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    minZoom: 11, maxZoom: 19, maxNativeZoom: 18,
    attribution: "Tiles &copy; Esri"
  });

  const layer = L.layerGroup().addTo(map);
  let bins = [];
  const byId = new Map();
  let selected = null;
  let userLL = null, userMarker = null, userCircle = null;
  let missing = 0;
  const f = { q: "", group: "all" };

  /* Where the details card sits decides how the map is framed around it */
  const bottomMode = () => !FULL || window.innerWidth < 760;
  const topPad = () => FULL ? 150 : 66;

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
    missing = rows.filter((r) => !validCoords(r)).length;
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
    if (FULL) drawChips();
    const filtered = f.q.trim() || f.group !== "all";
    if (!bins.length) say("No dustbin locations are available yet");
    else if (!n) say("No dustbins match your search");
    else if (filtered) say(`${n} of ${bins.length} dustbins shown`);
    else say(`Showing ${bins.length} registered dustbin location${bins.length === 1 ? "" : "s"} around Kumba${missing ? ` · ${missing} without GPS coordinates` : ""}`);
    $("hm-clear").hidden = !f.q;
    return n;
  }

  function fitAll() {
    const shown = bins.filter(matches);
    if (!shown.length) return;
    const bounds = L.latLngBounds(shown.map((b) => [b.lat, b.lng]));
    const desktopFull = FULL && window.innerWidth >= 760;
    map.fitBounds(bounds, {
      paddingTopLeft: desktopFull ? [440, 40] : [36, topPad()],
      paddingBottomRight: [36, 48],
      maxZoom: 16,
      animate: true
    });
  }

  /* ---------- details card ---------- */
  const sheet = $("hm-sheet");
  const cleanedCache = new Map();
  const distanceTo = (b) => userLL ? userLL.distanceTo(L.latLng(b.lat, b.lng)) : null;

  function renderSheet(b) {
    const d = distanceTo(b);
    const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=walking`;
    const head = `
      <button type="button" class="hm-grab" id="hm-grab" aria-label="Close details"><span></span></button>
      <button type="button" class="hm-s-close" id="hm-s-close" aria-label="Close details">×</button>
      <div class="hm-s-tags"><span class="hm-code">${esc(b.code)}</span><span class="hm-pill g-${b.group}">${esc(cap(b.status))}</span></div>
      <h3 id="hm-s-title">${esc(b.name)}</h3>
      <p class="hm-s-area">${ICON.pin}<span>${esc(b.area)}</span>${d != null ? `<span class="hm-sep">•</span><span class="hm-away">${esc(fmtDist(d))} away</span>` : ""}</p>`;
    if (FULL) {
      sheet.innerHTML = head + `
        <dl class="hm-s-grid">
          <div><dt>Status</dt><dd>${esc(GROUPS[b.group].label)}</dd></div>
          <div><dt>Coordinates</dt><dd>${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}</dd></div>
          <div id="hm-last" hidden><dt>Last cleaned</dt><dd id="hm-last-v">Checking…</dd></div>
        </dl>
        <div class="hm-s-actions">
          <a class="hm-btn primary" href="${dirUrl}" target="_blank" rel="noopener">${ICON.nav}Directions</a>
          <a class="hm-btn" href="report.html">${ICON.flag}Report issue</a>
        </div>`;
      loadLastCleaned(b);
    } else {
      sheet.innerHTML = head + `
        <div class="hm-s-actions">
          <a class="hm-btn primary" href="map.html?bin=${encodeURIComponent(b.id)}">${ICON.map}View on map</a>
          <a class="hm-btn" href="${dirUrl}" target="_blank" rel="noopener">${ICON.nav}Directions</a>
        </div>`;
    }
    sheet.setAttribute("aria-labelledby", "hm-s-title");
  }

  async function loadLastCleaned(b) {
    if (!signedIn()) return;
    const row = $("hm-last"), val = $("hm-last-v");
    if (!row || !val) return;
    row.hidden = false;
    const show = (rec) => {
      if (selected !== b) return;
      const t = rec ? new Date(rec.cleaned_at) : null;
      val.textContent = t && !isNaN(t.getTime()) ? t.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "No record yet";
    };
    if (cleanedCache.has(b.id)) { show(cleanedCache.get(b.id)); return; }
    try {
      const { data, error } = await client.from("cleaning_records").select("cleaned_at").eq("bin_id", b.raw.id).eq("verified", true).order("cleaned_at", { ascending: false }).limit(1);
      if (error) throw error;
      const rec = (data && data[0]) || null;
      cleanedCache.set(b.id, rec);
      show(rec);
    } catch { if (selected === b) row.hidden = true; }
  }

  function openSheet() {
    sheet.classList.add("open");
    mapFrame.classList.add("sheet-open");
    requestAnimationFrame(() => mapFrame.style.setProperty("--sheet-h", sheet.offsetHeight + "px"));
  }
  function closeSheet() {
    if (selected) { selected.marker.setIcon(pinIcon(selected.group, false)); selected.marker.setZIndexOffset(0); }
    selected = null;
    sheet.classList.remove("open");
    mapFrame.classList.remove("sheet-open");
    mapFrame.style.setProperty("--sheet-h", "0px");
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
      const z = Math.max(map.getZoom(), 16);
      requestAnimationFrame(() => {
        const off = bottomMode() ? [0, (sheet.offsetHeight - topPad()) / 2] : [-198, 0];
        const p = map.project([b.lat, b.lng], z).add(off);
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
    if (!f.q.trim()) { hideSuggest(); return; }
    suggestItems = bins.filter(matches).slice(0, 6);
    suggest.innerHTML = suggestItems.length
      ? suggestItems.map((b, i) => `<li role="option" data-id="${esc(b.id)}" class="${i === activeIdx ? "active" : ""}"><span class="hm-sg-dot g-${b.group}"></span><span class="hm-sg-t"><b>${esc(b.name)}</b><small>${esc(b.code)} · ${esc(b.area)}</small></span></li>`).join("")
      : '<li class="hm-sg-empty">No dustbins match your search</li>';
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
  $("hm-fit").addEventListener("click", () => { closeSheet(); fitAll(); });

  let sat = false;
  $("hm-layers").addEventListener("click", (e) => {
    sat = !sat;
    if (sat) { map.removeLayer(streets); satellite.addTo(map); } else { map.removeLayer(satellite); streets.addTo(map); }
    e.currentTarget.setAttribute("aria-pressed", String(sat));
    e.currentTarget.setAttribute("aria-label", sat ? "Switch to street map" : "Switch to satellite view");
  });

  const compass = $("hm-compass");
  if (hasRotate) {
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

      let nearest = null, best = Infinity;
      bins.filter(matches).forEach((b) => { const d = userLL.distanceTo(L.latLng(b.lat, b.lng)); if (d < best) { best = d; nearest = b; } });
      if (nearest && best <= 15000) {
        say(`Your location is shown in blue · nearest dustbin is ${fmtDist(best)} away`);
        select(nearest, { fly: false });
        requestAnimationFrame(() => {
          const bottom = bottomMode();
          map.fitBounds(L.latLngBounds([userLL, [nearest.lat, nearest.lng]]), {
            paddingTopLeft: bottom ? [40, topPad()] : [440, 40],
            paddingBottomRight: [40, (bottom ? sheet.offsetHeight : 0) + 40],
            maxZoom: 17, animate: true
          });
        });
      } else {
        map.setView(userLL, Math.max(map.getZoom(), 15), { animate: true });
        say(nearest ? "You are far from the mapped dustbins" : "Your location is shown in blue. It has not been saved to HYSACAM");
      }
    }, (err) => {
      btn.classList.remove("busy");
      say(err.code === 1 ? "Location permission was denied. Allow location access in your browser to use this feature" : "Could not find your location. Check your device settings and try again");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!suggest.hidden) hideSuggest(); else closeSheet();
  });

  /* Other pages can ask the map to show a dustbin */
  document.addEventListener("hysacam:show-bin", (e) => {
    const b = byId.get(String(e.detail?.binId));
    if (!b) { say("This collection point has no verified GPS location yet"); return; }
    f.q = ""; f.group = "all"; input.value = ""; render();
    select(b, { fly: true });
  });

  /* ---------- data ---------- */
  const CK = "hysacam-map-bins-v1";
  async function fetchBins() {
    const all = [], size = 500;
    let from = 0;
    while (true) {
      const { data, error } = await client.from("bins")
        .select("id, bin_code, name, area, latitude, longitude, status")
        .order("name", { ascending: true })
        .range(from, from + size - 1);
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

  /* Open a dustbin straight from a link such as map.html?bin=BIN-001 */
  function deepLink() {
    const want = (new URLSearchParams(location.search).get("bin") || decodeURIComponent(location.hash.replace(/^#/, ""))).trim().toLowerCase();
    if (!want) return;
    const b = bins.find((x) => x.id.toLowerCase() === want || x.code.toLowerCase() === want);
    if (b) select(b, { fly: true });
  }

  let hadCache = false;
  try {
    const c = JSON.parse(localStorage.getItem(CK) || "null");
    if (c && Array.isArray(c.rows) && c.rows.length) { useRows(c.rows, true); hadCache = true; deepLink(); }
  } catch {}
  if (!hadCache) showLoading("Loading dustbin locations…");

  async function refresh() {
    try {
      const rows = await fetchBins();
      const first = !hadCache;
      useRows(rows, first);
      try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), rows })); } catch {}
      hideLoading();
      if (first) deepLink();
      hadCache = true;
      if (!bins.length) say(rows.length ? "Dustbins are registered, but none has verified map coordinates yet" : "No dustbins have been registered yet");
    } catch (error) {
      console.error("Could not load dustbin locations:", error);
      if (bins.length) say("Showing saved locations · could not refresh");
      else { say("Could not load dustbin locations. Check your connection and database permissions."); showError("Dustbin locations could not be loaded", () => { showLoading("Loading dustbin locations…"); refresh(); }); }
    }
  }
  refresh();

  /* ---------- layout upkeep ---------- */
  const invalidate = () => requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  setTimeout(invalidate, 250);
  window.addEventListener("resize", invalidate, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(invalidate, 250), { passive: true });
  document.querySelectorAll('a[href="#map"]').forEach((link) => link.addEventListener("click", () => setTimeout(invalidate, 350)));
  if (window.ResizeObserver) new ResizeObserver(invalidate).observe(mapFrame);
});
