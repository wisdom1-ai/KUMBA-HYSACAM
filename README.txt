ADMIN PAGE ONLY (nothing on the main pages is touched)

Copy into your repo, same folders:
  css/admin-app.css   (new)
  js/admin-views.js   (new)
  admin.html          (the repo copy + these 2 lines only)

If admin.html was edited by a friend since, DO NOT replace it. Just add these 2 lines instead:
  in <head>, after the css/style.css line:
      <link rel="stylesheet" href="css/admin-app.css?v=2">
  at the bottom, after the js/admin-dashboard.js line:
      <script src="js/admin-views.js?v=2"></script>

All the new header, tab bar, quick actions and badges are created by admin-views.js, so no other markup is needed.
admin-dashboard.js is not changed.
