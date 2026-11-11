(()=>{
  const API='/api/auth';
  const $=id=>document.getElementById(id);
  const msg=(s,ok=false)=>{const el=$('auth-message');if(el){el.textContent=s;el.className='auth-message'+(ok?' success':'')}};
  const busy=(button,on,label)=>{if(!button)return;button.disabled=on;button.textContent=on?'Please wait…':label};
  const post=async(path,data)=>{const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify(data)});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||'We could not complete that request. Please try again.');return d};
  function setupOtpBoxes(){
    document.querySelectorAll('.otp-source').forEach(input=>{
      const host=document.querySelector(`[data-otp-for="${input.id}"]`);
      if(!host || host.dataset.otpReady === '1') return;
      host.dataset.otpReady='1';
      host.innerHTML='';
      const boxes=[];
      const paint=(value)=>{
        const digits=String(value||'').replace(/\D/g,'').slice(0,6);
        input.value=digits;
        boxes.forEach((box,index)=>{
          box.value=digits[index]||'';
          box.classList.toggle('is-current',box===document.activeElement);
          box.setAttribute('aria-label',`Digit ${index+1} of 6`);
        });
      };
      const distribute=(value,focusEnd=true)=>{
        const digits=String(value||'').replace(/\D/g,'').slice(0,6);
        input.value=digits;
        boxes.forEach((box,index)=>box.value=digits[index]||'');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        if(focusEnd){
          const target=boxes[Math.min(digits.length,5)];
          target?.focus({preventScroll:true});
        }
      };
      for(let i=0;i<6;i++){
        const box=document.createElement('input');
        box.type='text';
        box.inputMode='numeric';
        box.pattern='[0-9]*';
        box.maxLength=i===0?6:1;
        box.autocomplete=i===0?'one-time-code':'off';
        box.autocapitalize='off';
        box.autocorrect='off';
        box.spellcheck=false;
        box.className='otp-cell';
        box.setAttribute('aria-label',`Digit ${i+1} of 6`);
        box.setAttribute('enterkeyhint','done');
        box.addEventListener('focus',()=>{
          boxes.forEach(el=>el.classList.toggle('is-current',el===box));
        });
        box.addEventListener('input',()=>{
          const raw=box.value.replace(/\D/g,'');
          if(raw.length>1 || (i===0 && raw.length===6)){
            distribute(raw);
            return;
          }
          box.value=raw.slice(-1);
          const current=boxes.map(el=>el.value).join('');
          input.value=current;
          input.dispatchEvent(new Event('input',{bubbles:true}));
          if(box.value && i<5) boxes[i+1].focus({preventScroll:true});
        });
        box.addEventListener('keydown',event=>{
          if(event.key==='Backspace' && !box.value && i>0){
            boxes[i-1].value='';
            boxes[i-1].focus({preventScroll:true});
            input.value=boxes.map(el=>el.value).join('');
            input.dispatchEvent(new Event('input',{bubbles:true}));
          }else if(event.key==='ArrowLeft' && i>0){
            event.preventDefault();boxes[i-1].focus({preventScroll:true});
          }else if(event.key==='ArrowRight' && i<5){
            event.preventDefault();boxes[i+1].focus({preventScroll:true});
          }
        });
        box.addEventListener('paste',event=>{
          const text=event.clipboardData?.getData('text')||'';
          const digits=text.replace(/\D/g,'');
          if(digits){
            event.preventDefault();
            distribute(digits);
          }
        });
        host.appendChild(box);
        boxes.push(box);
      }
      // Keep the original form field as the single source of truth for existing
      // submit handlers and server payloads; it remains visually hidden by CSS.
      input.setAttribute('inputmode','numeric');
      input.setAttribute('autocomplete','one-time-code');
      input.setAttribute('autocapitalize','off');
      input.setAttribute('autocorrect','off');
      input.setAttribute('spellcheck','false');
      input.addEventListener('input',()=>paint(input.value));
      host.addEventListener('paste',event=>{
        const text=event.clipboardData?.getData('text')||'';
        if(text){
          event.preventDefault();
          distribute(text);
        }
      });
      input.addEventListener('reset-otp',()=>distribute(''));
      host.setAttribute('role','group');
      host.setAttribute('aria-label','Six-digit code. Enter each digit or paste the full code into the first box');
      paint(input.value);
    });
  }
  window.HysAuth={ $,msg,busy,post,setupOtpBoxes};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupOtpBoxes);else setupOtpBoxes();
})();