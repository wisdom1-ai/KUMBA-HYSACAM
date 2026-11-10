(()=>{
  const API='/api/auth';
  const $=id=>document.getElementById(id);
  const msg=(s,ok=false)=>{const el=$('auth-message');if(el){el.textContent=String(s||'').replace(/[.]+(?=\s*$)/,'');el.className='auth-message'+(ok?' success':'')}};
  const busy=(button,on,label)=>{if(!button)return;button.disabled=on;button.textContent=on?'Please wait…':label};
  const post=async(path,data)=>{const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify(data)});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||'We could not complete that request. Please try again.');return d};
  window.HysAuth={ $,msg,busy,post};
})();