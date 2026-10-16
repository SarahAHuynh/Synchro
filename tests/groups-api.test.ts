import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/config', () => ({ authConfigured: () => true, calendarConfigured: () => true, appOrigin: () => 'http://localhost:3000' }));
vi.mock('@/lib/server/supabase', () => ({ sessionClient: vi.fn(), adminClient: vi.fn() }));
vi.mock('@/lib/server/calendar-events', () => ({ processCalendarJobs: vi.fn().mockResolvedValue({processed:0}), requireEventQueue: vi.fn().mockResolvedValue(undefined), calendarSyncStatus: vi.fn().mockResolvedValue({scheduled:0,pending:0,failed:0,removing:0,needsReconnect:false}) }));
vi.mock('@/lib/server/calendar', () => ({ calendarBusy: vi.fn() }));
import { sessionClient, adminClient } from '../lib/server/supabase';
import { processCalendarJobs } from '../lib/server/calendar-events';
import { calendarBusy } from '../lib/server/calendar';
import { invitationToken } from '../lib/server/invitations';
import { GET, POST } from '../app/api/hangouts/[id]/route';
import { POST as create, GET as list } from '../app/api/hangouts/route';
import { defaultPreferences } from '../lib/mock-data';
import type { GroupPlan } from '../lib/groups';
import { liveFreeWindows } from '../lib/live-availability';
const id = '00000000-0000-4000-8000-000000000001';
let user: { id: string; email: string; email_confirmed_at?: string } | null;
let stored: { document: GroupPlan; revision: number; invite_emails: string[] } | null;
let conflict = false;
let profileWrites = 0;
const profile = () => ({ name: user?.id === 'owner' ? 'Jamie' : 'Alex', preferences: structuredClone(defaultPreferences) });
function db() {
  return { from: (table: string) => {
    const filters: Record<string, unknown> = {}; let patch: Record<string, unknown> | undefined;
    const read = () => {
      if (table === 'profiles') return { data: profile(), error: null };
      if (table === 'calendar_connections') return { data: { user_id: user?.id }, error: null };
      if (patch) {
        if (!stored || conflict || filters.revision !== stored.revision) return { data: null, error: null };
        stored = { ...stored, ...structuredClone(patch) }; return { data: { id }, error: null };
      }
      const emails = filters.invite_emails as string[] | undefined;
      return { data: stored && (!emails || emails.every(email => stored!.invite_emails.includes(email))) ? structuredClone(stored) : null, error: null };
    };
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
      contains: (key: string, value: unknown) => { filters[key] = value; return builder; },
      order: () => builder, limit: async () => { const r = read(); return { data: r.data ? [r.data] : [], error: null }; },
      update: (value: Record<string, unknown>) => { patch = value; if (table === 'profiles') profileWrites++; return builder; },
      insert: async (value: { document: GroupPlan; invite_emails: string[] }) => { stored = { ...structuredClone(value), revision: 0 }; return { error: null }; },
      maybeSingle: async () => read(),
    };
    return builder;
  } };
}
const context = { params: Promise.resolve({ id }) };
const request = (body: unknown, origin = 'http://localhost:3000') => new Request(`http://localhost:3000/api/hangouts/${id}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const run = (body: unknown) => POST(request(body), context);
const read = () => GET(new Request(`http://localhost:3000/api/hangouts/${id}`), context);
const input = { name: 'Sunday together', description: '', start: '2027-01-17', end: '2027-01-17', timeZone: 'UTC', min: 60, max: 120, emails: ['alex@example.com'], consent: true };
beforeEach(() => {
  vi.stubEnv('CALENDAR_TOKEN_ENCRYPTION_KEY', 'a'.repeat(64));
  user = { id: 'owner', email: 'jamie@example.com', email_confirmed_at: '2026-01-01' }; stored = null; conflict = false; profileWrites = 0;
  vi.mocked(sessionClient).mockImplementation(async () => ({ ...db(), auth: { getUser: async () => ({ data: { user }, error: null }) } }) as unknown as Awaited<ReturnType<typeof sessionClient>>);
  vi.mocked(adminClient).mockImplementation(() => db() as unknown as ReturnType<typeof adminClient>);
  vi.mocked(calendarBusy).mockReset(); vi.mocked(calendarBusy).mockResolvedValue([]);
});
async function joined() {
  expect((await create(request(input))).status).toBe(201);
  user = { id: 'guest', email: 'alex@example.com', email_confirmed_at: '2026-01-01' };
  expect((await run({ action: 'join', consent: true, useSaved: true, userId: 'forged-id' })).status).toBe(200);
  user = { id: 'owner', email: 'jamie@example.com', email_confirmed_at: '2026-01-01' };
}
async function selected() { await joined(); expect((await run({ action:'find' })).status).toBe(200); const slot = stored!.document.windows[0]; expect((await run({ action:'select',...slot })).status).toBe(200); }
describe('real group authorization and lifecycle', () => {
  it('persists create → join → actual shared time → individual votes → confirmed plan', async () => {
    await selected(); const g = stored!.document; const activityId = g.activities[0].id;
    expect((await run({action:'vote',activityId})).status).toBe(200);
    expect((await run({action:'confirm',activityId})).status).toBe(409);
    user = { id:'guest',email:'alex@example.com',email_confirmed_at:'2026-01-01' };
    expect((await run({action:'vote',activityId,userId:'owner'})).status).toBe(200);
    expect((await run({action:'confirm',activityId})).status).toBe(403);
    user = { id:'owner',email:'jamie@example.com',email_confirmed_at:'2026-01-01' };
    expect((await run({action:'confirm',activityId})).status).toBe(200);
    expect(stored!.document.status).toBe('confirmed');
    expect(stored!.document.calendarRevision).toMatch(/^[a-f0-9-]{36}$/);
    expect(processCalendarJobs).toHaveBeenCalledWith(stored!.document.id);
    expect(calendarBusy).toHaveBeenCalledWith('guest',input.start,input.end,'UTC');
    expect(stored!.document.members[1].userId).toBe('guest');
    expect((await (await read()).json()).confirmedActivityId).toBe(activityId);
  });
  it('protects invitation details, membership and unverified accounts', async () => {
    await create(request(input));
    expect((await run({action:'find'})).status).toBe(409);
    expect(calendarBusy).not.toHaveBeenCalled();
    user = {id:'stranger',email:'stranger@example.com',email_confirmed_at:'2026-01-01'};
    expect((await read()).status).toBe(404);
    expect((await run({action:'join',consent:true,useSaved:true})).status).toBe(404);
    expect((await (await list()).json()).groups).toEqual([]);
    user = {id:'guest',email:'alex@example.com'};
    expect((await run({action:'join',consent:true,useSaved:true})).status).toBe(403);
    user.email_confirmed_at = '2026-01-01';
    const invite = await (await read()).json();
    expect(invite.invitation).toBe(true); expect(invite).not.toHaveProperty('members'); expect(invite).not.toHaveProperty('votes');
    expect((await run({action:'join',consent:false,useSaved:true})).status).toBe(400);
  });
  it('rejects cross-origin writes and unauthenticated requests', async () => {
    expect((await POST(request({action:'find'},'https://other.example'),context)).status).toBe(403);
    user=null; expect((await create(request(input))).status).toBe(401);
  });
  it('does not expose other members’ preference snapshots or individual votes', async () => {
    await selected(); const body = await (await read()).json();
    expect(body.myPreferences).toEqual(defaultPreferences);
    expect(body.members[1]).not.toHaveProperty('preferences');
    expect(body.members[1]).not.toHaveProperty('userId');
    expect(body.votes).toEqual({});expect(body.counts).toEqual({});
  });
  it('keeps personal profiles intact and invalidates votes when hangout preferences change', async () => {
    await selected(); await run({action:'vote',activityId:stored!.document.activities[0].id});
    expect((await run({action:'preferences',consent:true,preferences:{...defaultPreferences,budgetPerPerson:0}})).status).toBe(200);
    expect(stored!.document.selected).toBeNull(); expect(stored!.document.votes).toEqual({}); expect(profileWrites).toBe(0);
    expect(stored!.document.members[0].preferences!.budgetPerPerson).toBe(0);
  });
  it('fails closed when any Google calendar fails', async () => {
    await joined(); vi.mocked(calendarBusy).mockRejectedValue(new Error('provider is unavailable'));
    expect((await run({action:'find'})).status).toBe(503); expect(stored!.document.checkedAt).toBeNull();
  });
  it('rejects stale concurrent writes without overwriting someone else', async () => {
    await joined(); const before=structuredClone(stored); conflict=true;
    expect((await run({action:'cancel',reason:'Weather warning'})).status).toBe(409); expect(stored).toEqual(before);
  });
  it('rechecks availability before confirmation and refuses new conflicts', async () => {
    await selected(); const { selected: slot, activities } = stored!.document; const activityId = activities[0].id;
    await run({action:'vote',activityId}); user={id:'guest',email:'alex@example.com',email_confirmed_at:'2026-01-01'}; await run({action:'vote',activityId}); user={id:'owner',email:'jamie@example.com',email_confirmed_at:'2026-01-01'};
    vi.mocked(calendarBusy).mockResolvedValue([slot!]);
    expect((await run({action:'confirm',activityId})).status).toBe(409); expect(stored!.document.status).toBe('voting');
  });
  it('requires everyone to consent again after a date change', async () => {
    await joined(); expect((await run({action:'dates',start:'2027-01-18',end:'2027-01-18',min:60,max:90})).status).toBe(200);
    expect(stored!.document.members.every(member=>!member.consent)).toBe(true);
    expect((await run({action:'find'})).status).toBe(409); expect(calendarBusy).not.toHaveBeenCalled();
  });
  it('requires organizer review instead of silently removing an attending guest', async () => {
    await selected(); user={id:'guest',email:'alex@example.com',email_confirmed_at:'2026-01-01'};
    expect((await run({action:'leave'})).status).toBe(409); expect((await read()).status).toBe(200);
    expect(stored!.document.selected).not.toBeNull(); expect(stored!.invite_emails).toContain('alex@example.com');
  });
  it('rejects duplicate guests, oversized groups, backwards dates and missing consent', async () => {
    for(const patch of [{emails:['A@example.com','a@example.com']},{emails:['jamie@example.com']},{emails:Array.from({length:10},(_,i)=>`friend${i}@example.com`)},{end:'2027-01-16'},{consent:false}]) expect((await create(request({...input,...patch}))).status).toBe(400);
  });
  it('intersects all busy blocks and respects both duration limits', () => {
    const blocks=[{start:'2027-01-17T09:00:00Z',end:'2027-01-17T10:30:00Z'},{start:'2027-01-17T10:00:00Z',end:'2027-01-17T12:00:00Z'},{start:'2027-01-17T13:00:00Z',end:'2027-01-17T21:00:00Z'}];
    expect(liveFreeWindows(input.start,input.end,'UTC',30,blocks,0,90)).toEqual([{start:'2027-01-17T12:00:00.000Z',end:'2027-01-17T13:00:00.000Z'}]);
    expect(liveFreeWindows(input.start,input.end,'UTC',90,blocks,0,120)).toEqual([]);
  });
});

describe('shareable invitation links', () => {
  it('creates a link-only plan and lets a verified new guest join without an email placeholder', async () => {
    expect((await create(request({...input,emails:[]}))).status).toBe(201);
    const token=invitationToken(stored!.document);
    const ownerView=await (await read()).json();expect(ownerView.inviteUrl).toContain('invite='+token);expect(ownerView).not.toHaveProperty('inviteVersion');
    user={id:'new-account',email:'new@example.com',email_confirmed_at:'2026-01-01'};
    const info=await GET(new Request('http://localhost:3000/api/hangouts/'+id,{headers:{'x-synchro-invite':token}}),context);
    expect(info.status).toBe(200);const preview=await info.json();expect(preview.invitation).toBe(true);expect(preview).not.toHaveProperty('members');
    expect((await run({action:'find',inviteToken:token})).status).toBe(403);
    expect((await run({action:'join',useSaved:true,consent:true,inviteToken:token})).status).toBe(200);
    expect(stored!.document.members[1].userId).toBe('new-account');
    const joined=await (await read()).json();expect(joined.invitation).toBe(false);expect(joined.inviteUrl).toBe('');
  });
  it('rejects forged links and cannot change a plan by declining a link without joining', async () => {
    await create(request(input));const token=invitationToken(stored!.document);
    user={id:'stranger',email:'stranger@example.com',email_confirmed_at:'2026-01-01'};
    expect((await run({action:'join',useSaved:true,consent:true,inviteToken:'0'.repeat(64)})).status).toBe(404);
    const before=structuredClone(stored);expect((await run({action:'leave',inviteToken:token})).status).toBe(200);expect(stored).toEqual(before);
  });
  it('revokes old bearer links when the organizer replaces one', async () => {
    await create(request(input));const token=invitationToken(stored!.document);
    expect((await run({action:'renew-link'})).status).toBe(200);const replacement=invitationToken(stored!.document);expect(replacement).not.toBe(token);
    user={id:'stranger',email:'stranger@example.com',email_confirmed_at:'2026-01-01'};
    expect((await run({action:'join',useSaved:true,consent:true,inviteToken:token})).status).toBe(404);
    expect((await run({action:'join',useSaved:true,consent:true,inviteToken:replacement})).status).toBe(200);
  });
  it('keeps ten-person capacity and closes joining once a plan is confirmed', async () => {
    await create(request({...input,emails:Array.from({length:9},(_,i)=>`guest${i}@example.com`)}));
    const token=invitationToken(stored!.document);user={id:'extra',email:'extra@example.com',email_confirmed_at:'2026-01-01'};
    expect((await run({action:'join',useSaved:true,consent:true,inviteToken:token})).status).toBe(409);expect(stored!.document.members).toHaveLength(10);
    stored!.document.members=stored!.document.members.slice(0,1);stored!.document.status='confirmed';
    expect((await run({action:'join',useSaved:true,consent:true,inviteToken:token})).status).toBe(409);
  });
});

it('only the organizer can cancel and the cancelled record stays visible to participants',async()=>{
 await joined();user={id:'guest',email:'alex@example.com',email_confirmed_at:'2026-01-01'};
 expect((await run({action:'cancel',reason:'Weather warning'})).status).toBe(403);
 user={id:'owner',email:'jamie@example.com',email_confirmed_at:'2026-01-01'};expect((await run({action:'cancel',reason:'Weather warning'})).status).toBe(200);
 expect(stored!.document.status).toBe('cancelled');expect(stored!.document.members).toHaveLength(2);
 const ownerList=await (await list()).json();expect(ownerList.groups[0].isOrganizer).toBe(true);
 user={id:'guest',email:'alex@example.com',email_confirmed_at:'2026-01-01'};const result=await (await list()).json();expect(result.groups[0]).toMatchObject({status:'cancelled',isOrganizer:false});
});

it('requires reasons, keeps attendance until organizer review, and protects decisions',async()=>{
 await selected();user={id:'guest',email:'alex@example.com',email_confirmed_at:'2026-01-01'};
 expect((await run({action:'request-attendance',kind:'reschedule',reason:' '})).status).toBe(400);
 expect((await run({action:'request-attendance',kind:'reschedule',reason:'Work conflict'})).status).toBe(200);
 expect(stored!.document.members).toHaveLength(2);expect(stored!.document.status).toBe('voting');const change=stored!.document.attendanceRequests![0];
 expect((await run({action:'resolve-attendance',requestId:change.id,decision:'remove',reason:'Okay'})).status).toBe(403);
 user={id:'owner',email:'jamie@example.com',email_confirmed_at:'2026-01-01'};
 const summary=await (await list()).json();expect(summary.groups[0].attention).toBe('Review attendance request');
 expect((await run({action:'find'})).status).toBe(409);
 expect((await run({action:'resolve-attendance',requestId:change.id,decision:'reschedule',reason:'Let’s find another time'})).status).toBe(200);
 expect(stored!.document.status).toBe('planning');expect(stored!.document.selected).toBeNull();expect(stored!.document.attendanceRequests![0].status).toBe('rescheduling');
});
it('excuses a guest without clearing an already confirmed plan when two people remain',async()=>{
 await selected();stored!.document.status='confirmed';stored!.document.calendarRevision='same-calendar';stored!.document.members.push({userId:'third',email:'third@example.com',name:'Taylor',consent:true,preferences:defaultPreferences});
 user={id:'guest',email:'alex@example.com',email_confirmed_at:'2026-01-01'};
 expect((await run({action:'request-attendance',kind:'cannot-attend',reason:'Feeling ill'})).status).toBe(200);const requestId=stored!.document.attendanceRequests![0].id;
 user={id:'third',email:'third@example.com',email_confirmed_at:'2026-01-01'};expect((await (await read()).json()).attendanceRequests).toEqual([]);
 user={id:'owner',email:'jamie@example.com',email_confirmed_at:'2026-01-01'};
 expect((await run({action:'resolve-attendance',requestId,decision:'remove',reason:'Rest and feel better'})).status).toBe(200);
 expect(stored!.document.status).toBe('confirmed');expect(stored!.document.calendarRevision).toBe('same-calendar');expect(stored!.document.members).toHaveLength(2);
 user={id:'guest',email:'alex@example.com',email_confirmed_at:'2026-01-01'};expect((await read()).status).toBe(404);
});
it('refuses a cancellation without a reason',async()=>{await joined();expect((await run({action:'cancel'})).status).toBe(400);expect(stored!.document.status).not.toBe('cancelled');});
