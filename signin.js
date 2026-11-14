(()=> {
  const { $, msg, busy, post } = window.HysAuth;
  const form = $('signin-form');
  const button = $('signin-submit');

  const flash = sessionStorage.getItem('hysacam_auth_flash');
  if (flash) {
    msg(flash);
    sessionStorage.removeItem('hysacam_auth_flash');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    msg('');
    busy(button, true);

    try {
      await post('/login', {
        email: $('email').value.trim(),
        password: $('password').value
      });
      sessionStorage.setItem('hysacam_pending_email', $('email').value.trim());
      sessionStorage.setItem('hysacam_pending_purpose', 'login');
      location.href = 'verify-email.html';
    } catch (error) {
      msg(error.message);
    } finally {
      busy(button, false, 'Sign in');
    }
  });
})();
