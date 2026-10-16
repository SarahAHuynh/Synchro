import { CALENDAR_SCOPES } from '@/lib/calendar-scopes';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { appOrigin, calendarConfigured } from '@/lib/server/config';
import { authenticated } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
import { decryptToken, encryptToken, equalState } from '@/lib/calendar-security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const redirect = (result: string) => NextResponse.redirect(`${appOrigin()}/account?calendar=${result}`, { headers: { 'Cache-Control': 'no-store' } });
  const jar = await cookies();
  const saved = jar.get('synchro-calendar-oauth')?.value;
  jar.set('synchro-calendar-oauth', '', { httpOnly: true, secure: appOrigin().startsWith('https:'), sameSite: 'lax', path: '/api/calendar/callback', maxAge: 0 });
  try {
    if (!calendarConfigured() || !saved) return redirect('failed');
    const url = new URL(request.url);
    const session: { state: string; verifier: string; userId: string; createdAt: number } = JSON.parse(decryptToken(saved, process.env.CALENDAR_TOKEN_ENCRYPTION_KEY!));
    const { user } = await authenticated();
    if (!equalState(session.state, url.searchParams.get('state') ?? '') || session.userId !== user.id || Date.now() - session.createdAt > 600000 || session.createdAt > Date.now()) return redirect('failed');
    if (url.searchParams.has('error')) return redirect('cancelled');
    const code = url.searchParams.get('code');
    if (!code) return redirect('failed');
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${appOrigin()}/api/calendar/callback`, grant_type: 'authorization_code', code_verifier: session.verifier }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const tokens = await response.json();
    if (!response.ok || typeof tokens.refresh_token !== 'string' || typeof tokens.scope !== 'string' || !CALENDAR_SCOPES.split(' ').every(scope => tokens.scope.split(' ').includes(scope))) return redirect('failed');
    const { error } = await adminClient().from('calendar_connections').upsert({ user_id: user.id, refresh_token_encrypted: encryptToken(tokens.refresh_token, process.env.CALENDAR_TOKEN_ENCRYPTION_KEY!), scope: tokens.scope, connected_at: new Date().toISOString() });
    if (error) return redirect('failed');
    return redirect('connected');
  } catch { return redirect('failed'); }
}
