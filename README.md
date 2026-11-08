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


## User accounts: sign-up, sign-in, email verification and sign-out

The frontend now includes `signup.html`, `signin.html`, and `verify-email.html`. The public dashboard (`index.html`) checks the signed-in session using `GET /api/auth/me`; unauthenticated visitors are redirected to `signin.html`. A Sign out button is added after a valid session is confirmed.

### Required backend API contract

All routes are same-origin `/api/auth/...` endpoints and must use HTTPS in production. Requests include cookies (`credentials: include`).

- `POST /api/auth/signup` JSON `{ "name": "...", "email": "...", "password": "..." }`. Validate input, hash the password, create a pending/unverified account, send a 6-digit email code, and return success only if the code was queued.
- `POST /api/auth/login` JSON `{ "email": "...", "password": "..." }`. Check credentials server-side, then send a 6-digit code. Do not create an authenticated session yet.
- `POST /api/auth/verify` JSON `{ "email": "...", "code": "123456", "purpose": "signup" | "login" }`. Verify the code server-side, expire it after a short period, limit attempts, prevent reuse, mark signup email verified, and only then issue a secure session cookie. Return success after the session is established.
- `POST /api/auth/resend-code` JSON `{ "email": "...", "purpose": "signup" | "login" }`. Apply resend cooldowns and rate limits.
- `GET /api/auth/me`. Return `{ "authenticated": true, "user": { "name": "...", "email": "..." } }` only for a valid session; otherwise return 401.
- `POST /api/auth/logout`. Revoke/invalidate the session and clear the cookie.

Use secure HttpOnly, Secure, SameSite cookies; CSRF protection where applicable; rate limits; generic login errors to reduce account enumeration; password hashing (Argon2id or bcrypt); and server-side authorization on every protected API. Never store passwords or OTPs in localStorage/sessionStorage. The browser sessionStorage is used only to hold the pending email and flow label while the user enters the code; it does not hold the code or password.

### Integration status

These are frontend screens and API calls only. Email delivery, OTP generation/verification, account creation, password hashing, session issuance, and server-side dashboard/API protection must be implemented by the backend developer. Until those endpoints exist, account flows will not complete. Do not treat the frontend redirect as a security boundary.
