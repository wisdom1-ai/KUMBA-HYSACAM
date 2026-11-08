import { adminClient, guard, method, jsonBody, normalEmail, verifyCode, createSessionFromChallenge, fail } from './_lib/server.js';
export default async function handler(req, res) {
  if (!guard(req,res) || !method(req,res,'POST')) return;
  try {
    const email = normalEmail(jsonBody(req).email); const code = String(jsonBody(req).code || '').trim(); const purpose = jsonBody(req).purpose;
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code) || !['signup','login'].includes(purpose)) return res.status(400).json({ message: 'Enter a valid email and 6-digit code.' });
    const row = await verifyCode(email,purpose,code);
    if (purpose === 'signup') {
      const db = adminClient(); const { error } = await db.auth.admin.updateUserById(row.user_id, { email_confirm: true });
      if (error) return res.status(500).json({ message: 'Email verification could not be completed. Please try again.' });
      return res.status(200).json({ verified: true, purpose: 'signup' });
    }
    await createSessionFromChallenge(row,req,res);
    return res.status(200).json({ verified: true, purpose: 'login' });
  } catch (e) { return fail(res,e,400); }
}
