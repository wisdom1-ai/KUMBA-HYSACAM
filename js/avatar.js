(function () {
  var KEY = "hysacam-avatar";
  var box = document.getElementById("settings-avatar");
  var input = document.getElementById("avatar-input");
  if (!box || !input) return;

  function show(src) {
    box.innerHTML = "";
    var img = document.createElement("img");
    img.src = src;
    img.alt = "Profile picture";
    box.appendChild(img);
  }

  try {
    var saved = localStorage.getItem(KEY);
    if (saved) show(saved);
  } catch (e) {}

  input.addEventListener("change", function () {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var size = 256;
        var canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        var min = Math.min(img.width, img.height);
        var sx = (img.width - min) / 2;
        var sy = (img.height - min) / 2;
        canvas.getContext("2d").drawImage(img, sx, sy, min, min, 0, 0, size, size);
        var data = canvas.toDataURL("image/jpeg", 0.8);
        show(data);
        try { localStorage.setItem(KEY, data); } catch (e) {}
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
})();