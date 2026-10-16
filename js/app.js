(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const storage = { reports: "hysac_kumba_reports_v1", profile: "hysac_kumba_profile_v1" };
  const locations = [
    {id:1,name:"Kumba Main Market",area:"Kumba I",status:"Needs attention",lat:4.6367,lng:9.4469,checked:"Sample entry"},
    {id:2,name:"Buea Road Junction",area:"Kumba I",status:"Available",lat:4.6386,lng:9.4510,checked:"Sample entry"},
    {id:3,name:"Fiango Community Point",area:"Kumba II",status:"Available",lat:4.6418,lng:9.4384,checked:"Sample entry"},
    {id:4,name:"Mile One Junction",area:"Kumba I",status:"Needs attention",lat:4.6327,lng:9.4498,checked:"Sample entry"},
    {id:5,name:"Kumba Town Green",area:"Kumba II",status:"Available",lat:4.6450,lng:9.4452,checked:"Sample entry"},
    {id:6,name:"Three Corners Area",area:"Kumba III",status:"Maintenance",lat:4.6298,lng:9.4404,checked:"Sample entry"},
    {id:7,name:"Government School Area",area:"Kumba I",status:"Available",lat:4.6408,lng:9.4552,checked:"Sample entry"},
    {id:8,name:"Barombi Kang Road",area:"Kumba II",status:"Available",lat:4.6500,lng:9.4360,checked:"Sample entry"},
    {id:9,name:"Mbonge Road Junction",area:"Kumba III",status:"Needs attention",lat:4.6268,lng:9.4533,checked:"Sample entry"},
    {id:10,name:"Hospital Neighbourhood",area:"Kumba II",status:"Available",lat:4.6473,lng:9.4521,checked:"Sample entry"},
    {id:11,name:"Station Area",area:"Kumba I",status:"Available",lat:4.6347,lng:9.4388,checked:"Sample entry"},
    {id:12,name:"Community Sports Ground",area:"Kumba III",status:"Maintenance",lat:4.6229,lng:9.4440,checked:"Sample entry"}
  ];
  let reports = read(storage.reports, []);
  let profile = read(storage.profile, {name:"",area:"",notifications:false});
  let mainMap = null, miniMap = null, mainMarkers = [], miniMarkers = [], toastTimeout;

  function read(key, fallback){ try { const value=localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
  function write(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast("Could not save: browser storage may be disabled."); return false; } }
  function escapeHTML(value){ return String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function toast(message){ const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.classList.remove("show"),2800); }
  function statusClass(status){ return status==="Available"?"status-available":status==="Maintenance"?"status-maintenance":"status-attention"; }
  function statusBadge(status){ return `<span class="status-badge ${statusClass(status)}">${escapeHTML(status)}</span>`; }
  function setPage(name){
    const valid=["home","map","directory","report","reports","profile","help"];
    if(!valid.includes(name)) name="home";
    $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${name}`));
    $$("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
    const titles={home:"Overview",map:"Community map",directory:"Dustbin directory",report:"Submit a report",reports:"My reports",profile:"My profile",help:"Help & support"};
    $("#page-crumb").textContent=titles[name];
    if(name==="map"){ ensureMap("main"); setTimeout(()=>mainMap && mainMap.invalidateSize(),120); renderMainMarkers(); }
    if(name==="home"){ ensureMap("mini"); setTimeout(()=>miniMap && miniMap.invalidateSize(),120); }
    if(name==="directory") renderDirectory();
    if(name==="reports") renderReports();
    if(name==="profile") renderProfile();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function renderDirectory(){
    const query=($("#directory-search").value||"").trim().toLowerCase(), status=$("#status-filter").value;
    const found=locations.filter(l=>(status==="all"||l.status===status)&&`${l.name} ${l.area} ${l.status}`.toLowerCase().includes(query));
    $("#directory-body").innerHTML=found.length?found.map(l=>`<tr><td><strong>${escapeHTML(l.name)}</strong><small>Sample location #${String(l.id).padStart(3,"0")}</small></td><td>${escapeHTML(l.area)}</td><td>${statusBadge(l.status)}</td><td>${l.checked}</td><td><button class="text-button locate-button" data-location="${l.id}">View on map ↗</button></td></tr>`).join(""):`<tr><td colspan="5"><div class="empty-state"><h3>No locations found</h3><p>Try a different search or status filter.</p></div></td></tr>`;
    $("#directory-result-count").textContent=`${found.length} location${found.length===1?"":"s"}`;
    $$(".locate-button").forEach(b=>b.addEventListener("click",()=>{const loc=locations.find(l=>l.id===Number(b.dataset.location));setPage("map");setTimeout(()=>{if(mainMap&&loc)mainMap.setView([loc.lat,loc.lng],16);},200);}));
  }
  function ensureMap(which){
    if(!window.L)return;
    if(which==="main"&&!mainMap){mainMap=L.map("main-map",{zoomControl:true}).setView([4.638,9.445],14);addTileLayer(mainMap);mainMap.on("moveend",()=>{});}
    if(which==="mini"&&!miniMap){miniMap=L.map("mini-map",{zoomControl:false,dragging:true,scrollWheelZoom:false,doubleClickZoom:false}).setView([4.638,9.445],13);addTileLayer(miniMap);}
    if(which==="main")renderMainMarkers(); else renderMiniMarkers();
  }
  function addTileLayer(map){L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);}
  function markerColor(status){return status==="Available"?"#258552":status==="Maintenance"?"#3477b9":"#d8942d";}
  function markerIcon(status){return L.divIcon({className:"custom-map-pin",html:`<div style="background:${markerColor(status)};width:15px;height:15px;border:3px solid white;border-radius:50%;box-shadow:0 2px 7px #173b2b55"></div>`,iconSize:[15,15],iconAnchor:[7,7]});}
  function popup(l){return `<strong>${escapeHTML(l.name)}</strong><br>${escapeHTML(l.area)}<div class="map-popup-status">${statusBadge(l.status)}</div><small>Illustrative sample location — not verified live data.</small>`;}
  function renderMainMarkers(){
    if(!mainMap||!window.L)return;
    mainMarkers.forEach(m=>m.remove());mainMarkers=[];
    const filter=$("#map-filter")?.value||"all";
    locations.filter(l=>filter==="all"||l.status===filter).forEach(l=>mainMarkers.push(L.marker([l.lat,l.lng],{icon:markerIcon(l.status)}).addTo(mainMap).bindPopup(popup(l))));
  }
  function renderMiniMarkers(){
    if(!miniMap||!window.L)return;
    miniMarkers.forEach(m=>m.remove());miniMarkers=[];
    locations.slice(0,8).forEach(l=>miniMarkers.push(L.marker([l.lat,l.lng],{icon:markerIcon(l.status)}).addTo(miniMap).bindPopup(popup(l))));
  }
  function updateStats(){
    $("#stat-bins").textContent=locations.length;
    $("#stat-attention").textContent=locations.filter(l=>l.status!=="Available").length;
    $("#stat-reports").textContent=reports.length;
    $("#report-count").textContent=reports.length;
  }
  function renderReports(){
    $("#reports-subtitle").textContent=`${reports.length} locally saved report${reports.length===1?"":"s"}.`;
    const host=$("#reports-list");
    if(!reports.length){host.innerHTML=`<div class="empty-state"><div class="empty-icon">☷</div><h3>No reports yet</h3><p>When you submit a report, it will appear here.</p><button class="button primary" data-go="report">Submit your first report</button></div>`;host.querySelector("[data-go]")?.addEventListener("click",()=>setPage("report"));return;}
    host.innerHTML=[...reports].reverse().map(r=>`<article class="report-record"><div class="record-icon">＋</div><div class="record-body"><h4>${escapeHTML(r.type)}</h4><p>${escapeHTML(r.location)} · ${escapeHTML(r.area)}</p>${r.details?`<p>${escapeHTML(r.details)}</p>`:""}<div class="record-meta">${escapeHTML(r.date)} · Saved on this device</div></div><div class="record-id">${escapeHTML(r.id)}</div></article>`).join("");
  }
  function renderProfile(){
    $("#profile-name").value=profile.name||"";$("#profile-area").value=profile.area||"";$("#profile-notifications").checked=!!profile.notifications;
    $("#profile-display-name").textContent=profile.name||"Community member";
    const initial=(profile.name||"W").trim().charAt(0).toUpperCase()||"W";
    $("#profile-avatar").textContent=initial;$("#top-avatar").textContent=initial;
  }
  function exportCSV(){
    if(!reports.length){toast("There are no reports to export yet.");return;}
    const rows=[["Reference","Issue type","Location","Area","Details","Date"],...reports.map(r=>[r.id,r.type,r.location,r.area,r.details,r.date])];
    const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download="hysacam-kumba-my-reports.csv";a.click();URL.revokeObjectURL(url);toast("Your report history was exported.");
  }
  $$("[data-page]").forEach(button=>button.addEventListener("click",()=>setPage(button.dataset.page)));
  $$("[data-go]").forEach(button=>button.addEventListener("click",()=>setPage(button.dataset.go)));
  $("#top-avatar").addEventListener("click",()=>setPage("profile"));
  $("#directory-search").addEventListener("input",renderDirectory);
  $("#status-filter").addEventListener("change",renderDirectory);
  $("#map-filter").addEventListener("change",renderMainMarkers);
  $("#map-fit").addEventListener("click",()=>{if(mainMap){const group=L.featureGroup(mainMarkers);if(mainMarkers.length)mainMap.fitBounds(group.getBounds().pad(.15));}});
  $("#report-form").addEventListener("submit",event=>{
    event.preventDefault();
    const type=$("#issue-type").value, location=$("#issue-location").value.trim(), area=$("#issue-area").value, details=$("#issue-details").value.trim();
    if(!type||!location||!area){toast("Please complete all required fields.");return;}
    const now=new Date(), date=now.toLocaleString();
    const report={id:"HK-"+now.getFullYear().toString().slice(-2)+Math.random().toString(36).slice(2,7).toUpperCase(),type,location,area,details,date};
    reports.push(report);write(storage.reports,reports);$("#report-form").reset();updateStats();renderReports();toast("Report saved on this device.");setPage("reports");
  });
  $("#profile-form").addEventListener("submit",event=>{event.preventDefault();profile={name:$("#profile-name").value.trim(),area:$("#profile-area").value,notifications:$("#profile-notifications").checked};write(storage.profile,profile);renderProfile();toast("Profile saved on this device.");});
  $("#export-reports").addEventListener("click",exportCSV);
  $("#clear-local-data").addEventListener("click",()=>{if(!confirm("Clear locally saved reports and profile settings on this browser? This cannot be undone."))return;reports=[];profile={name:"",area:"",notifications:false};try{localStorage.removeItem(storage.reports);localStorage.removeItem(storage.profile);}catch{}updateStats();renderProfile();renderReports();toast("Local demo data cleared.");});
  window.addEventListener("resize",()=>{if(mainMap)mainMap.invalidateSize();if(miniMap)miniMap.invalidateSize();});
  renderDirectory();updateStats();renderProfile();ensureMap("mini");
})();