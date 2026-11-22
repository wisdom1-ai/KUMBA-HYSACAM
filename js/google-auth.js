(()=>{
  // Supabase is only needed for Google sign-in, so it loads on demand and never blocks the sign-in form
  const CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const fail='Google sign-in could not load. Check your connection and try again';
  const load=src=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=src;s.async=true;
    const t=setTimeout(()=>reject(new Error(fail)),15000);
    s.onload=()=>{clearTimeout(t);resolve();};
    s.onerror=()=>{clearTimeout(t);reject(new Error(fail));};
    document.head.appendChild(s);
  });
  async function client(){
    if(window.supabaseClient)return window.supabaseClient;
    if(!window.supabase)await load(CDN);
    if(!window.supabaseClient)await load('js/supabase.js?v=64119a7a');
    if(!window.supabaseClient)throw new Error(fail);
    return window.supabaseClient;
  }
  document.querySelectorAll('[data-google-auth]').forEach(button=>{
    const label=button.innerHTML;
    button.addEventListener('click',async()=>{
      const intent=button.dataset.googleAuth||'resident';
      button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Connecting to Google…';
      try{
        const sb=await client();
        sessionStorage.setItem('hysacam_google_intent',intent);
        sessionStorage.setItem('hysacam_google_next',new URLSearchParams(location.search).get('next')||'');
        const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${location.origin}/oauth-callback.html`}});
        if(error)throw error;
      }catch(error){
        const box=document.getElementById('auth-message');
        if(box){box.textContent=error.message||'Google sign-in could not start';box.classList.add('error');}
        button.disabled=false;button.removeAttribute('aria-busy');button.innerHTML=label;
      }
    });
  });
})();
