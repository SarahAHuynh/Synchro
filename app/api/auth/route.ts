import { authConfigured, appOrigin, calendarConfigured } from '@/lib/server/config';
import { adminClient, sessionClient } from '@/lib/server/supabase';
import { ApiError, authenticated, failure, json, readBody, sameOrigin } from '@/lib/server/http';
import { validPreferences } from '@/lib/live-validation';
import { isEmail } from '@/lib/validation';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!authConfigured()) return json({ configured: false, calendarConfigured: false, user: null });
  try {
    const { client, user } = await authenticated();
    const { data: profile, error } = await client.from('profiles').select('name, preferences').eq('id', user.id).maybeSingle();
    if (error) throw new ApiError('Your profile could not be loaded. Please try again.', 503);
    let connected = false;
    if (calendarConfigured()) {
      const { data, error: connectionError } = await adminClient().from('calendar_connections').select('user_id').eq('user_id', user.id).maybeSingle();
      if (connectionError) throw new ApiError('Your calendar status could not be loaded. Please try again.', 503);
      connected = Boolean(data);
    }
    const candidateName = profile?.name ?? user.user_metadata.full_name ?? user.user_metadata.name;
    const name = typeof candidateName === 'string' && candidateName.trim() ? candidateName.slice(0, 100) : user.email?.split('@')[0] ?? 'Friend';
    return json({ configured: true, calendarConfigured: calendarConfigured(), user: { id: user.id, email: user.email, name, preferences: validPreferences(profile?.preferences) ? profile.preferences : null, calendarConnected: connected } });
  } catch (error) { if (error instanceof ApiError && error.status === 401) return json({ configured: true, calendarConfigured: calendarConfigured(), user: null }); return failure(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!authConfigured()) throw new ApiError('Real accounts aren’t available until the account service is configured. The demo is still available.', 503);
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
      if (error) throw new ApiError('We couldn’t create that account. Check your details or try signing in.', 400);
      return json({ signedIn: Boolean(data.session), message: data.session ? 'Your account is ready.' : 'Check your email to confirm your account. Open the link in this browser, then sign in.' });
    }
    if (body.action === 'signin') {
      const { error } = await client.auth.signInWithPassword({ email, password: body.password });
      if (error) throw new ApiError('That email and password didn’t work. Check your details and confirm your email first.', 401);
      return json({ signedIn: true });
    }
    throw new ApiError('That account action isn’t available.', 400);
  } catch (error) { return failure(error); }
}
