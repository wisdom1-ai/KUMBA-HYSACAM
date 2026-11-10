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
  let verificationInFlight = false;
  let lastAttemptedCode = '';

  button.textContent = purpose === 'signup' ? 'Verify & open dashboard' : 'Verify & sign in';

  async function verifyCode() {
    const input = $('verification-code');
    const code = input.value.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(code) || verificationInFlight || code === lastAttemptedCode) return;
    verificationInFlight = true;
    lastAttemptedCode = code;
    msg('Checking your code');
    busy(button, true);
    try {
      await post('/verify', { email, code, purpose });
      sessionStorage.removeItem('hysacam_pending_email');
      sessionStorage.removeItem('hysacam_pending_purpose');
      location.replace('index.html');
    } catch (error) {
      msg(error.message);
      lastAttemptedCode = '';
    } finally {
      verificationInFlight = false;
      busy(button, false, purpose === 'signup' ? 'Verify & open dashboard' : 'Verify & sign in');
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); verifyCode(); });
  $('verification-code').addEventListener('input', event => {
    const cleaned = event.target.value.replace(/\D/g, '').slice(0, 6);
    if (event.target.value !== cleaned) event.target.value = cleaned;
    if (cleaned.length === 6) verifyCode();
  });
  $('verification-code').addEventListener('paste', () => setTimeout(() => {
    if ($('verification-code').value.replace(/\D/g, '').length === 6) verifyCode();
  }, 0));

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
