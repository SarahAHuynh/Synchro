import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
const db=new PGlite();
const groupId='00000000-0000-4000-8000-000000000001',owner='00000000-0000-4000-8000-000000000002',guest='00000000-0000-4000-8000-000000000003';
const document=()=>({id:groupId,name:'Coffee',description:'Catch up',status:'confirmed',calendarRevision:'confirmation-one',confirmedActivityId:'coffee',activities:[{id:'coffee',name:'Coffee together'}],selected:{start:'2027-01-17T17:00:00Z',end:'2027-01-17T18:00:00Z'},timeZone:'America/Los_Angeles',members:[{userId:owner,consent:true},{userId:guest,consent:true}]});
type Job={event_id:string;desired:boolean;lease_token:string;status:string;payload:Record<string,unknown>};
const rows=async()=> (await db.query<Job>('select * from calendar_event_jobs order by event_id')).rows;
const claim=async(force=false)=>(await db.query<Job>('select * from claim_calendar_jobs($1,$2)',[groupId,force])).rows;
const save=async(doc:unknown)=>db.query('update hangout_groups set document=$1, revision=revision+1 where id=$2',[JSON.stringify(doc),groupId]);
beforeAll(async()=>{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
 await db.exec(readFileSync('supabase/migrations/202610140001_group_planning.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/202610150001_calendar_events.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/202610150002_attendance_notifications.sql','utf8'));
 await db.query('insert into auth.users values ($1),($2)',[owner,guest]);
},30000);
beforeEach(async()=>{await db.exec('delete from hangout_groups');await db.query('insert into hangout_groups(id,invite_emails,document) values ($1,$2,$3)',[groupId,['owner@example.com','guest@example.com'],JSON.stringify(document())]);});
afterAll(async()=>db.close());
it('atomically creates one job per joined participant and reapplying the document makes no duplicates',async()=>{
 expect(await rows()).toHaveLength(2);await save(document());expect(await rows()).toHaveLength(2);expect((await rows())[0].payload).toMatchObject({summary:'Coffee · Coffee together',start:{dateTime:'2027-01-17T17:00:00Z',timeZone:'America/Los_Angeles'}});
});
it('only grants queue reads and worker execution to the service role',async()=>{
 const {rows:r}=await db.query<{read:boolean;worker:boolean}>("select has_table_privilege('authenticated','calendar_event_jobs','select') as read, has_function_privilege('anon','claim_calendar_jobs(uuid,boolean)','execute') as worker");expect(r[0]).toEqual({read:false,worker:false});
});
it('leases each job exclusively and a crashed worker can be reclaimed',async()=>{
 const first=await claim();expect(first).toHaveLength(2);expect(await claim(true)).toHaveLength(0);
 await db.exec("update calendar_event_jobs set lease_until=now()-interval '1 minute'");const second=await claim();expect(second).toHaveLength(2);expect(second[0].lease_token).not.toBe(first[0].lease_token);
 await db.query('select finish_calendar_job($1,$2,$3,$4)',[first[0].event_id,first[0].lease_token,true,null]);expect((await rows())[0].status).toBe('pending');
});
it('cancellation during creation preserves pending deletion when the old worker finishes',async()=>{
 const [job]=await claim();await save({...document(),status:'cancelled'});
 await db.query('select finish_calendar_job($1,$2,$3,$4)',[job.event_id,job.lease_token,true,null]);
 const row=(await rows()).find(r=>r.event_id===job.event_id)!;expect(row.desired).toBe(false);expect(row.status).toBe('pending');
 const deletion=(await claim()).find(r=>r.event_id===job.event_id)!;expect(deletion.desired).toBe(false);
 await db.query('select finish_calendar_job($1,$2,$3,$4)',[deletion.event_id,deletion.lease_token,false,null]);expect((await rows()).find(r=>r.event_id===job.event_id)!.status).toBe('synced');
});
it('reconfirmation uses fresh IDs and keeps removal jobs for the previous copies',async()=>{
 const old=(await rows()).map(r=>r.event_id);await save({...document(),status:'planning'});await save({...document(),calendarRevision:'confirmation-two'});
 const all=await rows();expect(all).toHaveLength(4);expect(all.filter(j=>j.desired)).toHaveLength(2);expect(all.filter(j=>j.desired).every(j=>!old.includes(j.event_id))).toBe(true);
});
it('failed jobs back off, while explicit retry can claim them',async()=>{
 const jobs=await claim();for(const job of jobs)await db.query('select finish_calendar_job($1,$2,$3,$4)',[job.event_id,job.lease_token,true,'reconnect']);
 expect(await claim()).toHaveLength(0);expect(await claim(true)).toHaveLength(2);
});
it('a rolled-back plan update cannot leave calendar work behind',async()=>{
 await db.exec('begin');await save({...document(),status:'cancelled'});await db.exec('rollback');expect((await rows()).every(j=>j.desired)).toBe(true);
});

it('removing one confirmed participant queues only their event deletion and an atomic reason notification',async()=>{
 const changed={...document(),members:[{userId:owner,consent:true}],attendanceRequests:[{id:'00000000-0000-4000-8000-000000000009',userId:guest,status:'removed',reason:'Work conflict',responseReason:'We will catch up next time'}]};
 await save(changed);const jobs=await rows();expect(jobs.filter(j=>j.desired)).toHaveLength(1);expect(jobs.filter(j=>!j.desired)).toHaveLength(1);
 const notices=await db.query<{user_id:string;reason:string}>('select user_id,reason from hangout_notifications');expect(notices.rows).toEqual([{user_id:guest,reason:'We will catch up next time'}]);
 await save(changed);expect((await db.query('select * from hangout_notifications')).rows).toHaveLength(1);
 const access=await db.query<{allowed:boolean}>("select has_table_privilege('authenticated','hangout_notifications','select') as allowed");expect(access.rows[0].allowed).toBe(false);
});
