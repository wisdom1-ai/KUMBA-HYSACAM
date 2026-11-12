(()=>{
 const $=s=>document.querySelector(s);const bins=[];let page=1,selected=null,records=[];
 const menu=$('#menu-toggle'),nav=$('#main-nav'),closeMenu=$('#menu-close'),backdrop=$('#nav-backdrop');
 const setMenuOpen=open=>{
   if(!menu||!nav)return;
   nav.classList.toggle('open',open);
   document.body.classList.toggle('nav-open',open);
   menu.setAttribute('aria-expanded',String(open));
   menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');
   if(backdrop)backdrop.classList.toggle('open',open);
 };
 if(menu&&nav){
   menu.addEventListener('click',()=>setMenuOpen(!nav.classList.contains('open')));
   closeMenu?.addEventListener('click',()=>setMenuOpen(false));
   backdrop?.addEventListener('click',()=>setMenuOpen(false));
   nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenuOpen(false)));
   document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenuOpen(false)});
 }
 function details(b){if(!b)return;selected=b;$('#detail-name').textContent=b.id;$('#detail-area').textContent=b.area+', Kumba';$('#detail-area2').textContent=b.area;$('#details').scrollIntoView({behavior:'smooth'});if(map&&Number.isFinite(b.lat)&&Number.isFinite(b.lng))map.setView([b.lat,b.lng],15)}
 function renderBins(){const q=($('#directorySearch')?.value||'').toLowerCase();const list=bins.filter(b=>(b.id+' '+b.area).toLowerCase().includes(q));const pages=Math.max(1,Math.ceil(list.length/4));page=Math.min(page,pages);$('#binGrid').innerHTML=list.length?list.slice((page-1)*4,page*4).map(b=>`<article class="bin-card"><span class="pin">📍</span><div><h3>${b.id}</h3><p>${b.area}</p></div><button data-id="${b.id}">View</button></article>`).join(''):'<div class="empty-state"><span>📍</span><h3>No dustbins have been published yet</h3><p>Verified collection points will appear here once they are added by the HYSACAM team.</p></div>';$('#page-number').textContent=page;$('#binGrid').querySelectorAll('button').forEach(x=>x.onclick=()=>details(bins.find(b=>b.id===x.dataset.id)))}
 function renderRecords(){$('#cleaning-table').innerHTML=records.length?records.map((r,i)=>`<tr><td>${i+1}</td><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td><span class="status ${r[3]==='Cleaned'?'cleaned':'pending'}">${r[3]}</span></td><td><button data-view="${i}">View</button></td></tr>`).join(''):'<tr><td colspan="6"><div class="empty-state compact"><span>🧹</span><h3>No cleaning records yet</h3><p>Cleaning activity will show here after verified records are added.</p></div></td></tr>'}
 renderBins();renderRecords();
 $('#directorySearch').oninput=()=>{page=1;renderBins()};$('#directory-search-btn').onclick=renderBins;$('#prev-page').onclick=()=>{page=Math.max(1,page-1);renderBins()};$('#next-page').onclick=()=>{page++;renderBins()};
 $('#location-search').onsubmit=e=>{e.preventDefault();const q=$('#location-input').value.trim();$('#search-message').textContent=q?'No published locations match yet.':'Please enter a location.';$('#directorySearch').value=q;page=1;renderBins();$('#directory').scrollIntoView({behavior:'smooth'})};
 $('#map-filter').onclick=()=>alert('No verified dustbin locations are available to filter yet.');$('#map-search').oninput=()=>{};
 $('#mark-cleaned').onclick=()=>alert('Cleaning updates will be enabled when the verified staff and records system is connected.');
 const modal=$('#record-modal');$('#add-record').onclick=()=>alert('Cleaning records will be entered by authorised staff after the records system is connected.');function close(){modal?.classList.remove('open')}$('#close-modal')?.addEventListener('click',close);modal?.addEventListener('click',e=>{if(e.target===modal)close()});
 $('#cleaning-table').onclick=e=>{const b=e.target.closest('[data-view]');if(b)alert('No record details are available yet.')};
 let map=null;
})();
