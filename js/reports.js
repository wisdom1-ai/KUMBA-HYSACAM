(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const H=window.Hys;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ST={submitted:['Submitted','submitted'],under_review:['In Review','review'],assigned:['Assigned','review'],in_progress:['In Progress','review'],resolved:['Resolved','resolved'],rejected:['Closed','closed']};
 const CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9"/></svg>';
 const CAL='<svg class="cal" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>';
 const CHEV='<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
 const DONE=['resolved','rejected'];
 const when=x=>{const d=new Date(x);if(Number.isNaN(d.getTime()))return '';return d.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'})+' • '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});};
 async function request(url,options={}){
  const r=await fetch(url,{credentials:'include',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.message||'Request failed');
  return d;
 }

 function card(x,prefix){
  const [label,k]=ST[x.status]||[x.status||'Submitted','submitted'];
  return `<details class="rcard" data-code="${esc(x.reference_code)}"><summary><span class="r-ico st-${k}">${CHECK}</span><span class="r-main"><b class="r-code">${esc(x.reference_code)}</b><span class="r-date">${prefix?'':CAL}${prefix||''}${esc(when(x.created_at))}</span></span><span class="pill st-${k}">${esc(label)}</span>${CHEV}</summary><div class="r-body"><p><b>${esc(x.issue_type)}</b> · ${esc(x.area)}</p><p>${esc(x.location_description)}</p>${x.description?`<p>${esc(x.description)}</p>`:''}${x.admin_notes?`<p class="team-note">Team update: ${esc(x.admin_notes)}</p>`:''}</div></details>`;
 }
 const skeleton=n=>Array.from({length:n},()=>'<div class="rcard skeleton" aria-hidden="true"><div class="sk-row"><span class="sk-dot"></span><span class="sk-lines"><i></i><i></i></span><span class="sk-pill"></span></div></div>').join('');

 let reports;            // undefined = not known yet, null = visitor, array = loaded
 let lastSig='';         // what is currently drawn, to avoid needless re-draws
 let hashHandled=false;

 function stats(list){
  const set=(id,v)=>{if($(id))$(id).textContent=v;};
  if(!list){['stat-total','stat-pending','stat-resolved','stat-closed'].forEach(id=>set(id,'–'));return;}
  set('stat-total',list.length);
  set('stat-pending',list.filter(x=>!DONE.includes(x.status)).length);
  set('stat-resolved',list.filter(x=>x.status==='resolved').length);
  set('stat-closed',list.filter(x=>x.status==='rejected').length);
 }
 const openCodes=host=>new Set([...host.querySelectorAll('details[open]')].map(d=>d.dataset.code));
 function paintCards(host,html){
  const keep=openCodes(host);
  host.innerHTML=html;
  host.querySelectorAll('details.rcard').forEach(d=>{if(keep.has(d.dataset.code))d.open=true;});
 }
 function renderHome(list){
  const host=$('home-recent');if(!host)return;
  if(list===undefined)return;
  if(list===null)host.innerHTML='<div class="empty-card"><b>Sign in to see your reports</b><p>Track the waste issues you report in Kumba</p><a class="button" href="signin.html">Sign in</a></div>';
  else if(!list.length)host.innerHTML='<div class="empty-card"><b>No reports yet</b><p>Spotted a waste issue in your area? Let HYSACAM know</p><a class="button" href="report.html">Submit a report</a></div>';
  else paintCards(host,list.slice(0,3).map(x=>card(x,'Submitted on ')).join(''));
 }
 function renderList(list){
  const host=$('my-reports-list');if(!host)return;
  if(!list.length){host.innerHTML='<div class="empty-card"><b>No reports yet</b><p>Tap Submit a Report to send your first one</p></div>';return;}
  paintCards(host,list.map(x=>card(x)).join(''));
  if(!hashHandled&&location.hash.length>1){
   hashHandled=true;
   const code=decodeURIComponent(location.hash.slice(1));
   const el=[...host.querySelectorAll('details.rcard')].find(d=>d.dataset.code===code);
   if(el){el.open=true;setTimeout(()=>el.scrollIntoView({block:'center',behavior:'smooth'}),60);}
  }
 }
 function showSection(on){
  if($('resident-my-reports'))$('resident-my-reports').hidden=!on;
  if($('report-auth-gate'))$('report-auth-gate').hidden=on;
 }

 /* Paint the page right away: last known list if we have one, otherwise placeholders. */
 function paintLoading(){
  const cached=H.cachedReports();
  if(cached){apply(cached);return true;}
  const html=document.documentElement;
  if(html.classList.contains('auth-no')){return false;}
  if($('my-reports-list')){showSection(true);$('my-reports-list').innerHTML=skeleton(2);stats(null);}
  if($('home-recent'))$('home-recent').innerHTML=skeleton(2);
  lastSig='';
  return false;
 }

 function apply(list){
  reports=list;
  const sig=JSON.stringify(list);
  if(sig===lastSig)return;
  lastSig=sig;
  if(list===null){
   if($('report-auth-gate')||$('resident-my-reports'))showSection(false);
   renderHome(null);stats(null);return;
  }
  showSection(true);
  renderList(list);
  renderHome(list);
  stats(list);
 }

 function showError(){
  const msg='<div class="empty-card"><b>Could not load your reports</b><p>Check your connection and try again</p><button class="button" type="button" data-retry>Try again</button></div>';
  if($('my-reports-list')){showSection(true);$('my-reports-list').innerHTML=msg;}
  if($('home-recent'))$('home-recent').innerHTML=msg;
  lastSig='';
 }

 async function refresh({manual=false,force=false}={}){
  const btn=$('refresh-my-reports');
  if(manual&&btn){btn.disabled=true;btn.textContent='Refreshing…';}
  try{
   const list=await H.reports({force:force||manual});
   if(list===undefined){ if(reports===undefined)showError(); else if(manual)H.toast('You appear to be offline'); }
   else apply(list);
  }finally{
   if(btn){btn.disabled=false;btn.textContent='Refresh';}
  }
 }

 const form=$('resident-report-form'),open=$('open-report-form');
 open?.addEventListener('click',()=>{
  if(reports===null){location.href='signin.html?next=%2Freport.html';return;}
  form.hidden=!form.hidden;
  if(!form.hidden){form.scrollIntoView({behavior:'smooth',block:'start'});form.querySelector('select,input')?.focus({preventScroll:true});}
 });
 form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const msg=$('resident-report-message');msg.textContent='';
  const b=$('submit-resident-report');b.disabled=true;b.textContent='Submitting…';
  const payload=Object.fromEntries(new FormData(form).entries());delete payload.latitude;delete payload.longitude;
  try{
   const d=await request('/api/reports',{method:'POST',body:JSON.stringify(payload)});
   const list=[d.report,...(Array.isArray(reports)?reports:[])];
   H.saveReports(list);          // also refreshes the notification bell
   apply(list);                  // the new report appears instantly
   form.reset();form.hidden=true;
   H.toast('Report submitted • '+d.report.reference_code,'ok');
   $('resident-my-reports')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){msg.textContent=err.message;}
  finally{b.disabled=false;b.textContent='Submit report';}
 });
 $('refresh-my-reports')?.addEventListener('click',()=>refresh({manual:true}));
 document.addEventListener('click',e=>{if(e.target.closest('[data-retry]')){paintLoading();refresh({force:true});}});
 // Another page/tab or the notification bell fetched newer data: show it without another request
 document.addEventListener('hys:reports',e=>{if(Array.isArray(e.detail))apply(e.detail);});
 // Coming back to the tab or the app: quietly bring the list up to date
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&reports!==undefined)refresh();});
 window.addEventListener('pageshow',e=>{if(e.persisted)refresh({force:true});});

 paintLoading();
 refresh();
})();
