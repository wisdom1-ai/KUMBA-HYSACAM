/* HYSACAM Kumba Tracker: profile editor (self-contained)
 * Features: change photo (gallery or camera), crop, remove photo, edit name,
 * add/change phone, phone verification badge, avatar in header next to the bell.
 * Add to every page:  <script defer src="js/profile-edit.js?v=2"></script>
 * On settings.html the banner button with id="set-hero" also opens the editor.
 */
(() => {
  'use strict';

  // ===== CONFIG =====
  // Only fill these two if the editor says it "could not load your account".
  // Copy the values from js/supabase.js.
  const SUPABASE_URL = '';
  const SUPABASE_ANON_KEY = '';
  const BUCKET = 'avatars';
  // Set true only if SMS (e.g. Twilio) is configured in Supabase Auth > Providers > Phone.
  const ENABLE_SMS_VERIFY = false;
  // ==================

  const $ = id => document.getElementById(id);
  let sb = null, user = null;
  let pendingBlob = null, removePhoto = false;
  const CROP = 280, OUT = 400;
  let cr = { img: null, scale: 1, min: 1, ox: 0, oy: 0, drag: null };

  /* ---------- Supabase client ---------- */
  function findClient() {
    if (sb) return sb;
    for (const k of Object.keys(window)) {
      try {
        const v = window[k];
        if (v && v.auth && typeof v.auth.getUser === 'function' && v.storage) return (sb = v);
      } catch (e) {}
    }
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return sb;
  }
  async function getUser() {
    const c = findClient();
    if (!c) return null;
    try { const { data } = await c.auth.getUser(); return (user = data && data.user) || null; }
    catch (e) { return null; }
  }
  async function waitForUser() {
    for (let i = 0; i < 24; i++) {
      const u = await getUser();
      if (u) return u;
      await new Promise(r => setTimeout(r, 250));
    }
    return null;
  }

  /* ---------- Styles ---------- */
  const css = `
.inner-page .profile-row{font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.inner-page .profile-row .pr-avatar{flex:0 0 60px!important;width:60px!important;height:60px!important;min-width:60px;aspect-ratio:1/1}
.pr-avatar{position:relative;background-size:cover;background-position:center}
.pr-avatar.has-photo svg,.pr-avatar.has-photo::after{display:none!important;content:none!important}
.pr-cam{position:absolute;right:-4px;bottom:-4px;width:22px;height:22px;display:grid;place-items:center;font-style:normal;font-size:11px;background:#fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.pe-hdr{flex:0 0 36px;width:36px;height:36px;margin-right:8px;padding:0;border-radius:50%;border:2px solid #087747;background:#e3f4ea center/cover no-repeat;color:#087747;font:800 13px/1 inherit;display:grid;place-items:center;cursor:pointer}
.pe-sheet{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.45);display:flex;align-items:flex-end}
.pe-sheet[hidden]{display:none}
.pe-card{width:100%;max-height:92vh;overflow-y:auto;box-sizing:border-box;background:#fff;border-radius:24px 24px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));animation:peIn .3s ease both;color:#12372a}
@keyframes peIn{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.pe-card h3{margin:0 0 12px;font-size:19px}
.pe-photo{display:grid;justify-items:center;gap:10px}
.pe-photo img{width:104px;height:104px;border-radius:50%;object-fit:cover;border:3px solid #087747;background:#e3f4ea}
.pe-photo-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.pe-chip{padding:9px 14px;border-radius:999px;border:1.5px solid #cfe5d8;background:#f4faf6;color:#087747;font:700 13px inherit;cursor:pointer}
.pe-chip.danger{color:#b91c1c;border-color:#fecaca;background:#fff5f5}
.pe-field{display:block;margin-top:14px;font-size:12.5px;font-weight:700;color:#26372d}
.pe-field input{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:13px 14px;border:1.5px solid #d5eadd;border-radius:13px;background:#fbfdfc;font:inherit;font-size:16px;color:#12372a}
.pe-field input:focus{outline:none;border-color:#087747;box-shadow:0 0 0 4px rgba(8,119,71,.15)}
.pe-badge{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;font-size:11.5px;font-weight:800}
.pe-badge.ok{background:#e3f4ea;color:#087747}
.pe-badge.no{background:#fff1e0;color:#b45309}
.pe-msg{min-height:1.2em;margin:12px 0 0;font-size:13px;font-weight:600}
.pe-actions{display:flex;gap:10px;margin-top:14px}
.pe-actions button{flex:1;height:50px;border-radius:14px;border:1.5px solid #d5eadd;background:#fff;font:700 15px inherit;color:#12372a;cursor:pointer}
.pe-actions .pe-primary{background:linear-gradient(135deg,#1fbf63,#087747);color:#fff;border:0}
.pe-actions button:disabled{opacity:.6}
.pe-link{display:block;margin-top:12px;text-align:center;font-size:13px;color:#087747;font-weight:700}
.pe-crop{display:grid;justify-items:center;gap:14px}
.pe-crop canvas{width:280px;height:280px;max-width:100%;border-radius:18px;touch-action:none;background:#111;cursor:grab}
.pe-crop input[type=range]{width:100%;accent-color:#087747}
.pe-crop p{margin:0;font-size:12.5px;color:#6b7c74}
`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- Sheet markup ---------- */
  const sheet = document.createElement('div');
  sheet.id = 'pe-sheet';
  sheet.className = 'pe-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
<div class="pe-card" role="dialog" aria-modal="true" aria-labelledby="pe-title">
  <div id="pe-main">
    <h3 id="pe-title">Edit profile</h3>
    <div class="pe-photo">
      <img id="pe-preview" src="images/hysacam-symbol.svg" alt="Profile photo">
      <div class="pe-photo-btns">
        <button type="button" class="pe-chip" id="pe-choose">Choose photo</button>
        <button type="button" class="pe-chip" id="pe-camera">Take photo</button>
        <button type="button" class="pe-chip danger" id="pe-remove" hidden>Remove</button>
      </div>
      <input id="pe-file" type="file" accept="image/*" hidden>
      <input id="pe-cam" type="file" accept="image/*" capture="user" hidden>
    </div>
    <label class="pe-field">Full name
      <input id="pe-name" type="text" autocomplete="name" maxlength="60" placeholder="Your name">
    </label>
    <label class="pe-field">Phone number
      <input id="pe-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+237 6XX XXX XXX">
    </label>
    <span id="pe-badge" class="pe-badge" hidden></span>
    <div id="pe-verify" hidden>
      <button type="button" class="pe-chip" id="pe-send-code" style="margin-top:10px">Send verification code</button>
      <label class="pe-field" id="pe-code-wrap" hidden>Verification code
        <input id="pe-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8">
      </label>
      <button type="button" class="pe-chip" id="pe-confirm-code" style="margin-top:10px" hidden>Confirm code</button>
    </div>
    <p id="pe-msg" class="pe-msg" role="status" aria-live="polite"></p>
    <div class="pe-actions">
      <button type="button" id="pe-cancel">Cancel</button>
      <button type="button" id="pe-save" class="pe-primary">Save</button>
    </div>
    <a class="pe-link" href="profile.html">Open full profile</a>
  </div>
  <div id="pe-cropview" class="pe-crop" hidden>
    <h3>Crop photo</h3>
    <canvas id="pe-canvas" width="${CROP}" height="${CROP}"></canvas>
    <input id="pe-zoom" type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom">
    <p>Drag to move, slide to zoom</p>
    <div class="pe-actions" style="width:100%">
      <button type="button" id="pe-crop-cancel">Back</button>
      <button type="button" id="pe-crop-ok" class="pe-primary">Use photo</button>
    </div>
  </div>
</div>`;

  /* ---------- Helpers ---------- */
  const say = (t, bad) => { const m = $('pe-msg'); m.textContent = t || ''; m.style.color = bad ? '#c00' : '#087747'; };
  const initials = n => (n || '').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '•';
  const close = () => { sheet.hidden = true; };
  const metaOf = u => (u && u.user_metadata) || {};
  const nameOf = u => metaOf(u).full_name || metaOf(u).name || '';

  function paintAvatars(u) {
    const md = metaOf(u), url = md.avatar_url, nm = nameOf(u);
    const av = $('settings-avatar');
    if (av) {
      if (url) { av.classList.add('has-photo'); av.style.backgroundImage = 'url("' + url + '")'; }
      else { av.classList.remove('has-photo'); av.style.backgroundImage = ''; }
    }
    const nEl = $('settings-user-name');
    if (nEl && nm) nEl.textContent = nm;
    const h = document.querySelector('.pe-hdr');
    if (h) {
      if (url) { h.style.backgroundImage = 'url("' + url + '")'; h.textContent = ''; }
      else { h.style.backgroundImage = ''; h.textContent = initials(nm || (u.email || '')); }
    }
  }

  function paintBadge(u) {
    const b = $('pe-badge');
    const phone = (metaOf(u).phone_number || '').trim();
    const verified = !!u.phone_confirmed_at && !!phone;
    if (!phone) { b.hidden = true; return; }
    if (verified) { b.hidden = false; b.className = 'pe-badge ok'; b.textContent = '✓ Phone verified'; }
    else if (ENABLE_SMS_VERIFY) { b.hidden = false; b.className = 'pe-badge no'; b.textContent = 'Phone not verified'; }
    else { b.hidden = true; }
    $('pe-verify').hidden = !(ENABLE_SMS_VERIFY && !verified);
  }

  /* ---------- Open / close ---------- */
  async function openSheet() {
    pendingBlob = null; removePhoto = false; say('');
    $('pe-cropview').hidden = true; $('pe-main').hidden = false;
    $('pe-code-wrap').hidden = true; $('pe-confirm-code').hidden = true;
    sheet.hidden = false;
    const u = await getUser();
    if (!u) { say('Could not load your account. Refresh the page and try again.', true); return; }
    const md = metaOf(u);
    $('pe-name').value = nameOf(u);
    $('pe-phone').value = md.phone_number || '';
    $('pe-preview').src = md.avatar_url || 'images/hysacam-symbol.svg';
    $('pe-remove').hidden = !md.avatar_url;
    paintBadge(u);
  }

  /* ---------- Crop ---------- */
  function drawCrop() {
    const c = $('pe-canvas'), g = c.getContext('2d'), { img, scale, ox, oy } = cr;
    g.clearRect(0, 0, CROP, CROP);
    g.drawImage(img, ox, oy, img.width * scale, img.height * scale);
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.beginPath();
    g.rect(0, 0, CROP, CROP);
    g.arc(CROP / 2, CROP / 2, CROP / 2 - 6, 0, Math.PI * 2, true);
    g.fill('evenodd');
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(CROP / 2, CROP / 2, CROP / 2 - 6, 0, Math.PI * 2); g.stroke();
  }
  function clampCrop() {
    const w = cr.img.width * cr.scale, h = cr.img.height * cr.scale;
    cr.ox = Math.min(0, Math.max(CROP - w, cr.ox));
    cr.oy = Math.min(0, Math.max(CROP - h, cr.oy));
  }
  function startCrop(file) {
    const img = new Image();
    img.onload = () => {
      cr.img = img;
      cr.min = Math.max(CROP / img.width, CROP / img.height);
      cr.scale = cr.min;
      cr.ox = (CROP - img.width * cr.scale) / 2;
      cr.oy = (CROP - img.height * cr.scale) / 2;
      $('pe-zoom').value = 1;
      $('pe-main').hidden = true; $('pe-cropview').hidden = false;
      drawCrop();
    };
    img.onerror = () => say('Could not read that image', true);
    img.src = URL.createObjectURL(file);
  }
  function bindCrop() {
    const c = $('pe-canvas');
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      cr.drag = { x: e.clientX, y: e.clientY, ox: cr.ox, oy: cr.oy };
    });
    c.addEventListener('pointermove', e => {
      if (!cr.drag) return;
      const k = CROP / c.getBoundingClientRect().width;
      cr.ox = cr.drag.ox + (e.clientX - cr.drag.x) * k;
      cr.oy = cr.drag.oy + (e.clientY - cr.drag.y) * k;
      clampCrop(); drawCrop();
    });
    const end = () => { cr.drag = null; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    $('pe-zoom').addEventListener('input', e => {
      const old = cr.scale, next = cr.min * parseFloat(e.target.value);
      const cx = (CROP / 2 - cr.ox) / old, cy = (CROP / 2 - cr.oy) / old;
      cr.scale = next;
      cr.ox = CROP / 2 - cx * next; cr.oy = CROP / 2 - cy * next;
      clampCrop(); drawCrop();
    });
    $('pe-crop-cancel').onclick = () => { $('pe-cropview').hidden = true; $('pe-main').hidden = false; };
    $('pe-crop-ok').onclick = () => {
      const o = document.createElement('canvas'); o.width = o.height = OUT;
      const r = OUT / CROP, g = o.getContext('2d');
      g.drawImage(cr.img, cr.ox * r, cr.oy * r, cr.img.width * cr.scale * r, cr.img.height * cr.scale * r);
      o.toBlob(b => {
        if (!b) return say('Image error. Try another photo.', true);
        pendingBlob = b; removePhoto = false;
        $('pe-preview').src = URL.createObjectURL(b);
        $('pe-remove').hidden = false;
        $('pe-cropview').hidden = true; $('pe-main').hidden = false;
      }, 'image/jpeg', 0.88);
    };
  }

  /* ---------- Save ---------- */
  async function save() {
    const name = $('pe-name').value.trim();
    const phone = $('pe-phone').value.trim();
    if (name.length > 60) return say('Name is too long', true);
    if (phone && !/^\+?[0-9\s-]{8,15}$/.test(phone)) return say('Enter a valid phone number', true);
    const btn = $('pe-save'); btn.disabled = true; say('Saving…');
    try {
      const u = user || await getUser();
      if (!u) throw new Error('Could not load your account');
      const path = u.id + '/avatar.jpg';
      const data = { phone_number: phone };
      if (name) { data.full_name = name; data.name = name; }
      if (pendingBlob) {
        const up = await sb.storage.from(BUCKET).upload(path, pendingBlob, { upsert: true, contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        data.avatar_url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
      } else if (removePhoto) {
        await sb.storage.from(BUCKET).remove([path]);
        data.avatar_url = null;
      }
      const res = await sb.auth.updateUser({ data });
      if (res.error) throw res.error;
      user = res.data.user;
      paintAvatars(user); paintBadge(user);
      say('Saved ✓');
      setTimeout(close, 700);
    } catch (err) {
      say((err && err.message) || 'Could not save. Try again.', true);
    } finally { btn.disabled = false; }
  }

  /* ---------- Optional SMS verification ---------- */
  async function sendCode() {
    const phone = $('pe-phone').value.trim().replace(/[\s-]/g, '');
    if (!/^\+[0-9]{8,15}$/.test(phone)) return say('Use the full number with country code, e.g. +2376XXXXXXXX', true);
    say('Sending code…');
    const { error } = await sb.auth.updateUser({ phone });
    if (error) return say(error.message, true);
    $('pe-code-wrap').hidden = false; $('pe-confirm-code').hidden = false;
    say('Code sent. Enter it below.');
  }
  async function confirmCode() {
    const phone = $('pe-phone').value.trim().replace(/[\s-]/g, '');
    const token = $('pe-code').value.trim();
    if (!token) return say('Enter the code', true);
    const { error } = await sb.auth.verifyOtp({ phone, token, type: 'phone_change' });
    if (error) return say(error.message, true);
    const u = await getUser();
    if (u) { paintBadge(u); say('Phone verified ✓'); }
  }

  /* ---------- Header avatar ---------- */
  async function addHeaderAvatar() {
    const tools = document.querySelector('.header-tools');
    if (!tools || document.querySelector('.pe-hdr')) return;
    const u = await waitForUser();
    if (!u) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pe-hdr'; b.setAttribute('aria-label', 'Edit profile');
    b.addEventListener('click', openSheet);
    tools.insertBefore(b, tools.firstChild);
    paintAvatars(u);
  }

  /* ---------- Init ---------- */
  function init() {
    document.body.appendChild(sheet);
    bindCrop();
    $('pe-choose').onclick = () => $('pe-file').click();
    $('pe-camera').onclick = () => $('pe-cam').click();
    const onFile = e => { const f = e.target.files[0]; e.target.value = ''; if (f) startCrop(f); };
    $('pe-file').onchange = onFile;
    $('pe-cam').onchange = onFile;
    $('pe-remove').onclick = () => {
      pendingBlob = null; removePhoto = true;
      $('pe-preview').src = 'images/hysacam-symbol.svg';
      $('pe-remove').hidden = true;
    };
    $('pe-cancel').onclick = close;
    $('pe-save').onclick = save;
    $('pe-send-code').onclick = sendCode;
    $('pe-confirm-code').onclick = confirmCode;
    sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) close(); });

    const hero = $('set-hero');
    if (hero) hero.addEventListener('click', e => { e.preventDefault(); openSheet(); });

    addHeaderAvatar();
    // paint settings banner avatar/name once the user is known
    waitForUser().then(u => { if (u) paintAvatars(u); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
