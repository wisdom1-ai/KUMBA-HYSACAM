(()=> {
  const { $, msg, busy, post } = window.HysAuth;
  const email = sessionStorage.getItem('hysacam_pending_email');
  const purpose = sessionStorage.getItem('hysacam_pending_purpose');

  if (!email || !purpose) {
    location.replace('signin.html');
    return;
  }

  const form = $('verify-form');
  const button = $('verify-submit');

  button.textContent = purpose === 'signup' ? 'Verify & continue' : 'Verify & sign in';

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const code = $('verification-code').value.trim();

    if (!/^\d{6}$/.test(code)) {
      msg('Enter the 6-digit code sent to your email.');
      return;
    }

    msg('');
    busy(button, true);
    try {
      await post('/verify', { email, code, purpose });
      sessionStorage.removeItem('hysacam_pending_email');
      sessionStorage.removeItem('hysacam_pending_purpose');
      const __nx=sessionStorage.getItem('hysacam_next');sessionStorage.removeItem('hysacam_next');location.replace(__nx&&/^[\w-]+\.html$/.test(__nx)?__nx:'index.html');
    } catch (error) {
      msg(error.message);
    } finally {
      busy(button, false, purpose === 'signup' ? 'Verify & continue' : 'Verify & sign in');
    }
  });

  $('resend-code').addEventListener('click', async event => {
    event.preventDefault();
    msg('');
    const link = $('resend-code');
    link.classList.add('is-loading');
    try {
      await post('/resend-code', { email, purpose });
      msg('A fresh verification code has been sent.', true);
    } catch (error) {
      msg(error.message);
    } finally {
      link.classList.remove('is-loading');
    }
  });
})();
