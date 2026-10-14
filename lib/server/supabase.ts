import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { appOrigin, authConfigured } from './config';
export async function sessionClient() {
  if (!authConfigured()) throw new Error('Account services are not configured.');
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: appOrigin().startsWith('https://'), path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => { values.forEach(({ name, value, options }) => jar.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: appOrigin().startsWith('https://'), path: '/' })); },
    },
  });
}
export function adminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Calendar storage is not configured.');
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
