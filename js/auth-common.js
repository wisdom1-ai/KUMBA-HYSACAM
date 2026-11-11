(()=>{
  const API='/api/auth';
  const $=id=>document.getElementById(id);
  const msg=(s,ok=false)=>{const el=$('auth-message');if(el){el.textContent=s;el.className='auth-message'+(ok?' success':'')}};
  const busy=(button,on,label)=>{if(!button)return;button.disabled=on;button.textContent=on?'Please wait…':label};
  const post=async(path,data)=>{const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify(data)});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||'We could not complete that request. Please try again.');return d};
  function setupOtpBoxes(){
    document.querySelectorAll('.otp-source').forEach(input=>{
      const host=document.querySelector(`[data-otp-for="${input.id}"]`);if(!host)return;
      host.innerHTML=''; const cells=[];
      for(let i=0;i<6;i++){const cell=document.createElement('span');cell.className='otp-cell';cell.setAttribute('aria-hidden','true');host.appendChild(cell);cells.push(cell)}
      const paint=()=>{const value=input.value.replace(/\D/g,'').slice(0,6);if(value!==input.value)input.value=value;cells.forEach((cell,i)=>{cell.textContent=value[i]||'';cell.classList.toggle('is-current',input===document.activeElement&&i===Math.min(value.length,5))});};
      const acceptCode=value=>{const digits=String(value||'').replace(/\D/g,'').slice(0,6);input.value=digits;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});paint();};
      input.addEventListener('input',paint);
      input.addEventListener('focus',paint);
      input.addEventListener('blur',paint);
      input.addEventListener('paste',event=>{const text=event.clipboardData?.getData('text')||'';if(text){event.preventDefault();acceptCode(text);}});
      host.addEventListener('click',()=>input.focus({preventScroll:true}));
      host.addEventListener('paste',event=>{const text=event.clipboardData?.getData('text')||'';if(text){event.preventDefault();acceptCode(text);}});
      host.setAttribute('role','group');
      host.setAttribute('tabindex','0');
      host.setAttribute('aria-label','Six-digit code input. Tap to type or paste your code');
      host.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();input.focus({preventScroll:true});}});
      paint();
    });
  }
  window.HysAuth={ $,msg,busy,post,setupOtpBoxes};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupOtpBoxes);else setupOtpBoxes();
})();