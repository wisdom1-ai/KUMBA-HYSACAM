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
      input.addEventListener('input',paint);input.addEventListener('focus',paint);input.addEventListener('blur',paint);host.addEventListener('click',()=>input.focus({preventScroll:true}));paint();
    });
  }
  window.HysAuth={ $,msg,busy,post,setupOtpBoxes};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupOtpBoxes);else setupOtpBoxes();
})();