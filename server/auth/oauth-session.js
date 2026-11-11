import { anonClient, adminClient, guard, method, jsonBody, encrypt, createSession, setSessionCookie } from './_lib/server.js';
export default async function handler(req,res){
 if(!guard(req,res)||!method(req,res,'POST'))return;
 try{
  const {access_token,refresh_token}=jsonBody(req);
  if(typeof access_token!=='string'||typeof refresh_token!=='string')return res.status(400).json({message:'Google sign-in session is missing'});
  const client=anonClient();
  const {data,error}=await client.auth.setSession({access_token,refresh_token});
  if(error||!data.user||!data.session)return res.status(401).json({message:'Google account could not be verified'});
  if(!data.user.email_confirmed_at)return res.status(403).json({message:'Please verify your Google email address before continuing'});
  const token=await createSession(data.user.id,encrypt(data.session.refresh_token));
  setSessionCookie(req,res,token);
  return res.status(200).json({authenticated:true});
 }catch(error){console.error('[HYSACAM Google OAuth]',error?.message||error);return res.status(500).json({message:'Google sign-in could not be completed. Please try again.'});}
}
