export const FREE_BUSY_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';
export const EVENT_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
export const CALENDAR_SCOPES = `${FREE_BUSY_SCOPE} ${EVENT_SCOPE}`;
export function canWriteEvents(scope: string | undefined) { return (scope ?? '').split(' ').includes(EVENT_SCOPE); }
