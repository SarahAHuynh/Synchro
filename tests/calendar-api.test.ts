import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/config', () => ({ authConfigured: () => true, calendarConfigured: () => true, appOrigin: () => 'http://localhost:3000' }));
vi.mock('@/lib/server/supabase', () => ({ sessionClient: vi.fn(), adminClient: vi.fn() }));
vi.mock('@/lib/calendar-security', () => ({ decryptToken: () => 'private-refresh-token' }));
import { POST } from '../app/api/calendar/availability/route';
import { sessionClient, adminClient } from '../lib/server/supabase';
const lookup = vi.fn();
const provider = vi.fn();
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
  vi.mocked(sessionClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'signed-in-user' } }, error: null }) } } as unknown as Awaited<ReturnType<typeof sessionClient>>);
  lookup.mockReturnValue({ maybeSingle: async () => ({ data: { refresh_token_encrypted: 'encrypted-value' }, error: null }) });
  vi.mocked(adminClient).mockReturnValue({ from: () => ({ select: () => ({ eq: lookup }) }) } as unknown as ReturnType<typeof adminClient>);
  vi.stubGlobal('fetch', provider);
  provider.mockResolvedValueOnce(Response.json({ access_token: 'private-access-token' }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); provider.mockReset(); vi.useRealTimers(); });
const request = () => new Request('http://localhost:3000/api/calendar/availability', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ start:'2026-10-17',end:'2026-10-17',duration:60,timeZone:'UTC',userId:'someone-else' }) });
describe('live availability authorization and provider failures', () => {
  it('only uses the verified user and sends the browser free windows, never tokens or raw busy blocks', async () => {
    provider.mockResolvedValueOnce(Response.json({ calendars: { primary: { busy: [{start:'2026-10-17T10:00:00Z',end:'2026-10-17T12:00:00Z'}] } } }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(lookup).toHaveBeenCalledWith('user_id','signed-in-user');
    expect(result.windows).toHaveLength(2);
    expect(JSON.stringify(result)).not.toMatch(/private-|encrypted-value|busy/);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('does not return fabricated availability when Google reports a calendar error', async () => {
    provider.mockResolvedValueOnce(Response.json({ calendars: { primary: { errors: [{ reason:'notFound' }] } } }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('windows');
  });
  it('requires a verified session before accessing any stored token', async () => {
    vi.mocked(sessionClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: new Error('invalid session') }) } } as unknown as Awaited<ReturnType<typeof sessionClient>>);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(lookup).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
});
