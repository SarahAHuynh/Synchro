import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/server/supabase';
import { appOrigin } from '@/lib/server/config';
export const dynamic = 'force-dynamic';
function reasonFor(code?:string) {
  if(['bad_code_verifier','flow_state_not_found','pkce_verifier_not_found'].includes(code??''))return 'browser';
  if(['otp_expired','flow_state_expired'].includes(code??''))return 'expired';
  return 'callback';
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  let reason=url.searchParams.has('error')?reasonFor(url.searchParams.get('error_code')??undefined):'missing_code';
  if (code) {
    try {
      const client = await sessionClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${appOrigin()}/account${url.searchParams.get('recovery') === '1' ? '?recovery=1' : '?resume=1'}`, { headers: { 'Cache-Control': 'no-store' } });
      reason=reasonFor(error.code);
      if(error.name==='AuthPKCECodeVerifierMissingError')reason='browser';
      console.warn('Auth callback rejected',{code:error.code&&/^[a-z_]{1,80}$/.test(error.code)?error.code:'unknown',status:error.status,reason});
    } catch { reason='callback'; }
  }
  return NextResponse.redirect(`${appOrigin()}/account?error=auth&reason=${reason}`, { headers: { 'Cache-Control': 'no-store' } });
}
