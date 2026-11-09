(()=>{
  const path=location.pathname;
  if(!path.endsWith('/index.html')&&!path.endsWith('/'))return;
  fetch('/api/auth/me',{credentials:'include',cache:'no-store',headers:{'Accept':'application/json'}})
    .then(async response=>{
      if(response.status===401){location.replace('signin.html');return null;}
      if(!response.ok)throw new Error('Temporary authentication check failure');
      return response.json();
    })
    .then(data=>{
      if(!data||!data.authenticated)return;
      const nav=document.getElementById('main-nav');
      if(nav&&!document.getElementById('signout-button')){
        const button=document.createElement('button');button.id='signout-button';button.className='button small';button.textContent='Sign out';
        button.addEventListener('click',async()=>{button.disabled=true;try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'include'});if(!response.ok)throw new Error();location.replace('signin.html')}catch{button.disabled=false;alert('Could not sign out. Please try again.')}});
        nav.appendChild(button);
      }
    }).catch(error=>console.warn('[HYSACAM auth] Session check temporarily unavailable; keeping dashboard visible.',error));
})();