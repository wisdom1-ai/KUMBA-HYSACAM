# HYSACAM Kumba Tracker — Frontend

This package contains the public-facing frontend and a separate private administrator portal shell. The backend is being developed separately.

## Run locally
1. Extract this folder.
2. Open the `CCAS` folder in VS Code.
3. Use Live Server to open `index.html`.

## Administrator access and security
- The public website has no administrator login button and does not render the admin dashboard.
- The administrator page is separate at `admin.html` and is not linked from public navigation.
- `admin.html` fails closed until the backend implements `POST /api/admin/login`, validates credentials server-side, and returns `{ authenticated: true, role: "administrator" }` only for an approved administrator.
- The backend must enforce role checks on every admin API route, use secure HttpOnly/SameSite cookies, rate-limit login attempts, protect against CSRF where applicable, hash passwords with a modern password-hashing algorithm, and never trust frontend-only checks.
- Implement `POST /api/admin/logout` server-side. Do not store admin passwords or secret keys in frontend JavaScript.
- No default credentials are included. The administrator must create/approve accounts through the backend, not public sign-up.

## Important
This is frontend work only. The login page is a user interface and is not secure authentication until the backend endpoints and server-side authorisation are implemented. Do not deploy the admin portal as secure until that work is complete.

## Images and branding
The supplied `images/hysacam-truck.jpg` is used in the home hero and About section. The current package did not contain an official HYSACAM logo file, so a simple text monogram is used temporarily; replace it with the official approved logo asset when supplied.

The map uses OpenStreetMap tiles and needs an internet connection. Sample bin records are frontend demonstration data.


Branding update: the public header, About section and administrator portal use the small HYSACAM symbol extracted from the supplied reference design. The text K placeholder and full text wordmark have been removed.
