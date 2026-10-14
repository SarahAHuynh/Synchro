import { ApiError, authenticated, failure, json, sameOrigin } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
import { decryptToken } from '@/lib/calendar-security';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await authenticated();
    const admin = adminClient();
    const { data, error } = await admin.from('calendar_connections').select('refresh_token_encrypted').eq('user_id', user.id).maybeSingle();
    if (error) throw new ApiError('We couldn’t disconnect your calendar. Try again.', 503);
    let revoked = true;
    if (data) {
      try {
        const token = decryptToken(data.refresh_token_encrypted, process.env.CALENDAR_TOKEN_ENCRYPTION_KEY!);
        const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token }), signal: AbortSignal.timeout(10000) });
        revoked = response.ok;
      } catch { revoked = false; }
    }
    const { error: deleteError } = await admin.from('calendar_connections').delete().eq('user_id', user.id);
    if (deleteError) throw new ApiError('Your connection couldn’t be removed. Please try again.', 503);
    return json({ message: revoked ? 'Your calendar is disconnected.' : 'Synchro has removed its stored connection. Google could not confirm revocation; you can also remove Synchro in your Google Account permissions.' });
  } catch (error) { return failure(error); }
}
