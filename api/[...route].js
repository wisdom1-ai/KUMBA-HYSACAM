import auth_request_password_reset from '../server/auth/request-password-reset.js';
import auth_verify from '../server/auth/verify.js';
import auth_logout from '../server/auth/logout.js';
import auth_signup from '../server/auth/signup.js';
import auth_verify_reset_code from '../server/auth/verify-reset-code.js';
import auth_login from '../server/auth/login.js';
import auth_reset_password from '../server/auth/reset-password.js';
import auth_me from '../server/auth/me.js';
import auth_resend_code from '../server/auth/resend-code.js';
import admin_verify from '../server/admin/verify.js';
import admin_logout from '../server/admin/logout.js';
import admin_audit from '../server/admin/audit.js';
import admin_login from '../server/admin/login.js';
import admin_me from '../server/admin/me.js';

const routes = new Map([
  ['/api/auth/request-password-reset', auth_request_password_reset],
  ['/api/auth/verify', auth_verify],
  ['/api/auth/logout', auth_logout],
  ['/api/auth/signup', auth_signup],
  ['/api/auth/verify-reset-code', auth_verify_reset_code],
  ['/api/auth/login', auth_login],
  ['/api/auth/reset-password', auth_reset_password],
  ['/api/auth/me', auth_me],
  ['/api/auth/resend-code', auth_resend_code],
  ['/api/admin/verify', admin_verify],
  ['/api/admin/logout', admin_logout],
  ['/api/admin/audit', admin_audit],
  ['/api/admin/login', admin_login],
  ['/api/admin/me', admin_me],
]);

export default async function handler(req, res) {
  // vercel.json forwards /api/* requests here and preserves the original
  // endpoint in the `path` query parameter.
  const forwardedPath = req.query?.path;
  const pathValue = Array.isArray(forwardedPath) ? forwardedPath.join('/') : forwardedPath;
  const pathname = pathValue
    ? `/api/${String(pathValue).replace(/^\/+/, '').replace(/\/+$/, '')}`
    : new URL(req.url || '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/';

  const route = routes.get(pathname);
  if (!route) return res.status(404).json({ message: 'API route not found.' });
  return route(req, res);
}
