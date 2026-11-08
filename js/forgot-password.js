(()=>{
  const { $, msg, busy, post } = window.HysAuth;
  const requestForm = $('reset-request-form');
  const completeForm = $('reset-complete-form');
  const requestButton = $('reset-request-submit');
  const completeButton = $('reset-complete-submit');
  let email = '';

  requestForm.addEventListener('submit', async event => {
    event.preventDefault();
    msg('');
    email = $('reset-email').value.trim().toLowerCase();
    busy(requestButton, true);
    try {
      await post('/request-password-reset', { email });
      $('reset-email-label').textContent = email;
      requestForm.hidden = true;
      completeForm.hidden = false;
      $('reset-heading').textContent = 'Check your email';
      $('reset-subtitle').textContent = 'Enter the 6-digit code and choose a new password. The code expires in 10 minutes.';
      msg('If an account exists for this email, a reset code has been sent.', true);
      $('reset-code').focus();
    } catch (error) {
      msg(error.message);
    } finally {
      busy(requestButton, false, 'Send reset code');
    }
  });

  completeForm.addEventListener('submit', async event => {
    event.preventDefault();
    msg('');
    const code = $('reset-code').value.trim();
    const password = $('new-password').value;
    const confirmation = $('confirm-new-password').value;
    if (!/^\d{6}$/.test(code)) return msg('Enter the 6-digit code sent to your email.');
    if (password.length < 8) return msg('Your new password must contain at least 8 characters.');
    if (password !== confirmation) {
      msg('Your passwords do not match. Please check and try again.');
      $('confirm-new-password').focus();
      return;
    }
    busy(completeButton, true);
    try {
      await post('/reset-password', { email, code, password });
      msg('Your password has been reset successfully. Returning to sign in…', true);
      completeButton.textContent = 'Password updated';
      setTimeout(() => location.replace('signin.html'), 1400);
    } catch (error) {
      msg(error.message);
      busy(completeButton, false, 'Reset password');
    }
  });

  $('request-another-code').addEventListener('click', async event => {
    event.preventDefault();
    msg('');
    try {
      await post('/request-password-reset', { email });
      msg('If an account exists for this email, a new reset code has been sent.', true);
    } catch (error) {
      msg(error.message);
    }
  });
})();