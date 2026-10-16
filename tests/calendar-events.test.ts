import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/server/calendar',()=>({calendarAccessToken:vi.fn()}));
vi.mock('@/lib/server/supabase',()=>({adminClient:vi.fn()}));
import { applyCalendarJob, processCalendarJobs, type CalendarJob } from '../lib/server/calendar-events';
import { calendarAccessToken } from '../lib/server/calendar';
import { adminClient } from '../lib/server/supabase';
import { ApiError } from '../lib/server/http';
const fetchMock=vi.fn(),rpc=vi.fn();
const job:CalendarJob={event_id:'a'.repeat(32),group_id:'group',user_id:'member',payload:{summary:'Coffee',start:{dateTime:'2027-01-17T17:00:00Z'},end:{dateTime:'2027-01-17T18:00:00Z'}},desired:true,lease_token:'lease'};
beforeEach(()=>{vi.clearAllMocks();fetchMock.mockReset();rpc.mockReset();vi.stubGlobal('fetch',fetchMock);vi.mocked(calendarAccessToken).mockResolvedValue('secret-token');vi.mocked(adminClient).mockReturnValue({rpc} as unknown as ReturnType<typeof adminClient>);});
afterEach(()=>vi.unstubAllGlobals());
it('writes a deterministic event to the consenting member’s primary calendar, without attendee mail',async()=>{
 fetchMock.mockResolvedValue(Response.json({id:job.event_id}));await applyCalendarJob(job);
 expect(calendarAccessToken).toHaveBeenCalledWith('member',true);
 const [url,options]=fetchMock.mock.calls[0];expect(url).toContain('/calendars/primary/events?sendUpdates=none');expect(JSON.parse(options.body)).toEqual({...job.payload,id:job.event_id});expect(JSON.parse(options.body)).not.toHaveProperty('attendees');
});
it('recognizes an existing event after an uncertain insert and does not insert a second ID',async()=>{
 fetchMock.mockResolvedValueOnce(Response.json({}, {status:409})).mockResolvedValueOnce(Response.json({extendedProperties:{private:{synchroGroup:'group'}}}));await expect(applyCalendarJob(job)).resolves.toBeUndefined();expect(fetchMock.mock.calls[1][1].method).toBe('GET');
});
it('does not accept an ID collision or deleted event as a successful sync',async()=>{
 fetchMock.mockResolvedValueOnce(Response.json({}, {status:409})).mockResolvedValueOnce(Response.json({status:'cancelled',extendedProperties:{private:{synchroGroup:'group'}}}));await expect(applyCalendarJob(job)).rejects.toThrow();
});
it.each([204,404,410])('deletion is idempotent for response %s',async(status)=>{
 fetchMock.mockResolvedValue(new Response(null,{status}));await applyCalendarJob({...job,desired:false});expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
});
it('stores reconnect failures without discarding other participants’ successes',async()=>{
 rpc.mockResolvedValueOnce({data:[job,{...job,event_id:'b'.repeat(32),user_id:'other'}],error:null}).mockResolvedValue({error:null});
 vi.mocked(calendarAccessToken).mockRejectedValueOnce(new ApiError('Reconnect',409)).mockResolvedValueOnce('token');fetchMock.mockResolvedValue(Response.json({}));
 await processCalendarJobs('group',true);
 expect(rpc).toHaveBeenCalledWith('finish_calendar_job',expect.objectContaining({p_event:job.event_id,p_error:'reconnect'}));expect(rpc).toHaveBeenCalledWith('finish_calendar_job',expect.objectContaining({p_event:'b'.repeat(32),p_error:null}));
});
it('denies the scheduled worker without a secret',async()=>{
 const {GET}=await import('../app/api/calendar/sync/route');vi.stubEnv('CRON_SECRET','');expect((await GET(new Request('http://localhost/api/calendar/sync'))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();vi.unstubAllEnvs();
});
it('accepts the scheduler secret but rejects an incorrect bearer token',async()=>{
 const {GET}=await import('../app/api/calendar/sync/route');vi.stubEnv('CRON_SECRET','a'.repeat(64));rpc.mockResolvedValue({data:[],error:null});
 expect((await GET(new Request('http://localhost/api/calendar/sync',{headers:{authorization:'Bearer '+'b'.repeat(64)}}))).status).toBe(401);
 expect((await GET(new Request('http://localhost/api/calendar/sync',{headers:{authorization:'Bearer '+'a'.repeat(64)}}))).status).toBe(200);
 expect(rpc).toHaveBeenCalledWith('claim_calendar_jobs',{p_group:null,p_force:false});vi.unstubAllEnvs();
});
