import { ApiError, authenticated, failure, json, readBody, sameOrigin } from '@/lib/server/http';
import { calendarBusy } from '@/lib/server/calendar';
import { calendarConfigured } from '@/lib/server/config';
import { validDateRange } from '@/lib/live-validation';
import { dateInZone, liveFreeWindows, validTimeZone, zonedTime } from '@/lib/live-availability';
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
    const busy = await calendarBusy(user.id, start, end, body.timeZone);
    const windows = liveFreeWindows(start, end, body.timeZone, body.duration, busy);
    return json({ windows, timeZone: body.timeZone, checkedAt: new Date().toISOString() });
  } catch (error) { return failure(error); }
}
