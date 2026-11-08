import {
  adminClient, anonClient, guard, method, jsonBody, normalEmail,
  verifyCode, decrypt, encrypt, createSession, createSessionFromChallenge, setSessionCookie, fail
} from './_lib/server.js';

export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;

  try {
    const body = jsonBody(req);
    const email = normalEmail(body.email);
    const code = String(body.code || '').trim();
    const purpose = body.purpose;

    if (!/^\S+@\S+\.\S+$/.test(email) ||
        !/^\d{6}$/.test(code) ||
        !['signup', 'login'].includes(purpose)) {
      return res.status(400).json({ message: 'Enter a valid email address and 6-digit code.' });
    }

    const row = await verifyCode(email, purpose, code, purpose !== 'signup');

    if (purpose === 'signup') {
      if (!row.encrypted_signup_password) {
        return res.status(400).json({
          message: 'Your registration session has expired. Please sign in to continue.'
        });
      }

      const db = adminClient();
      const { error: confirmError } = await db.auth.admin.updateUserById(
        row.user_id,
        { email_confirm: true }
      );
      if (confirmError) {
        return res.status(500).json({ message: 'Email verification could not be completed. Please try again.' });
      }

      const client = anonClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: decrypt(row.encrypted_signup_password)
      });

      if (error || !data.session || !data.user) {
        return res.status(400).json({
          message: 'Your email is verified, but we could not open your session. Please sign in.'
        });
      }

      const sessionToken = await createSession(
        row.user_id,
        encrypt(data.session.refresh_token)
      );
      await db.from('hysacam_auth_challenges').delete().eq('id', row.id);
      setSessionCookie(req, res, sessionToken);
      return res.status(200).json({ verified: true, purpose: 'signup', authenticated: true });
    }

    await createSessionFromChallenge(row, req, res);
    return res.status(200).json({ verified: true, purpose: 'login', authenticated: true });
  } catch (e) {
    return fail(res, e, 400);
  }
}
