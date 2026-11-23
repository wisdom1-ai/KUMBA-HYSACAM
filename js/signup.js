(()=> {
  const { $, msg, busy, post } = window.HysAuth;
  const form = $('signup-form');
  const button = $('signup-submit');
  if (!form) return;

  // Remember where to go after the account is verified (for example, the page the visitor came from)
  const next = (new URLSearchParams(location.search).get('next') || '').replace(/^\/+/, '');
  if (/^[\w-]+\.html$/.test(next)) sessionStorage.setItem('hysacam_next', next);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    msg('');
    const first = $('first-name').value.trim();
    const last = $('last-name').value.trim();
    const email = $('email').value.trim().toLowerCase();
    const password = $('password').value;
    const confirm = $('confirm-password').value;

    if (!first || !last) { msg('Enter your first and last name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg('Enter a valid email address.'); return; }
    if (password.length < 8) { msg('Your password must be at least 8 characters.'); return; }
    if (password !== confirm) { msg('The two passwords do not match.'); return; }

    const full = (first + ' ' + last).trim();
    busy(button, true);
    try {
      await post('/signup', {
        name: full, full_name: full, fullName: full,
        first_name: first, last_name: last, firstName: first, lastName: last,
        email, password,
        confirmPassword: confirm, confirm_password: confirm
      });
      sessionStorage.setItem('hysacam_pending_email', email);
      sessionStorage.setItem('hysacam_pending_purpose', 'signup');
      location.href = 'verify-email.html';
    } catch (error) {
      msg(error.message);
    } finally {
      busy(button, false, 'Sign Up');
    }
  });
})();
