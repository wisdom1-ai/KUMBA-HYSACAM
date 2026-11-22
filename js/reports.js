(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ST={submitted:['Submitted','submitted'],under_review:['In Review','review'],assigned:['Assigned','review'],in_progress:['In Progress','review'],resolved:['Resolved','resolved'],rejected:['Closed','closed']};
 const CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9"/></svg>';
 const CAL='<svg class="cal" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>';
 const CHEV='<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
 async function request(url,options={}){const r=await fetch(url,{credentials:'include',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed.');return d;}
 const when=x=>{const d=new Date(x);return d.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'})+' • '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});};
 function card(x,prefix){
  const [label,k]=ST[x.status]||[x.status,'submitted'];
  return `<details class="rcard"><summary><span class="r-ico st-${k}">${CHECK}</span><span class="r-main"><b class="r-code">${esc(x.reference_code)}</b><span class="r-date">${prefix?'':CAL}${prefix||''}${when(x.created_at)}</span></span><span class="pill st-${k}">${esc(label)}</span>${CHEV}</summary><div class="r-body"><p><b>${esc(x.issue_type)}</b> · ${esc(x.area)}</p><p>${esc(x.location_description)}</p>${x.description?`<p>${esc(x.description)}</p>`:''}${x.admin_notes?`<p class="team-note">Team update: ${esc(x.admin_notes)}</p>`:''}</div></details>`;
 }
 let reports=null;
 async function fetchReports(){try{const d=await request('/api/reports');return d.reports||[];}catch{return null;}}
 function badge(list){const el=document.querySelector('.notification-count');if(!el||!list)return;const n=list.filter(x=>!['resolved','rejected'].includes(x.status)).length;el.textContent=n;el.hidden=!n;}
 function stats(list){const set=(id,v)=>{if($(id))$(id).textContent=v;};set('stat-total',list.length);set('stat-pending',list.filter(x=>!['resolved','rejected'].includes(x.status)).length);set('stat-resolved',list.filter(x=>x.status==='resolved').length);set('stat-closed',list.filter(x=>x.status==='rejected').length);}
 function renderHome(list){
  const host=$('home-recent');if(!host)return;
  if(list===null)host.innerHTML='<div class="empty-card"><b>Sign in to see your reports</b><p>Track the waste issues you report in Kumba</p><a class="button" href="signin.html">Sign in</a></div>';
  else if(!list.length)host.innerHTML='<div class="empty-card"><b>No reports yet</b><p>Spotted a waste issue in your area? Let HYSACAM know</p><a class="button" href="report.html">Submit a report</a></div>';
  else host.innerHTML=list.slice(0,3).map(x=>card(x,'Submitted on ')).join('');
 }
 function renderList(list){const host=$('my-reports-list');if(!host)return;host.innerHTML=list.length?list.map(x=>card(x)).join(''):'<div class="empty-card"><b>No reports yet</b><p>Tap Submit a Report to send your first one</p></div>';stats(list);}
 async function refresh(){reports=await fetchReports();badge(reports);renderHome(reports);if(reports){$('report-auth-gate')&&($('report-auth-gate').hidden=true);$('resident-my-reports')&&($('resident-my-reports').hidden=false);renderList(reports);}}
 const form=$('resident-report-form'),open=$('open-report-form');
 open?.addEventListener('click',()=>{if(reports===null){location.href='signin.html?next=%2Freport.html';return;}form.hidden=!form.hidden;if(!form.hidden)form.scrollIntoView({behavior:'smooth',block:'start'});});
 form?.addEventListener('submit',async e=>{e.preventDefault();const msg=$('resident-report-message');msg.textContent='';const b=$('submit-resident-report');b.disabled=true;b.textContent='Submitting…';const payload=Object.fromEntries(new FormData(form).entries());delete payload.latitude;delete payload.longitude;
  try{const d=await request('/api/reports',{method:'POST',body:JSON.stringify(payload)});msg.textContent=`Report submitted. Your reference is ${d.report.reference_code}.`;form.reset();await refresh();}catch(err){msg.textContent=err.message;}finally{b.disabled=false;b.textContent='Submit report';}});
 $('refresh-my-reports')?.addEventListener('click',refresh);
 refresh();
})();
