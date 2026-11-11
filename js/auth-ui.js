(()=>{
  const eye='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.2 12s3.5-6.5 9.8-6.5 9.8 6.5 9.8 6.5-3.5 6.5-9.8 6.5S2.2 12 2.2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  const eyeOff='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 3 18 18M10.6 5.7A10.8 10.8 0 0 1 12 5.5c6.3 0 9.8 6.5 9.8 6.5a16 16 0 0 1-3.1 3.7M6.2 6.3C3.6 8 2.2 12 2.2 12s3.5 6.5 9.8 6.5c1.5 0 2.8-.4 4-1"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';
  document.querySelectorAll('[data-toggle-password]').forEach(button=>{
    const input=document.getElementById(button.dataset.togglePassword);if(!input)return;
    button.innerHTML=eye;button.classList.add('password-toggle-icon');
    button.addEventListener('pointerdown',event=>{event.preventDefault()});
    button.addEventListener('click',()=>{
      const start=input.selectionStart,end=input.selectionEnd,showing=input.type==='text';
      input.type=showing?'password':'text';button.innerHTML=showing?eye:eyeOff;
      button.setAttribute('aria-label',showing?'Show password':'Hide password');button.setAttribute('title',showing?'Show password':'Hide password');
      input.focus({preventScroll:true});try{if(start!==null&&end!==null)input.setSelectionRange(start,end)}catch{}
    });
  });
})();