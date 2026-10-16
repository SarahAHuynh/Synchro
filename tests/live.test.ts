import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, equalState } from '../lib/calendar-security';
import { liveFreeWindows, validTimeZone, zonedTime } from '../lib/live-availability';
import { validDateRange, validPreferences } from '../lib/live-validation';
import { defaultPreferences } from '../lib/mock-data';
const key = 'a1'.repeat(32);
describe('calendar token protection', () => {
  it('encrypts tokens with a unique nonce and verifies them before decryption', () => {
    const a = encryptToken('private-refresh-token', key), b = encryptToken('private-refresh-token', key);
    expect(a).not.toBe(b); expect(a).not.toContain('private-refresh-token');
    expect(decryptToken(a, key)).toBe('private-refresh-token');
    expect(() => decryptToken(a, 'b2'.repeat(32))).toThrow();
    const [iv, tag, payload] = a.split('.');
    expect(() => decryptToken([iv, tag, (payload[0] === 'a' ? 'b' : 'a') + payload.slice(1)].join('.'), key)).toThrow();
  });
  it('rejects weak keys and mismatched OAuth state', () => {
    expect(() => encryptToken('secret', 'short')).toThrow();
    expect(equalState('', '')).toBe(false);
    expect(equalState('state-abc', 'state-def')).toBe(false);
    expect(equalState('state-abc', 'state-abc')).toBe(true);
  });
});
describe('live input validation', () => {
  it('validates profile boundaries and avoids accepting incomplete objects', () => {
    expect(validPreferences(defaultPreferences)).toBe(true);
    expect(validPreferences({ ...defaultPreferences, budgetPerPerson: Infinity })).toBe(false);
    expect(validPreferences({ ...defaultPreferences, categories: ['Pottery'], duration: '3-plus-hours' })).toBe(true);
    expect(validPreferences({ ...defaultPreferences, dislikedActivities: [123] })).toBe(false);
    expect(validPreferences({ ...defaultPreferences, categories: ['  '] })).toBe(false);
    expect(validPreferences({ ...defaultPreferences, categories: ['Pottery', 'pottery'] })).toBe(false);
    expect(validPreferences({ ...defaultPreferences, categories: ['x'.repeat(61)] })).toBe(false);
    expect(validPreferences(null)).toBe(false);
  });
  it('rejects invalid dates, excessive windows, and invalid zones', () => {
    expect(validDateRange('2026-02-30', '2026-03-01')).toBe(false);
    expect(validDateRange('2026-10-01', '2026-10-14')).toBe(true);
    expect(validDateRange('2026-10-01', '2026-10-15')).toBe(false);
    expect(validTimeZone('America/Los_Angeles')).toBe(true);
    expect(validTimeZone('Nowhere/Invalid')).toBe(false);
  });
});
describe('real calendar availability', () => {
  it('handles time zones and daylight-saving changes using absolute timestamps', () => {
    expect(new Date(zonedTime('2026-10-31', 540, 'America/Los_Angeles')).toISOString()).toBe('2026-10-31T16:00:00.000Z');
    expect(new Date(zonedTime('2026-11-01', 540, 'America/Los_Angeles')).toISOString()).toBe('2026-11-01T17:00:00.000Z');
  });
  it('subtracts real busy blocks, clips to daytime, and never offers the past', () => {
    const windows = liveFreeWindows('2026-10-17', '2026-10-17', 'UTC', 60, [
      { start: '2026-10-17T00:00:00Z', end: '2026-10-17T10:15:00Z' },
      { start: '2026-10-17T12:00:00Z', end: '2026-10-18T00:00:00Z' },
    ], Date.parse('2026-10-17T10:35:00Z'));
    expect(windows).toEqual([{ start: '2026-10-17T11:00:00.000Z', end: '2026-10-17T12:00:00.000Z' }]);
  });
  it('fails closed on malformed provider blocks', () => {
    expect(() => liveFreeWindows('2026-10-17','2026-10-17','UTC',60,[{start:'invalid',end:'invalid'}],0)).toThrow();
  });
  it('does not expose event details and has no free time when fully busy', () => {
    expect(liveFreeWindows('2026-10-17','2026-10-17','UTC',60,[{start:'2026-10-17T00:00:00Z',end:'2026-10-18T00:00:00Z'}],0)).toEqual([]);
  });
});
