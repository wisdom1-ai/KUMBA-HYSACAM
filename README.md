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
The supplied HYSACAM collection-team photograph is used in the home hero, About section, dustbin details and authentication brand panels. The existing HYSACAM symbol asset is preserved across the website.

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


## Forgot password and password visibility

The sign-in page links to `forgot-password.html`. The recovery flow sends a six-digit, 10-minute one-time code to an existing account email, verifies the code on the server, updates the Supabase Auth password, revokes existing application sessions, and returns the user to sign-in. Unknown email addresses receive the same generic success response to reduce account enumeration. Reset requests and code attempts are rate-limited.

The Supabase SQL setup now permits `password_reset` challenges and adds the signup-password column if it is missing. If the database setup was already run, run the updated `supabase/auth-setup.sql` again in Supabase SQL Editor; it uses safe `IF NOT EXISTS` / constraint replacement statements and does not delete user records. Keep the existing Vercel email, Supabase, and session-encryption environment variables configured. Test email delivery on the deployed HTTPS site.

Password fields on the sign-in, sign-up, and reset pages use accessible eye controls to show or hide the entered password.


Final visual refresh: resident sign-in, registration and administrator sign-in use a consistent split-screen HYSACAM design. The signup form uses First Name, Last Name, Email and Password while preserving the backend `name` field by combining first and last name. The Google setup guide is in `GOOGLE-SIGNIN-SETUP.txt`.


## Live platform sections and administrator workspace

The public `index.html` now loads `js/platform.js` for live Dustbin Directory, Dustbin Details, and verified Cleaning Records. The Leaflet map in `js/map.js` uses the same `bins` data and selecting a marker opens the matching details section.

The separate `admin.html` portal now includes:
- Dashboard statistics and recent cleaning activity chart
- Dustbin registration, editing, searching, and deletion
- Verified cleaning-record creation and review
- Registered account list (read-only; administrator privileges remain controlled by `ADMIN_EMAILS`)
- Resident report status updates
- Administrator audit-event review and security guidance

All administrator reads and mutations go through `/api/admin/manage`, `/api/admin/reports`, and `/api/admin/audit`. These endpoints validate the HttpOnly HYSACAM session and the server-side `ADMIN_EMAILS` allowlist. The Supabase service-role key is used only in Vercel server functions and is never sent to the browser.

### Existing database fields required

The existing `public.bins` table must provide `id`, `name`, `area`, `latitude`, `longitude`, and `status`. The existing `public.cleaning_records` table must provide `id`, `bin_id`, `area`, `cleaned_at`, `activity`, `status`, `notes`, and `verified`. These fields are already used by the existing map and Supabase client code. Keep RLS enabled; browser access should remain read-only according to your current public policies. All writes from the administrator workspace are performed server-side.

The user list is read-only and loads up to the first 1,000 Supabase Auth users. Role changes are intentionally not exposed in the browser; configure administrator emails in Vercel `ADMIN_EMAILS` instead.

### Deployment verification

After deploying to Vercel, sign in using an authorised administrator account and test: create/edit/delete a dustbin, open a map marker, check the public directory and details, add a cleaning record, update a resident report status, and confirm a non-administrator receives HTTP 403 from `/api/admin/manage`. A successful local syntax check does not replace testing against your actual Supabase project and deployed Vercel environment.


## Dustbin registration database compatibility fix

The deployed Supabase database uses UUID values for `public.bins.id` and
`public.cleaning_records.bin_id`. The admin form's human-readable values
(e.g. `BIN-008`) must therefore be stored separately in `public.bins.bin_code`.

Before deploying this updated package, run `supabase/uuid-bin-code-migration.sql`
in the Supabase SQL Editor. This adds `bin_code`, backfills existing rows with
stable display codes derived from their UUIDs, and preserves all UUID keys and
cleaning-record relationships. Do not change `bins.id` or
`cleaning_records.bin_id` to text.

The updated admin API creates bins with the database-generated UUID and saves
the entered human-readable value in `bin_code`. The public directory, map,
details, cleaning records, and admin tables display `bin_code` while continuing
to use UUIDs internally for lookups and relationships.

After running the migration, deploy the contents of the `CCAS` folder as the
Vercel project root. Test creation with a new code such as `BIN-008`, then
confirm it appears in the admin list, public directory, and map.
