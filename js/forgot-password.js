(()=> {
  const { $, msg, busy, post } = window.HysAuth;
  const requestForm=$('reset-request-form'), completeForm=$('reset-complete-form');
  const requestButton=$('reset-request-submit'), completeButton=$('reset-complete-submit');
  const passwordFields=$('reset-password-fields'), codeStage=$('reset-code-stage'), codeInput=$('reset-code');
  let email='',codeVerified=false,checking=false,lastAttempt='';
  async function verifyCode(){
    const code=codeInput.value.replace(/\D/g,'').slice(0,6); codeInput.value=code;
    if(code.length!==6||checking||code===lastAttempt)return;
    checking=true;lastAttempt=code;msg('Checking your code',true);
    try{
      await post('/verify-reset-code',{email,code});
      codeVerified=true;codeStage.hidden=true;passwordFields.hidden=false;
      $('reset-heading').textContent='Choose a new password';
      $('reset-subtitle').textContent='Your code is verified — create your new password';
      msg('Code verified',true);$('new-password').focus({preventScroll:true});
    }catch(error){lastAttempt='';msg(error.message);codeInput.select();}
    finally{checking=false;}
  }
  requestForm.addEventListener('submit',async event=>{
    event.preventDefault();msg('');email=$('reset-email').value.trim().toLowerCase();busy(requestButton,true);
    try{await post('/request-password-reset',{email});requestForm.hidden=true;completeForm.hidden=false;$('reset-heading').textContent='Verify your code';$('reset-subtitle').textContent='A 6-digit code has been sent to your email';msg('Enter your code below',true);codeInput.focus({preventScroll:true});}
    catch(error){msg(error.message);}
    finally{busy(requestButton,false,'Send reset code');}
  });
  codeInput.addEventListener('input',verifyCode);
  codeInput.addEventListener('paste',event=>{event.preventDefault();const value=(event.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);codeInput.value=value;verifyCode();});
  completeForm.addEventListener('submit',async event=>{
    event.preventDefault();msg('');if(!codeVerified)return msg('Verify your 6-digit code first');
    const password=$('new-password').value,confirmation=$('confirm-new-password').value;
    if(password.length<8)return msg('Your new password must contain at least 8 characters');
    if(password!==confirmation){msg('Your passwords do not match');$('confirm-new-password').focus();return;}
    busy(completeButton,true);
    try{await post('/reset-password',{email,code:codeInput.value.trim(),password});msg('Your password has been reset successfully',true);completeButton.textContent='Password updated';setTimeout(()=>location.replace('signin.html'),1400);}
    catch(error){msg(error.message);busy(completeButton,false,'Reset password');}
  });
  $('request-another-code').addEventListener('click',async event=>{event.preventDefault();msg('');try{await post('/request-password-reset',{email});codeVerified=false;lastAttempt='';passwordFields.hidden=true;codeStage.hidden=false;codeInput.value='';msg('A new code has been sent',true);codeInput.focus({preventScroll:true});}catch(error){msg(error.message);}});
})();
