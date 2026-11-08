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


## Supabase password + email-code authentication (Vercel backend)

This package now includes Vercel serverless API routes under `api/auth/`. The password is checked by Supabase Auth on the server. A separate 6-digit code is generated and verified server-side. The browser receives an HttpOnly session cookie only after the login code is verified. Sign-up email verification confirms the Supabase user; the new user then signs in with password + code.

### Before deployment
1. In Supabase SQL Editor, run `supabase/auth-setup.sql`. It creates server-only challenge/session/rate-limit tables. Do not add public policies to these tables.
2. In Vercel, add every variable from `.env.example` under Project Settings → Environment Variables. Use your project's URL and publishable key for the first two values. Use the Supabase service-role/secret key only as a Vercel server environment variable. Never paste it into browser code or chat.
3. Create an email-sending provider account (the code uses Resend's HTTP API), verify a sender address/domain with that provider, then set `RESEND_API_KEY` and `EMAIL_FROM`. A `vercel.app` address is a hosting address, not an email sender domain.
4. Generate a random 32-byte encryption key and encode it as 64 hexadecimal characters for `SESSION_ENCRYPTION_KEY`. Keep it private.
5. Set `APP_ORIGIN` to `https://kumba-hysacam.vercel.app`.
6. Ensure the Vercel project root directory is this `CCAS` folder, then deploy.

### Important security and deployment notes
- This implementation uses server-only Supabase service credentials, HMAC-hashed one-time codes, 10-minute code expiry, five verification attempts, resend cooldowns, rate limits, encrypted refresh tokens, and an HttpOnly SameSite cookie.
- The Vercel rewrite serves the dashboard HTML through `api/dashboard.js`, which validates the HttpOnly session before returning it. Sensitive records and actions must still be served only through server endpoints that verify the session. Do not rely on hidden frontend controls as authorization.
- Keep the admin portal separate. These endpoints authenticate public users only; they do not implement administrator authorization.
- Email delivery will not work until the provider and sender are configured. Do not claim the flow is live until it has been tested on the deployed HTTPS site.
- The backend endpoints require Node.js 20+ and the Vercel Functions runtime. Local Live Server alone cannot run the API routes.
