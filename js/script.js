const menuToggle = document.getElementById("menu-toggle");
const mainNav = document.getElementById("main-nav");
const locationSearch = document.getElementById("location-search");
const locationInput = document.getElementById("location-input");
const searchMessage = document.getElementById("search-message");

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");

    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation"
    );
    menuToggle.textContent = isOpen ? "✕" : "☰";
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation");
      menuToggle.textContent = "☰";
    });
  });
}

if (locationSearch && locationInput && searchMessage) {
  locationSearch.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = locationInput.value.trim();

    if (!query) {
      searchMessage.textContent = "Enter a location to continue";
      locationInput.focus();
      return;
    }

    const directory = document.getElementById("directory");

    Location entered: ${query} — directory search will be connected next

    if (directory) {
      directory.scrollIntoView({ behavior: "smooth" });
    }
  });
}
async function loadCleaningRecords() {
  const { data, error } = await supabaseClient
    .from("cleaning_records")
    .select("id, bin_id, area, cleaned_at, activity, status, notes")
    .eq("verified", true)
    .order("cleaned_at", { ascending: false });

  if (error) {
    console.error("Could not load cleaning records:", error.message);
    return [];
  }

  return data || [];
}const staffLoginForm = document.getElementById("staff-login-form"); const staffLoginMessage = document.getElementById("staff-login-message"); const staffAccountDetails = document.getElementById("staff-account-details");
async function checkStaffAccess(user) { const { data, error } = await supabaseClient .from("approved_staff") .select("active") .eq("user_id", user.id) .maybeSingle();
if (error) { console.error("Staff approval check failed:", error.message); staffLoginMessage.textContent = "Could not verify staff approval. Please try again."; return false; }
if (!data || data.active !== true) { staffLoginMessage.textContent = "Your account is not approved for staff access."; await supabaseClient.auth.signOut(); return false; }
staffLoginMessage.textContent = "Staff access verified."; staffAccountDetails.textContent = Signed in as ${user.email || "staff"}.; return true; }
if (staffLoginForm && staffLoginMessage && staffAccountDetails) { staffLoginForm.addEventListener("submit", async (event) => { event.preventDefault();
const email = document.getElementById("staff-email").value.trim();
const password = document.getElementById("staff-password").value;
const button = document.getElementById("staff-login-button");

button.disabled = true;
staffLoginMessage.textContent = "Signing in...";
staffAccountDetails.textContent = "";

try {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    staffLoginMessage.textContent =
      "Sign-in failed. Check your email and password.";
    return;
  }

  await checkStaffAccess(data.user);
} catch (error) {
  console.error("Staff login error:", error);
  staffLoginMessage.textContent =
    "Something went wrong. Please try again.";
} finally {
  button.disabled = false;
}
}); }
const passwordInput = document.getElementById("staff-password"); const togglePassword = document.getElementById("toggle-password");
if (passwordInput && togglePassword) { togglePassword.addEventListener("click", () => { const showing = passwordInput.type === "password";
passwordInput.type = showing ? "text" : "password";
togglePassword.textContent = showing ? "🙈" : "👁";
togglePassword.setAttribute(
  "aria-label",
  showing ? "Hide password" : "Show password"
);
togglePassword.setAttribute("aria-pressed", String(showing));
}); }
const passwordInput = document.getElementById("staff-password");
const passwordToggle = document.getElementById("toggle-password");

if (passwordInput && passwordToggle) {
  passwordToggle.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";

    passwordInput.type = showPassword ? "text" : "password";
    passwordToggle.setAttribute(
      "aria-label",
      showPassword ? "Hide password" : "Show password"
    );
    passwordToggle.setAttribute(
      "aria-pressed",
      String(showPassword)
    );
  

    passwordToggle.innerHTML = showPassword
      ? `<svg class="eye-icon" xmlns="http://www.w3.org/2000/svg"
          width="21" height="21" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true">
          <path d="M3 3l18 18"/>
          <path d="M10.6 10.6a2 2 0 002.8 2.8"/>
          <path d="M9.9 5.2A10.8 10.8 0 0112 5
            c6.4 0 10 7 10 7a16 16 0 01-3.1 3.8"/>
          <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7
            a10.5 10.5 0 004.1-.8"/>
        </svg>`
      : `<svg class="eye-icon" xmlns="http://www.w3.org/2000/svg"
          width="21" height="21" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>`;
  });
}
const passwordInput = document.getElementById("staff-password");
const passwordToggle = document.getElementById("toggle-password");

if (passwordInput && passwordToggle) {
  passwordToggle.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";

    passwordToggle.setAttribute(
      "aria-label",
      isHidden ? "Hide password" : "Show password"
    );

    passwordToggle.setAttribute(
      "aria-pressed",
      String(isHidden)
    );

    passwordToggle.innerHTML = isHidden
      ? `<svg xmlns="http://www.w3.org/2000/svg"
          width="21" height="21" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true">
          <path d="M3 3l18 18"/>
          <path d="M10.6 10.6a2 2 0 002.8 2.8"/>
          <path d="M9.9 5.2A10.8 10.8 0 0112 5
            c6.4 0 10 7 10 7a16 16 0 01-3.1 3.8"/>
          <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7
            a10.5 10.5 0 004.1-.8"/>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg"
          width="21" height="21" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>`;

    passwordInput.focus();
  });
}
document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("staff-password");
  const eyeButton = document.getElementById("toggle-password");

  if (!passwordInput || !eyeButton) {
    console.error("Password input or eye button was not found.");
    return;
  }

  eyeButton.onclick = function (event) {
    event.preventDefault();

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      eyeButton.setAttribute("aria-label", "Hide password");
      eyeButton.setAttribute("aria-pressed", "true");
    } else {
      passwordInput.type = "password";
      eyeButton.setAttribute("aria-label", "Show password");
      eyeButton.setAttribute("aria-pressed", "false");
    }
  };
});