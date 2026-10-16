import { canWriteEvents } from '../calendar-scopes';
import 'server-only';
import { ApiError } from './http';
import { adminClient } from './supabase';
import { calendarConfigured } from './config';
import { decryptToken } from '../calendar-security';
import { nextDate, zonedTime } from '../live-availability';
import type { LiveWindow } from '../live-availability';
// Call only after verifying ownership or explicit group membership and consent.
export async function calendarBusy(userId: string, start: string, end: string, timeZone: string): Promise<LiveWindow[]> {
    const accessToken = await calendarAccessToken(userId);
    const rangeStart = zonedTime(start, 0, timeZone);
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ timeMin: new Date(rangeStart).toISOString(), timeMax: new Date(zonedTime(nextDate(end), 0, timeZone)).toISOString(), timeZone: timeZone, items: [{ id: 'primary' }] }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok) throw new ApiError(response.status === 403 ? 'Google did not grant calendar access. Please reconnect and allow free/busy access.' : 'We couldn’t check Google Calendar. Try again shortly.', response.status === 403 ? 409 : 503);
    const calendar = result.calendars?.primary;
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy) || calendar.busy.some((window: {start?: unknown; end?: unknown}) => !window || typeof window.start !== 'string' || typeof window.end !== 'string')) throw new ApiError('Google could not confirm availability. We won’t assume your calendar is free.', 503);
    const blocks = calendar.busy as LiveWindow[];
    if (blocks.some(block => !Number.isFinite(Date.parse(block.start)) || !Number.isFinite(Date.parse(block.end)) || Date.parse(block.end) <= Date.parse(block.start))) throw new ApiError('Google returned incomplete calendar data. Please try again.', 503);
    return blocks;
}

export async function calendarAccessToken(userId: string, write = false): Promise<string> {
    if (!calendarConfigured()) throw new ApiError('Calendar services are not configured yet.', 503);
    const admin = adminClient();
    const { data: connection, error } = await admin.from('calendar_connections').select('refresh_token_encrypted, scope').eq('user_id', userId).maybeSingle();
    if (error) throw new ApiError('We couldn’t load your calendar connection.', 503);
    if (!connection) throw new ApiError('Connect Google Calendar first.', 409);
    if (write && !canWriteEvents(connection.scope)) throw new ApiError('Reconnect Google Calendar and allow event creation.', 409);
    let refreshToken: string;
    try { refreshToken = decryptToken(connection.refresh_token_encrypted, process.env.CALENDAR_TOKEN_ENCRYPTION_KEY!); } catch { throw new ApiError('Please reconnect Google Calendar to restore access.', 409); }
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: refreshToken, grant_type: 'refresh_token' }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokens.access_token !== 'string') {
      if (tokens.error === 'invalid_grant') { await admin.from('calendar_connections').delete().eq('user_id', userId); throw new ApiError('Your Google connection expired or was revoked. Please reconnect your calendar.', 409); }
      throw new ApiError('Google is temporarily unavailable. Please try again.', 503);
    }
    return tokens.access_token;
}
