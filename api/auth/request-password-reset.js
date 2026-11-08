import { adminClient, guard, method, jsonBody, normalEmail, consumeLimit, sendCode, fail } from './_lib/server.js';

export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;
  try {
    const email = normalEmail(jsonBody(req).email);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (!await consumeLimit(`password-reset:${email}`, 5, 3600)) {
      return res.status(429).json({ message: 'Too many reset requests. Please try again later.' });
    }

    // Always return the same response for existing and unknown accounts.
    const generic = { code_sent: true };
    const db = adminClient();
    let matchedUser = null;
    // Supabase Admin exposes paginated user listing rather than getUserByEmail.
    // Walk pages until the address is found or the final page is reached.
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error('We could not process the password reset request.');
      const users = data?.users || [];
      matchedUser = users.find(user => String(user.email || '').toLowerCase() === email) || null;
      if (matchedUser || users.length < 1000) break;
    }
    if (!matchedUser) return res.status(200).json(generic);

    const { data: previous } = await db.from('hysacam_auth_challenges')
      .select('sent_at').eq('email', email).eq('purpose', 'password_reset').maybeSingle();
    if (previous && Date.now() - new Date(previous.sent_at).getTime() < 60_000) {
      return res.status(429).json({ message: 'Please wait 60 seconds before requesting another code.' });
    }

    await sendCode(email, 'password_reset', matchedUser.id);
    return res.status(200).json(generic);
  } catch (e) { return fail(res, e, 500); }
}
