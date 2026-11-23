(function () {
  var KEY = "hysacam-dark";
  var root = document.documentElement;
  var saved = "0";
  try { saved = localStorage.getItem(KEY) || "0"; } catch (e) {}
  if (saved === "1") root.classList.add("dark");

  document.addEventListener("DOMContentLoaded", function () {
    var box = document.getElementById("pref-dark");
    if (!box) return;
    box.checked = root.classList.contains("dark");
    box.addEventListener("change", function () {
      root.classList.toggle("dark", box.checked);
      try { localStorage.setItem(KEY, box.checked ? "1" : "0"); } catch (e) {}
    });
  });
})();