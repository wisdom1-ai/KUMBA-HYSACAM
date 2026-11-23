(()=> {
  const { $, msg, busy, post } = window.HysAuth;
  const email = sessionStorage.getItem('hysacam_pending_email');
  const purpose = sessionStorage.getItem('hysacam_pending_purpose');

  if (!email || !purpose) {
    location.replace('signin.html');
    return;
  }

  const LABEL = 'Verify';
  const form = $('verify-form');
  const button = $('verify-submit');
  const input = $('verification-code');
  button.textContent = LABEL;

  /* ---------- Verify (also runs by itself when the 6th digit is entered) ---------- */
  let verifying = false;
  async function verify() {
    if (verifying) return;
    const code = input.value.trim();

    if (!/^\d{6}$/.test(code)) {
      msg('Enter the 6-digit code sent to your email.');
      return;
    }

    verifying = true;
    msg('');
    busy(button, true);
    try {
      await post('/verify', { email, code, purpose });
      sessionStorage.removeItem('hysacam_pending_email');
      sessionStorage.removeItem('hysacam_pending_purpose');
      const __nx=sessionStorage.getItem('hysacam_next');sessionStorage.removeItem('hysacam_next');location.replace(__nx&&/^[\w-]+\.html$/.test(__nx)?__nx:'index.html');
    } catch (error) {
      msg(error.message);
      input.value = '';                                   // wrong code: clear it so the user can type again
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    } finally {
      verifying = false;
      busy(button, false, LABEL);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    verify();
  });

  let lastAuto = '';
  function checkCode() {
    const v = input.value.replace(/\D/g, '');
    if (v.length < 6) { lastAuto = ''; return; }
    if (v.length !== 6 || v === lastAuto || verifying) return;
    lastAuto = v;
    setTimeout(() => { if (input.value.replace(/\D/g, '') === v) verify(); }, 200);
  }
  ['input', 'keyup', 'change'].forEach(name => input.addEventListener(name, checkCode));
  setInterval(checkCode, 300);

  /* ---------- Resend: 60-second wait between codes ---------- */
  const DUR = 60;
  const KEY = 'hysacam-resend-until:' + email.toLowerCase();
  const resend = $('resend-code');
  const bar = document.querySelector('.resend-bar i');
  let memUntil = 0, resending = false;

  const getUntil = () => { try { return Number(localStorage.getItem(KEY)) || memUntil; } catch { return memUntil; } };
  const setUntil = t => { memUntil = t; try { localStorage.setItem(KEY, String(t)); } catch {} };
  const secondsLeft = () => Math.max(0, Math.ceil((getUntil() - Date.now()) / 1000));
  const fmt = s => Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);

  function tick() {
    if (resending) return;
    const left = secondsLeft();
    if (left > 0) {
      resend.setAttribute('aria-disabled', 'true');
      resend.textContent = 'Resend code in ' + fmt(left);
      if (bar) bar.style.transform = 'scaleX(' + (left / DUR) + ')';
    } else {
      resend.removeAttribute('aria-disabled');
      resend.textContent = 'Resend code';
      if (bar) bar.style.transform = 'scaleX(0)';
    }
  }
  const startWait = () => { setUntil(Date.now() + DUR * 1000); tick(); };

  if (!getUntil()) startWait();     // a code was just sent when this page opened
  tick();
  setInterval(tick, 1000);

  resend.addEventListener('click', async event => {
    event.preventDefault();
    if (resending || secondsLeft() > 0) return;
    resending = true;
    msg('');
    resend.classList.add('is-loading');
    resend.textContent = 'Sending…';
    try {
      await post('/resend-code', { email, purpose });
      msg('A fresh verification code has been sent.', true);
      startWait();
    } catch (error) {
      msg(error.message);
    } finally {
      resending = false;
      resend.classList.remove('is-loading');
      tick();
    }
  });
})();
