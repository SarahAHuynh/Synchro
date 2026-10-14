import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { appOrigin, calendarConfigured } from '@/lib/server/config';
import { ApiError, authenticated, failure, json, sameOrigin } from '@/lib/server/http';
import { encryptToken } from '@/lib/calendar-security';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!calendarConfigured()) throw new ApiError('Google Calendar connection isn’t available yet.', 503);
    const { user } = await authenticated();
    const state = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
    const jar = await cookies();
    jar.set('synchro-calendar-oauth', encryptToken(JSON.stringify({ state, verifier, userId: user.id, createdAt: Date.now() }), process.env.CALENDAR_TOKEN_ENCRYPTION_KEY!), { httpOnly: true, secure: appOrigin().startsWith('https:'), sameSite: 'lax', path: '/api/calendar/callback', maxAge: 600 });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${appOrigin()}/api/calendar/callback`, response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar.freebusy', access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    return json({ url: url.toString() });
  } catch (error) { return failure(error); }
}
