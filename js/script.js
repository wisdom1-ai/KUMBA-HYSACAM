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

    searchMessage.textContent =
      `Location entered: ${query} — directory search will be connected next`;

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
}