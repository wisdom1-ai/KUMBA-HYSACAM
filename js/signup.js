(()=> {
  const { $, msg, busy, post } = window.HysAuth;
  const form = $('signup-form');
  const button = $('signup-submit');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    msg('');

    const password = $('password').value;
    const confirmation = $('confirm-password').value;

    if (password.length < 8) {
      msg('Choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      msg('Your passwords do not match. Please check and try again.');
      $('confirm-password').focus();
      return;
    }

    busy(button, true);
    try {
      await post('/signup', {
        name: `${$('first-name').value.trim()} ${$('last-name').value.trim()}`.trim(),
        email: $('email').value.trim(),
        password
      });
      sessionStorage.setItem('hysacam_pending_email', $('email').value.trim());
      sessionStorage.setItem('hysacam_pending_purpose', 'signup');
      location.href = 'verify-email.html';
    } catch (error) {
      msg(error.message);
    } finally {
      busy(button, false, 'Create account');
    }
  });
})();
