import {
  adminClient,
  guard,
  method,
  jsonBody,
  normalEmail,
  consumeLimit,
  sendCode,
  fail
} from './_lib/server.js';

export default async function handler(req, res) {
  if (!guard(req, res) || !method(req, res, 'POST')) return;

  try {
    const email = normalEmail(jsonBody(req).email);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        message: 'Enter a valid email address.'
      });
    }

    const allowed = await consumeLimit(
      `password-reset:${email}`,
      8,
      3600
    );

    if (!allowed) {
      return res.status(429).json({
        message: "You've requested several reset codes recently. Please wait a little before trying again."
      });
    }

    const db = adminClient();
    let matchedUser = null;

    for (let page = 1; page <= 100; page++) {
      const { data, error } = await db.auth.admin.listUsers({
        page,
        perPage: 1000
      });

      if (error) {
        throw new Error(
          'We could not process the password reset request.'
        );
      }

      const users = data?.users || [];

      matchedUser = users.find(
        user =>
          String(user.email || '').toLowerCase() === email
      ) || null;

      if (matchedUser || users.length < 1000) {
        break;
      }
    }

    if (!matchedUser) {
      return res.status(200).json({
        code_sent: true
      });
    }

    const { data: previous, error: previousError } = await db
      .from('hysacam_auth_challenges')
      .select('sent_at')
      .eq('email', email)
      .eq('purpose', 'password_reset')
      .maybeSingle();

    if (previousError) {
      throw new Error(
        'We could not check the password reset request.'
      );
    }

    if (
      previous &&
      Date.now() - new Date(previous.sent_at).getTime() < 60000
    ) {
      return res.status(429).json({
        message: 'Please wait 60 seconds before requesting another code.'
      });
    }

    await sendCode(
      email,
      'password_reset',
      matchedUser.id
    );

    return res.status(200).json({
      code_sent: true
    });

  } catch (error) {
    return fail(res, error, 500);
  }
}