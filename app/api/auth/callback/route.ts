import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/server/supabase';
import { appOrigin } from '@/lib/server/config';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    try {
      const client = await sessionClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${appOrigin()}/account${url.searchParams.get('recovery') === '1' ? '?recovery=1' : ''}`, { headers: { 'Cache-Control': 'no-store' } });
    } catch { /* Never expose OAuth codes or provider errors. */ }
  }
  return NextResponse.redirect(`${appOrigin()}/account?error=auth`, { headers: { 'Cache-Control': 'no-store' } });
}
