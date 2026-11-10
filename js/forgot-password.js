(()=>{
  const { $, msg, busy, post } = window.HysAuth;
  const requestForm = $('reset-request-form');
  const completeForm = $('reset-complete-form');
  const requestButton = $('reset-request-submit');
  const completeButton = $('reset-complete-submit');
  const verifyButton = $('verify-reset-code');
  const passwordFields = $('reset-password-fields');
  let email = '';
  let codeVerified = false;
  let verificationInFlight = false;
  let lastAttemptedCode = '';

  requestForm.addEventListener('submit', async event => {
    event.preventDefault(); msg('');
    email = $('reset-email').value.trim().toLowerCase();
    busy(requestButton, true);
    try {
      await post('/request-password-reset', { email });
      requestForm.hidden = true; completeForm.hidden = false;
      $('reset-heading').textContent = 'Verify your reset code';
      $('reset-subtitle').textContent = 'Enter the 6-digit code sent to your email. Your new password fields will appear after verification.';
      msg('If an account exists for this email, a reset code has been sent.', true);
      $('reset-code').focus();
    } catch (error) {
      const text = /reset requests|reset codes recently|60 seconds/i.test(error.message || '')
        ? 'For account security, please wait a little before requesting another reset code'
        : error.message;
      msg(text);
    } finally { busy(requestButton, false, 'Send reset code'); }
  });

  async function verifyResetCode() {
    const code = $('reset-code').value.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(code) || verificationInFlight || codeVerified || code === lastAttemptedCode) return;
    verificationInFlight = true;
    lastAttemptedCode = code;
    msg('Checking your code');
    busy(verifyButton, true, 'Verify code');
    try {
      await post('/verify-reset-code', { email, code });
      codeVerified = true;
      $('reset-code-field').hidden = true;
      verifyButton.hidden = true;
      passwordFields.hidden = false;
      $('reset-heading').textContent = 'Choose a new password';
      $('reset-subtitle').textContent = 'Your code is verified — create and confirm your new password below';
      msg('Code verified — create your new password', true);
      $('new-password').focus({preventScroll:true});
    } catch (error) {
      msg(error.message);
      lastAttemptedCode = '';
    } finally {
      verificationInFlight = false;
      if (!codeVerified) busy(verifyButton, false, 'Verify code');
    }
  }
  verifyButton.addEventListener('click', verifyResetCode);
  $('reset-code').addEventListener('input', event => {
    const cleaned = event.target.value.replace(/\D/g, '').slice(0, 6);
    if (event.target.value !== cleaned) event.target.value = cleaned;
    if (cleaned.length === 6) verifyResetCode();
  });
  $('reset-code').addEventListener('paste', () => setTimeout(() => {
    if ($('reset-code').value.replace(/\D/g, '').length === 6) verifyResetCode();
  }, 0));

  completeForm.addEventListener('submit', async event => {
    event.preventDefault(); msg('');
    if (!codeVerified) return msg('Verify your 6-digit code before choosing a new password.');
    const code = $('reset-code').value.trim();
    const password = $('new-password').value;
    const confirmation = $('confirm-new-password').value;
    if (password.length < 8) return msg('Your new password must contain at least 8 characters.');
    if (password !== confirmation) {
      msg('Your passwords do not match. Please check and try again.');
      $('confirm-new-password').focus(); return;
    }
    busy(completeButton, true);
    try {
      await post('/reset-password', { email, code, password });
      msg('Your password has been reset successfully. Returning to sign in…', true);
      completeButton.textContent = 'Password updated';
      setTimeout(() => location.replace('signin.html'), 1400);
    } catch (error) { msg(error.message); busy(completeButton, false, 'Reset password'); }
  });

  $('request-another-code').addEventListener('click', async event => {
    event.preventDefault(); msg('');
    try {
      await post('/request-password-reset', { email });
      codeVerified = false; lastAttemptedCode = ''; $('reset-code-field').hidden = false; $('reset-code').value = ''; passwordFields.hidden = true; verifyButton.hidden = false;
      busy(verifyButton, false, 'Verify code');
      msg('If an account exists for this email, a new reset code has been sent.', true);
    } catch (error) { msg(error.message); }
  });
})();
