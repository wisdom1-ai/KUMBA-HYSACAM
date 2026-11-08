(()=>{
  const { $, msg, busy, post } = window.HysAuth;
  const requestForm = $('reset-request-form');
  const codeForm = $('reset-code-form');
  const passwordForm = $('reset-password-form');
  const requestButton = $('reset-request-submit');
  const codeButton = $('reset-code-submit');
  const passwordButton = $('reset-password-submit');
  const codeInput = $('reset-code');
  let email = '';
  let verifiedCode = '';

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
  });

  requestForm.addEventListener('submit', async event => {
    event.preventDefault();
    msg('');
    email = $('reset-email').value.trim().toLowerCase();
    busy(requestButton, true);
    try {
      await post('/request-password-reset', { email });
      $('reset-email-label').textContent = email;
      requestForm.hidden = true;
      codeForm.hidden = false;
      $('reset-heading').textContent = 'Verify your email';
      $('reset-subtitle').textContent = 'Enter the 6-digit code sent to your email. You must verify this code before creating a new password.';
      msg('If an account exists for this email, a reset code has been sent.', true);
      codeInput.focus();
    } catch (error) {
      const text = /reset requests|reset codes recently|60 seconds/i.test(error.message || '')
        ? 'For account security, please wait a little before requesting another reset code'
        : error.message;
      msg(text);
    } finally {
      busy(requestButton, false, 'Send reset code');
    }
  });

  codeForm.addEventListener('submit', async event => {
    event.preventDefault();
    msg('');
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      msg('Enter the complete 6-digit code sent to your email.');
      codeInput.focus();
      return;
    }
    busy(codeButton, true);
    try {
      await post('/verify-password-reset-code', { email, code });
      verifiedCode = code;
      $('verified-reset-email').textContent = email;
      codeForm.hidden = true;
      passwordForm.hidden = false;
      $('reset-heading').textContent = 'Create a new password';
      $('reset-subtitle').textContent = 'Your email has been verified. Choose a new password for your account.';
      msg('Code verified. You can now create your new password.', true);
      $('new-password').focus();
    } catch (error) {
      msg(error.message || 'That code could not be verified. Please try again.');
      codeInput.focus();
    } finally {
      busy(codeButton, false, 'Verify code');
    }
  });

  passwordForm.addEventListener('submit', async event => {
    event.preventDefault();
    msg('');
    const password = $('new-password').value;
    const confirmation = $('confirm-new-password').value;
    if (password.length < 8) return msg('Your new password must contain at least 8 characters.');
    if (password !== confirmation) {
      msg('Your passwords do not match. Please check and try again.');
      $('confirm-new-password').focus();
      return;
    }
    busy(passwordButton, true);
    try {
      await post('/reset-password', { email, code: verifiedCode, password });
      msg('Your password has been reset successfully. Returning to sign in…', true);
      passwordButton.textContent = 'Password updated';
      setTimeout(() => location.replace('signin.html'), 1400);
    } catch (error) {
      msg(error.message);
      busy(passwordButton, false, 'Update password');
    }
  });

  $('request-another-code').addEventListener('click', async event => {
    event.preventDefault();
    msg('');
    const link = event.currentTarget;
    link.classList.add('is-loading');
    try {
      await post('/request-password-reset', { email });
      codeInput.value = '';
      verifiedCode = '';
      msg('If an account exists for this email, a new reset code has been sent.', true);
      codeInput.focus();
    } catch (error) {
      msg(error.message);
    } finally {
      link.classList.remove('is-loading');
    }
  });
})();
