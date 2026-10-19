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