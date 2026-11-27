
"use strict";

(function () {
  const root = document.getElementById("profile-account-root");
  if (!root) return;

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function getClient() {
    for (let i = 0; i < 80; i++) {
      const client = window.supabaseClient;
      if (client) return client;
      await wait(100);
    }
    return null;
  }

  let client, user, profile = {};
  let selectedPhoto = null;
  let original = {};
  const BUCKET = "profile-photos";

  const esc = value => String(value || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));

  const initials = name => {
    const parts = String(name || "User").trim().split(/\s+/);
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  };

  const dateText = value => {
    if (!value) return "—";
    const date = new Date(value);
    return isNaN(date) ? "—" : date.toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric"
    });
  };

  function message(text, type = "") {
    const el = document.getElementById("pa-message");
    if (!el) return;
    el.textContent = text;
    el.className = "pa-message " + type;
  }

  function values() {
    const meta = user.user_metadata || {};
    return {
      full_name: profile.full_name || meta.full_name || meta.name || "",
      phone: profile.phone || meta.phone || user.phone || "",
      town: profile.town || meta.town || "",
      area: profile.area || meta.area || "",
      avatar_url: profile.avatar_url || meta.avatar_url || ""
    };
  }

  function render() {
    const v = values();
    const name = v.full_name || "Your name";
    const photo = v.avatar_url;

    root.innerHTML = `
      <div class="pa-page">
        <header class="pa-heading">
          <div>
            <span class="pa-eyebrow">YOUR ACCOUNT</span>
            <h2>My Profile</h2>
            <p>Manage your personal information and account details.</p>
          </div>
          <span class="pa-status">● Account active</span>
        </header>

        <section class="pa-profile-hero">
          <div class="pa-photo-wrap">
            <div class="pa-photo" id="pa-photo">
              ${photo
                ? `<img src="${esc(photo)}" alt="Profile picture">`
                : `<span>${esc(initials(name))}</span>`}
            </div>
            <label class="pa-camera" for="pa-photo-input" title="Change profile picture">＋</label>
            <input id="pa-photo-input" type="file" accept="image/png,image/jpeg,image/webp" hidden>
          </div>

          <div class="pa-hero-info">
            <h3 id="pa-display-name">${esc(name)}</h3>
            <p>${esc(user.email || "No email address")}</p>
            <span class="pa-role">${esc(profile.role || user.app_metadata?.role || "Resident")}</span>
          </div>
          <div class="pa-photo-actions">
            <label for="pa-photo-input" class="pa-outline-btn">Change photo</label>
            <button type="button" class="pa-text-btn" id="pa-remove-photo">Remove</button>
          </div>
        </section>

        <section class="pa-progress-card">
          <div class="pa-progress-top">
            <div><strong>Profile completion</strong><p>Complete your details to improve your account.</p></div>
            <strong id="pa-progress-number">0%</strong>
          </div>
          <div class="pa-progress-track"><div id="pa-progress-fill"></div></div>
          <small id="pa-progress-caption"></small>
        </section>

        <form id="pa-form">
          <section class="pa-card">
            <div class="pa-section-heading">
              <div><span>01</span><h3>Personal information</h3></div>
              <p>Keep your details up to date.</p>
            </div>

            <div class="pa-fields">
              <label class="pa-field">
                Full name
                <input id="pa-name" maxlength="80" autocomplete="name" placeholder="Enter your full name" required>
              </label>
              <label class="pa-field">
                Email address
                <input value="${esc(user.email || "")}" type="email" disabled>
                <small>Email changes are managed through account security.</small>
              </label>
              <label class="pa-field">
                Phone number
                <input id="pa-phone" type="tel" maxlength="25" autocomplete="tel" placeholder="+237 6XX XXX XXX">
              </label>
              <label class="pa-field">
                Town / City
                <input id="pa-town" maxlength="80" placeholder="e.g. Kumba">
              </label>
              <label class="pa-field pa-full">
                Residential area
                <input id="pa-area" maxlength="120" placeholder="e.g. Fiango, Mbonge Road">
              </label>
            </div>
          </section>

          <section class="pa-card">
            <div class="pa-section-heading">
              <div><span>02</span><h3>Account information</h3></div>
              <p>Your HYSACAM account details.</p>
            </div>
            <div class="pa-account-details">
              <div><span>Member since</span><strong>${dateText(user.created_at)}</strong></div>
              <div><span>Email verification</span><strong>${user.email_confirmed_at ? "Verified" : "Not verified"}</strong></div>
              <div><span>Account type</span><strong>${esc(profile.role || user.app_metadata?.role || "Resident")}</strong></div>
            </div>
          </section>

          <div class="pa-save-area">
            <p id="pa-message" class="pa-message" role="status" aria-live="polite"></p>
            <button type="button" class="pa-cancel-btn" id="pa-cancel">Cancel</button>
            <button type="submit" class="pa-save-btn" id="pa-save">Save changes</button>
          </div>
        </form>

        <section class="pa-security-link">
          <div><strong>Account security</strong><p>Manage your password and sign-in settings.</p></div>
          <a href="settings.html#security">Manage security →</a>
        </section>
      </div>
    `;

    document.getElementById("pa-name").value = v.full_name;
    document.getElementById("pa-phone").value = v.phone;
    document.getElementById("pa-town").value = v.town;
    document.getElementById("pa-area").value = v.area;

    original = {
      full_name: v.full_name,
      phone: v.phone,
      town: v.town,
      area: v.area,
      avatar_url: v.avatar_url
    };

    updateProgress();
    wire();
  }

  function updateProgress() {
    const ids = ["pa-name", "pa-phone", "pa-town", "pa-area"];
    const completed = ids.filter(id => document.getElementById(id)?.value.trim()).length;
    const percent = Math.round((completed / ids.length) * 100);
    document.getElementById("pa-progress-number").textContent = percent + "%";
    document.getElementById("pa-progress-fill").style.width = percent + "%";
    document.getElementById("pa-progress-caption").textContent =
      completed === 4 ? "Your personal information is complete." :
      `${completed} of ${ids.length} personal details completed.`;
  }

  function previewPhoto(file) {
    const photo = document.getElementById("pa-photo");
    if (selectedPhoto?.preview) URL.revokeObjectURL(selectedPhoto.preview);
    selectedPhoto = { file, preview: URL.createObjectURL(file) };
    photo.innerHTML = `<img src="${selectedPhoto.preview}" alt="New profile picture preview">`;
    message("Photo ready. Save your changes to upload it.", "info");
  }

  function wire() {
    const form = document.getElementById("pa-form");
    const photoInput = document.getElementById("pa-photo-input");

    ["pa-name", "pa-phone", "pa-town", "pa-area"].forEach(id => {
      document.getElementById(id).addEventListener("input", updateProgress);
    });

    photoInput.addEventListener("change", () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        message("Please choose a JPG, PNG or WEBP image.", "error");
        photoInput.value = "";
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        message("Your picture must be smaller than 3 MB.", "error");
        photoInput.value = "";
        return;
      }
      previewPhoto(file);
    });

    document.getElementById("pa-remove-photo").addEventListener("click", () => {
      selectedPhoto = { remove: true };
      document.getElementById("pa-photo").innerHTML =
        `<span>${esc(initials(document.getElementById("pa-name").value))}</span>`;
      message("Photo removal will be applied when you save.", "info");
    });

    document.getElementById("pa-cancel").addEventListener("click", () => {
      selectedPhoto = null;
      render();
      message("Changes cancelled.");
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();

      const full_name = document.getElementById("pa-name").value.trim().replace(/\s+/g, " ");
      const phone = document.getElementById("pa-phone").value.trim();
      const town = document.getElementById("pa-town").value.trim();
      const area = document.getElementById("pa-area").value.trim();

      if (full_name.length < 2) return message("Please enter your full name.", "error");
      if (phone && !/^\+?[\d\s().-]{7,25}$/.test(phone))
        return message("Please enter a valid phone number.", "error");

      const button = document.getElementById("pa-save");
      button.disabled = true;
      button.textContent = "Saving…";
      message("Saving your profile…", "info");

      try {
        let avatar_url = values().avatar_url;

        if (selectedPhoto?.file) {
          const file = selectedPhoto.file;
          const ext = file.name.split(".").pop().toLowerCase();
          const path = `${user.id}/${Date.now()}.${ext}`;

          const upload = await client.storage.from(BUCKET).upload(path, file, {
            upsert: true,
            contentType: file.type,
            cacheControl: "3600"
          });
          if (upload.error) throw upload.error;

          const publicResult = client.storage.from(BUCKET).getPublicUrl(path);
          avatar_url = publicResult.data.publicUrl;
        } else if (selectedPhoto?.remove) {
          avatar_url = null;
        }

        const metadata = { full_name, name: full_name, phone, town, area, avatar_url };
        const authUpdate = await client.auth.updateUser({ data: metadata });
        if (authUpdate.error) throw authUpdate.error;
        user = authUpdate.data.user || user;

        const dbUpdate = await client.from("profiles").upsert({
          id: user.id,
          full_name,
          phone: phone || null,
          town: town || null,
          area: area || null,
          avatar_url
        }, { onConflict: "id" });

        if (dbUpdate.error) throw dbUpdate.error;

        profile = { ...profile, ...metadata };
        selectedPhoto = null;
        render();
        message("Your profile has been saved successfully.", "success");

        document.dispatchEvent(new CustomEvent("hysacam:profile-updated", {
          detail: { full_name, phone, town, area, avatar_url }
        }));
      } catch (error) {
        console.error("Profile update error:", error);
        message(error.message || "Could not save your profile. Please try again.", "error");
      } finally {
        const save = document.getElementById("pa-save");
        if (save) {
          save.disabled = false;
          save.textContent = "Save changes";
        }
      }
    });
  }

  async function init() {
    root.innerHTML = '<div class="pa-loading"><span></span><p>Loading your profile…</p></div>';
    client = await getClient();

    if (!client) {
      root.innerHTML = '<div class="pa-error">Unable to connect. Please refresh the page.</div>';
      return;
    }

    const session = await client.auth.getSession();
    if (session.error || !session.data.session) {
      root.innerHTML = `
        <div class="pa-guest">
          <h2>Sign in to manage your profile</h2>
          <p>Your profile information is available after you sign in.</p>
          <a href="signin.html">Sign in</a>
          <a href="signup.html">Create account</a>
        </div>`;
      return;
    }

    user = session.data.session.user;

    const result = await client.from("profiles")
      .select("*").eq("id", user.id).maybeSingle();

    if (result.error) {
      root.innerHTML = '<div class="pa-error">Could not load your profile. Please refresh and try again.</div>';
      console.error(result.error);
      return;
    }

    profile = result.data || {};
    render();
  }

  init();
})();
