import { adminClient, guard, method, jsonBody, normalEmail, consumeLimit, sendCode, fail } from './_lib/server.js';
export default async function handler(req, res) {
  if (!guard(req,res) || !method(req,res,'POST')) return;
  try {
    const email = normalEmail(jsonBody(req).email); const purpose = jsonBody(req).purpose;
    if (!/^\S+@\S+\.\S+$/.test(email) || !['signup','login'].includes(purpose)) return res.status(400).json({ message: 'Invalid request.' });
    if (!await consumeLimit(`resend:${email}`, 10, 3600)) return res.status(429).json({ message: 'Please wait before requesting another code.' });
    const db = adminClient(); const { data: old } = await db.from('hysacam_auth_challenges').select('user_id,encrypted_refresh_token,sent_at').eq('email',email).eq('purpose',purpose).maybeSingle();
    if (!old) return res.status(400).json({ message: 'Please start the sign-in or sign-up process again.' });
    if (Date.now() - new Date(old.sent_at).getTime() < 60_000) return res.status(429).json({ message: 'Please wait 60 seconds before requesting another code.' });
    await sendCode(email,purpose,old.user_id,old.encrypted_refresh_token);
    return res.status(200).json({ code_sent: true });
  } catch (e) { return fail(res,e,500); }
}
