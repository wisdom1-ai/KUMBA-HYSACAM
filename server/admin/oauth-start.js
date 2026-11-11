import { anonClient, guard, method, jsonBody, normalEmail, sendCode, encrypt } from '../auth/_lib/server.js';
import { isAdminEmail, recordAdminEvent } from './_lib/admin.js';
export default async function handler(req,res){
 if(!guard(req,res)||!method(req,res,'POST'))return;
 try{
  const {access_token,refresh_token}=jsonBody(req);
  if(typeof access_token!=='string'||typeof refresh_token!=='string')return res.status(400).json({message:'Google sign-in session is missing'});
  const client=anonClient();
  const {data,error}=await client.auth.setSession({access_token,refresh_token});
  if(error||!data.user||!data.session||!data.user.email_confirmed_at)return res.status(401).json({message:'Google account could not be verified'});
  const email=normalEmail(data.user.email);
  if(!isAdminEmail(email)){await recordAdminEvent(req,email,'admin_google_login','denied','Email not on administrator allowlist');return res.status(403).json({message:'This Google account is not authorised for administrator access'});}
  await sendCode(email,'admin_login',data.user.id,encrypt(data.session.refresh_token));
  await recordAdminEvent(req,email,'admin_google_login','google_accepted_otp_sent');
  return res.status(200).json({code_sent:true,email});
 }catch(error){console.error('[HYSACAM admin Google]',error?.message||error);return res.status(500).json({message:'Administrator Google sign-in could not be completed'});}
}
