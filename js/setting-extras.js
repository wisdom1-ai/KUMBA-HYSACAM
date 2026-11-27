(function () {
  "use strict";

  /* Old links to the profile section now go to the Profile page */
  var hash = (location.hash || "").toLowerCase();
  if (hash === "#profile" || hash === "#profile-section") {
    location.replace("profile.html");
    return;
  }

  var page = document.querySelector(".page-wrap");
  if (!page) return;

  /* ---------- Entrance stagger ---------- */
  var items = page.querySelectorAll(".set-top, .profile-row, .guest-strip, .set-quick, .set-group, .set-row, .signout-btn, .brand-card");
  items.forEach(function (el, i) {
    el.style.setProperty("--d", Math.min(i * 0.04, 0.6) + "s");
  });

  /* ---------- Search ---------- */
  var input = document.getElementById("set-search");
  var empty = document.getElementById("sx-empty");
  var openedBySearch = new Set();

  function visible(el) {
    return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
  }

  function runSearch() {
    var q = (input.value || "").trim().toLowerCase();
    var kids = Array.prototype.slice.call(page.children);
    var rows = kids.filter(function (el) { return el.classList.contains("set-row") && el.id !== "set-hero"; });

    kids.forEach(function (el) { el.classList.remove("sx-hide"); });

    if (!q) {
      openedBySearch.forEach(function (d) { d.open = false; });
      openedBySearch.clear();
      if (empty) empty.hidden = true;
      return;
    }

    var anyShown = false;
    rows.forEach(function (row) {
      var match = row.textContent.toLowerCase().indexOf(q) !== -1;
      if (!match) { row.classList.add("sx-hide"); return; }
      if (visible(row)) anyShown = true;
      if (row.tagName === "DETAILS" && !row.open) { row.open = true; openedBySearch.add(row); }
    });

    /* hide group headings with nothing under them */
    var group = null;
    var groupHasRow = false;
    function closeGroup() { if (group && !groupHasRow) group.classList.add("sx-hide"); }
    kids.forEach(function (el) {
      if (el.classList.contains("set-group")) {
        closeGroup();
        group = el;
        groupHasRow = false;
      } else if (el.classList.contains("set-row") && el.id !== "set-hero" && !el.classList.contains("sx-hide") && visible(el)) {
        groupHasRow = true;
      }
    });
    closeGroup();

    /* hide the non-searchable blocks while searching */
    kids.forEach(function (el) {
      if (el.classList.contains("profile-row") || el.classList.contains("set-quick") ||
          el.classList.contains("guest-strip") || el.classList.contains("signout-btn") ||
          el.classList.contains("brand-card") || el.classList.contains("settings-note")) {
        el.classList.add("sx-hide");
      }
    });

    if (empty) empty.hidden = anyShown;
  }

  if (input) input.addEventListener("input", runSearch);

  /* ---------- Thin scroll line at the top ---------- */
  var line = document.createElement("div");
  line.className = "scroll-progress";
  line.setAttribute("aria-hidden", "true");
  document.body.appendChild(line);
  function updateLine() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    line.style.width = (max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0) + "%";
  }
  window.addEventListener("scroll", updateLine, { passive: true });
  window.addEventListener("resize", updateLine);
  updateLine();
})();