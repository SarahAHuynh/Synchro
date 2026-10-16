import { canWriteEvents } from '@/lib/calendar-scopes';
import { authConfigured, appOrigin, calendarConfigured } from '@/lib/server/config';
import { adminClient, sessionClient } from '@/lib/server/supabase';
import { ApiError, authenticated, failure, json, readBody, sameOrigin } from '@/lib/server/http';
import { validPreferences } from '@/lib/live-validation';
import { isEmail } from '@/lib/validation';
function emailError(error:{code?:string;status?:number}) {
  if(error.code==='email_address_not_authorized')return new ApiError('Email delivery is restricted. Configure custom SMTP in Supabase, or test with a project-team email address.',503);
  if(error.status===429||error.code==='over_email_send_rate_limit')return new ApiError('Too many email requests. Wait a few minutes before resending.',429);
  return new ApiError('The verification email could not be sent. Check Supabase Auth logs and email/SMTP settings.',503);
}
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!authConfigured()) return json({ configured: false, calendarConfigured: false, user: null });
  try {
    const { client, user } = await authenticated();
    const { data: profile, error } = await client.from('profiles').select('name, preferences').eq('id', user.id).maybeSingle();
    if (error) throw new ApiError('Your profile could not be loaded. Please try again.', 503);
    let connected = false; let calendarEventsEnabled=false;
    if (calendarConfigured()) {
      const { data, error: connectionError } = await adminClient().from('calendar_connections').select('user_id, scope').eq('user_id', user.id).maybeSingle();
      if (connectionError) throw new ApiError('Your calendar status could not be loaded. Please try again.', 503);
      connected = Boolean(data); calendarEventsEnabled=canWriteEvents(data?.scope);
    }
    const candidateName = profile?.name ?? user.user_metadata.full_name ?? user.user_metadata.name;
    const name = typeof candidateName === 'string' && candidateName.trim() ? candidateName.slice(0, 100) : user.email?.split('@')[0] ?? 'Friend';
    return json({ configured: true, calendarConfigured: calendarConfigured(), user: { id: user.id, email: user.email, name, preferences: validPreferences(profile?.preferences) ? profile.preferences : null, calendarConnected: connected, calendarEventsEnabled } });
  } catch (error) { if (error instanceof ApiError && error.status === 401) return json({ configured: true, calendarConfigured: calendarConfigured(), user: null }); return failure(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!authConfigured()) throw new ApiError('Accounts aren’t available until the account service is configured.', 503);
    const body = await readBody(request);
    const client = await sessionClient();
    if (body.action === 'signout') { const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw new ApiError('We couldn’t sign you out. Try again.', 503); return json({ ok: true }); }
    if (body.action === 'google') {
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${appOrigin()}/api/auth/callback` } });
      if (error || !data.url) throw new ApiError('Google sign-in is unavailable. Try email sign-in instead.', 503);
      return json({ url: data.url });
    }
    if (body.action === 'password') {
      await authenticated();
      if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new ApiError('Use a password with 12–128 characters.', 400);
      const { error } = await client.auth.updateUser({ password: body.password });
      if (error) throw new ApiError('Your password could not be updated. Request a new recovery link and try again.', 400);
      return json({ message: 'Your password is updated.' });
    }
    if (typeof body.email !== 'string' || !isEmail(body.email) || body.email.length > 254) throw new ApiError('Enter a valid email address.', 400);
    const email = body.email.trim().toLowerCase();
    if(body.action==='resend') {
      const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:`${appOrigin()}/api/auth/callback`}});
      if(error)throw emailError(error);
      return json({message:'If this account needs verification, a new link has been requested. Check spam too, and open the link in this browser.'});
    }
    if (body.action === 'reset') {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/api/auth/callback?recovery=1` });
      if (error) throw new ApiError('We couldn’t send a recovery link just now. Please try again later.', 429);
      return json({ message: 'If an account uses that email, a password reset link is on its way. Open it in this browser.' });
    }
    if (typeof body.password !== 'string' || !body.password || body.password.length > 128) throw new ApiError('Enter your password.', 400);
    if (body.action === 'signup') {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) throw new ApiError('Enter your name (up to 100 characters).', 400);
      if (body.password.length < 12) throw new ApiError('Use at least 12 characters for your password.', 400);
      const { data, error } = await client.auth.signUp({ email, password: body.password, options: { data: { name: body.name.trim() }, emailRedirectTo: `${appOrigin()}/api/auth/callback` } });
      if (error) {
        // Log only provider codes/statuses, never credentials or provider payloads.
        const code=error.code&&/^[a-z_]{1,80}$/.test(error.code)?error.code:'unknown';
        const status=typeof error.status==='number'&&Number.isInteger(error.status)&&error.status>=100&&error.status<=599?error.status:0;
        const diagnostic=code!=='unknown'?code:status>=500?'auth_server_error':error.name==='AuthRetryableFetchError'?'auth_connection_failed':error.name==='AuthInvalidCredentialsError'?'invalid_credentials':'unknown';
        console.warn('Signup rejected', {code:/^[a-z_]{1,80}$/.test(code)?code:'unknown',status:error.status});
        if(error.status===429||['email_address_not_authorized','over_email_send_rate_limit'].includes(code))throw emailError(error);
        const messages:Record<string,string>={
          user_already_exists:'An account already uses this email. Sign in instead, or use Google Sign In if you registered with Google.',
          email_exists:'An account already uses this email. Sign in instead, or use Google Sign In if you registered with Google.',
          weak_password:'Choose a stronger password with at least 12 characters, including uppercase and lowercase letters, a number, and a symbol. Avoid common or reused passwords.',
          email_address_invalid:'This email address is not accepted. Use a real email address you can receive messages at.',
          signup_disabled:'New accounts are currently disabled in Supabase. Enable new user signups in Authentication settings.',
          email_provider_disabled:'Email signup is disabled. Use Google Sign In or enable the email provider in Supabase.',
          captcha_failed:'Signup verification failed. Check the CAPTCHA configuration in Supabase.',
          unexpected_failure:'The account service could not complete signup. Check Supabase Auth logs for an email-delivery or database error.'
        };
        if(status>=500&&/error sending (confirmation|recovery|magic link) email/i.test(error.message))throw new ApiError('The email service could not send your verification email. Check the saved SMTP settings and Google App Password in Supabase. Error code: email_delivery_failed.',503);
        if(status>=500&&/database error (saving new user|creating new user)/i.test(error.message))throw new ApiError('The account database could not create your user. Check Supabase Auth and Postgres logs. Error code: account_database_failed.',503);
        const fallback=diagnostic==='auth_connection_failed'?'Synchro could not reach the account service. Please try again.':diagnostic==='auth_server_error'?'The account service returned a server error.':'Signup could not be completed.';
        throw new ApiError(messages[code]??`${fallback} Error code: ${diagnostic} (HTTP ${status||'unavailable'}).`,diagnostic==='auth_connection_failed'||status>=500?503:400);
      }
      return json({ signedIn: Boolean(data.session), confirmationRequired:!data.session, message: data.session ? 'Your account is ready.' : 'Check your email for a verification link. Already registered? Sign in with your original method.' });
    }
    if (body.action === 'signin') {
      const { error } = await client.auth.signInWithPassword({ email, password: body.password });
      if (error) throw new ApiError('That email and password didn’t work. Check your details and confirm your email first.', 401);
      return json({ signedIn: true });
    }
    throw new ApiError('That account action isn’t available.', 400);
  } catch (error) { return failure(error); }
}
