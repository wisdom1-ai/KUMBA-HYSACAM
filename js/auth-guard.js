(()=>{
  const path=location.pathname;
  if(!path.endsWith('/index.html')&&!path.endsWith('/'))return;
  const signOut=async button=>{
    if(button.dataset.busy==='1')return;
    button.dataset.busy='1';button.disabled=true;button.textContent='Signing out…';
    try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'include',headers:{'Accept':'application/json'}});if(!response.ok)throw new Error('Logout failed');location.replace('signin.html');}
    catch{button.disabled=false;button.dataset.busy='0';button.textContent='Sign out';const msg=document.getElementById('account-action-message');if(msg)msg.textContent='Could not sign out. Please try again.';}
  };
  fetch('/api/auth/me',{credentials:'include',cache:'no-store',headers:{'Accept':'application/json'}})
    .then(async response=>{if(response.status===401){location.replace('signin.html');return null;}if(!response.ok)throw new Error('Temporary authentication check failure');return response.json();})
    .then(data=>{
      if(!data||!data.authenticated)return;
      const nav=document.getElementById('main-nav');
      const header=document.getElementById('header-account-actions');
      const makeButton=(id,cls)=>{const b=document.createElement('button');b.id=id;b.type='button';b.className=cls;b.textContent='Sign out';b.addEventListener('click',()=>signOut(b));return b;};
      if(nav&&!document.getElementById('signout-button'))nav.appendChild(makeButton('signout-button','nav-signout'));
      if(header&&!document.getElementById('header-signout-button'))header.appendChild(makeButton('header-signout-button','button outline header-signout'));
    }).catch(error=>console.warn('[HYSACAM auth] Session check temporarily unavailable.',error));
})();
