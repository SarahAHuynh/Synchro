import { ApiError, authenticated, failure, json, readBody, sameOrigin } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
import { calendarConfigured } from '@/lib/server/config';
import { decryptToken } from '@/lib/calendar-security';
import { validDateRange } from '@/lib/live-validation';
import { dateInZone, liveFreeWindows, nextDate, validTimeZone, zonedTime } from '@/lib/live-availability';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!calendarConfigured()) throw new ApiError('Calendar services are not configured yet.', 503);
    const { user } = await authenticated();
    const body = await readBody(request);
    if (!validDateRange(body.start, body.end) || typeof body.timeZone !== 'string' || !validTimeZone(body.timeZone) || typeof body.duration !== 'number' || !Number.isInteger(body.duration) || body.duration < 30 || body.duration > 480) throw new ApiError('Choose up to 14 days and a duration between 30 and 480 minutes.', 400);
    const start = body.start as string, end = body.end as string;
    const rangeStart = zonedTime(start, 0, body.timeZone);
    if (start < dateInZone(Date.now(), body.timeZone) || rangeStart > Date.now() + 366 * 86400000) throw new ApiError('Choose dates from today through the next year.', 400);
    const admin = adminClient();
    const { data: connection, error } = await admin.from('calendar_connections').select('refresh_token_encrypted').eq('user_id', user.id).maybeSingle();
    if (error) throw new ApiError('We couldn’t load your calendar connection.', 503);
    if (!connection) throw new ApiError('Connect Google Calendar first.', 409);
    const refreshToken = decryptToken(connection.refresh_token_encrypted, process.env.CALENDAR_TOKEN_ENCRYPTION_KEY!);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: refreshToken, grant_type: 'refresh_token' }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokens.access_token !== 'string') {
      if (tokens.error === 'invalid_grant') { await admin.from('calendar_connections').delete().eq('user_id', user.id); throw new ApiError('Your Google connection expired or was revoked. Please reconnect your calendar.', 409); }
      throw new ApiError('Google is temporarily unavailable. Please try again.', 503);
    }
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ timeMin: new Date(rangeStart).toISOString(), timeMax: new Date(zonedTime(nextDate(end), 0, body.timeZone)).toISOString(), timeZone: body.timeZone, items: [{ id: 'primary' }] }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok) throw new ApiError(response.status === 403 ? 'Google did not grant calendar access. Please reconnect and allow free/busy access.' : 'We couldn’t check Google Calendar. Try again shortly.', response.status === 403 ? 409 : 503);
    const calendar = result.calendars?.primary;
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy) || calendar.busy.some((window: {start?: unknown; end?: unknown}) => !window || typeof window.start !== 'string' || typeof window.end !== 'string')) throw new ApiError('Google could not confirm availability. We won’t assume your calendar is free.', 503);
    const windows = liveFreeWindows(start, end, body.timeZone, body.duration, calendar.busy);
    return json({ windows, timeZone: body.timeZone, checkedAt: new Date().toISOString() });
  } catch (error) { return failure(error); }
}
