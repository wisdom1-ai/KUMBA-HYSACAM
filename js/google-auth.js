(()=>{
  document.querySelectorAll('[data-google-auth]').forEach(button=>{
    button.addEventListener('click',async()=>{
      const intent=button.dataset.googleAuth||'resident';
      const original=button.innerHTML;
      button.disabled=true;
      button.textContent='Connecting to Google…';
      try{
        if(!window.supabaseClient)throw new Error('Google sign-in is not available yet');
        sessionStorage.setItem('hysacam_google_intent',intent);
        sessionStorage.setItem('hysacam_google_next',new URLSearchParams(location.search).get('next')||'');
        const {error}=await window.supabaseClient.auth.signInWithOAuth({
          provider:'google',
          options:{redirectTo:`${location.origin}/oauth-callback.html`}
        });
        if(error)throw error;
      }catch(error){
        const box=document.getElementById('auth-message');
        if(box){box.textContent=error.message||'Google sign-in could not start';box.classList.add('error');}
        button.disabled=false;button.innerHTML=original;
      }
    });
  });
})();