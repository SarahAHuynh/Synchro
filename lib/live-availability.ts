export type LiveWindow = { start: string; end: string };
export function validTimeZone(zone: string) { try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return zone.length < 100; } catch { return false; } }
function localParts(stamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(stamp);
  const pick = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'), pick('second'));
}
export function zonedTime(date: string, minutes: number, zone: string) {
  const target = Date.parse(`${date}T00:00:00Z`) + minutes * 60000;
  let result = target;
  for (let i = 0; i < 4; i++) { const offset = target - localParts(result, zone); if (!offset) return result; result += offset; }
  if (localParts(result, zone) !== target) throw new Error('This local time does not exist. Choose another date.');
  return result;
}
export function nextDate(date: string) { return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10); }
export function liveFreeWindows(start: string, end: string, zone: string, duration: number, busy: LiveWindow[], now = Date.now()): LiveWindow[] {
  const result: LiveWindow[] = [];
  const blocks = busy.map(window => ({ start: Date.parse(window.start), end: Date.parse(window.end) })).sort((a,b) => a.start - b.start);
  // Malformed provider data must never be interpreted as an empty calendar.
  if (blocks.some(window => !Number.isFinite(window.start) || !Number.isFinite(window.end) || window.end <= window.start)) throw new Error('Invalid calendar response.');
  for (let date = start; date <= end; date = nextDate(date)) {
    const opening = zonedTime(date, 540, zone), closing = zonedTime(date, 1260, zone);
    let cursor = Math.max(opening, now);
    const add = (from: number, until: number) => {
      const rounded = opening + Math.ceil((from - opening) / 1800000) * 1800000;
      if (until - rounded >= duration * 60000) result.push({ start: new Date(rounded).toISOString(), end: new Date(rounded + duration * 60000).toISOString() });
    };
    for (const block of blocks) {
      if (block.end <= cursor || block.start >= closing) continue;
      if (block.start > cursor) add(cursor, Math.min(block.start, closing));
      cursor = Math.max(cursor, block.end);
      if (cursor >= closing) break;
    }
    if (cursor < closing) add(cursor, closing);
  }
  return result;
}

export function dateInZone(stamp: number, zone: string) { return new Date(localParts(stamp, zone)).toISOString().slice(0, 10); }
