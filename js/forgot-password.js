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

  verifyButton.addEventListener('click', async () => {
    msg('');
    codeVerified = false;
    const code = $('reset-code').value.trim();
    if (!/^\d{6}$/.test(code)) return msg('Enter all 6 digits before continuing.');
    busy(verifyButton, true);
    try {
      await post('/verify-reset-code', { email, code });
      codeVerified = true;
      passwordFields.hidden = false;
      verifyButton.hidden = true;
      $('reset-heading').textContent = 'Choose a new password';
      $('reset-subtitle').textContent = 'Your code is verified. Create and confirm your new password below.';
      msg('Code verified. You can now create your new password.', true);
      $('new-password').focus();
    } catch (error) { msg(error.message); }
    finally { if (!codeVerified) busy(verifyButton, false, 'Verify code'); }
  });

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
      codeVerified = false; passwordFields.hidden = true; verifyButton.hidden = false;
      busy(verifyButton, false, 'Verify code');
      msg('If an account exists for this email, a new reset code has been sent.', true);
    } catch (error) { msg(error.message); }
  });
})();
