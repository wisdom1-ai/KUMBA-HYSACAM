(()=> {
  const { $, msg, busy, post } = window.HysAuth;
  const form = $('signup-form');
  const button = $('signup-submit');
  form.addEventListener('submit', async event => {
    event.preventDefault(); msg('');
    const first = $('first-name').value.trim();
    const last = $('last-name').value.trim();
    const password = $('password').value;
    if (password.length < 8) return msg('Choose a password with at least 8 characters');
    busy(button, true);
    try {
      const email = $('email').value.trim().toLowerCase();
      await post('/signup', { name: `${first} ${last}`.trim(), email, password });
      sessionStorage.setItem('hysacam_pending_email', email);
      sessionStorage.setItem('hysacam_pending_purpose', 'signup');
      location.href = 'verify-email.html';
    } catch (error) { msg(error.message); }
    finally { busy(button, false, 'Sign Up'); }
  });
})();
