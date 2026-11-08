import { adminClient, guard, method, jsonBody, normalEmail, consumeLimit, sendCode, fail } from './_lib/server.js';

async function findUserByEmail(db, email) {
  // Supabase Auth admin listing is paginated. The project is expected to have
  // a small user base at this stage, so inspect the first page of up to 1,000.
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error('We could not check this account. Please try again.');
  return (data?.users || []).find(user => normalEmail(user.email) === email) || null;
}

export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;

  try {
    const body = jsonBody(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = normalEmail(body.email);
    const password = body.password;

    if (!name || name.length > 80 ||
        !/^\\S+@\\S+\\.\\S+$/.test(email) ||
        typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        message: 'Enter a valid name, email and password of at least 8 characters.'
      });
    }

    if (!await consumeLimit(`signup:${email}`, 3, 3600)) {
      return res.status(429).json({
        message: 'Too many attempts. Please try again later.'
      });
    }

    const db = adminClient();
    let existing = await findUserByEmail(db, email);

    // If a previous registration created the Auth user but email delivery
    // failed, allow the person to retry sending the verification code.
    // Do not create duplicate unverified accounts.
    if (existing) {
      if (existing.email_confirmed_at || existing.confirmed_at) {
        return res.status(409).json({
          message: 'An account with this email already exists. Please sign in.'
        });
      }

      await sendCode(email, 'signup', existing.id);
      return res.status(200).json({ code_sent: true });
    }

    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: name }
    });

    if (error || !data.user) {
      // Handle two sign-up requests arriving at nearly the same time.
      existing = await findUserByEmail(db, email);
      if (existing && !existing.email_confirmed_at && !existing.confirmed_at) {
        await sendCode(email, 'signup', existing.id);
        return res.status(200).json({ code_sent: true });
      }

      return res.status(400).json({
        message: 'We could not create that account. Check the details or try signing in.'
      });
    }

    await sendCode(email, 'signup', data.user.id);
    return res.status(200).json({ code_sent: true });
  } catch (e) {
    return fail(res, e, 500);
  }
}
