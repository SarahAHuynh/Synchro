import 'server-only';
import { calendarAccessToken } from './calendar';
import { adminClient } from './supabase';
import { ApiError } from './http';
export type CalendarJob = { event_id:string; group_id:string; user_id:string; payload:Record<string,unknown>; desired:boolean; lease_token:string };
export type CalendarSync = { scheduled:number; pending:number; failed:number; removing:number; needsReconnect:boolean; unavailable?:boolean };
const endpoint='https://www.googleapis.com/calendar/v3/calendars/primary/events';
export async function applyCalendarJob(job:CalendarJob) {
  const token=await calendarAccessToken(job.user_id,true);
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const request=(url:string,init:RequestInit)=>fetch(url,{...init,headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!job.desired){
    const result=await request(`${endpoint}/${job.event_id}?sendUpdates=none`,{method:'DELETE'});
    if(result.ok||[404,410].includes(result.status))return;
    throw new ApiError('Calendar removal needs a retry.',[401,403].includes(result.status)?409:503);
  }
  const result=await request(`${endpoint}?sendUpdates=none`,{method:'POST',body:JSON.stringify({...job.payload,id:job.event_id})});
  if(result.ok)return;
  if(result.status===409){
    // A timeout may have hidden a successful insert. Verify our event before treating it as done.
    const existing=await request(`${endpoint}/${job.event_id}`,{method:'GET'});
    if(existing.ok){const data=await existing.json();if(data.status!=='cancelled'&&data.extendedProperties?.private?.synchroGroup===job.group_id)return;}
  }
  throw new ApiError('Calendar creation needs a retry.',[401,403].includes(result.status)?409:503);
}
export async function requireEventQueue() {
  const {error}=await adminClient().from('calendar_event_jobs').select('event_id').limit(0);
  if(error)throw new ApiError('Run the calendar events migration in Supabase before scheduling this plan.',503);
}
export async function processCalendarJobs(groupId?:string,force=false) {
  const db=adminClient();
  const {data,error}=await db.rpc('claim_calendar_jobs',{p_group:groupId??null,p_force:force});
  if(error)throw new ApiError('Calendar sync is unavailable. Check the calendar events migration.',503);
  await Promise.all((data as CalendarJob[]??[]).map(async job=>{
    let failure:string|null=null;
    try{await applyCalendarJob(job);}catch(error){failure=error instanceof ApiError&&error.status===409?'reconnect':'retry';}
    const {error}=await db.rpc('finish_calendar_job',{p_event:job.event_id,p_lease:job.lease_token,p_desired:job.desired,p_error:failure});
    if(error)throw new ApiError('Calendar sync will retry. Its progress could not be saved.',503);
  }));
  return {processed:data?.length??0};
}
export async function calendarSyncStatus(groupId:string,userId:string):Promise<CalendarSync> {
  const {data,error}=await adminClient().from('calendar_event_jobs').select('user_id,desired,status,error_kind').eq('group_id',groupId);
  if(error)return {scheduled:0,pending:0,failed:0,removing:0,needsReconnect:false,unavailable:true};
  return {scheduled:data.filter(j=>j.desired&&j.status==='synced').length,pending:data.filter(j=>j.desired&&j.status==='pending').length,failed:data.filter(j=>j.status==='failed').length,removing:data.filter(j=>!j.desired&&j.status!=='synced').length,needsReconnect:data.some(j=>j.user_id===userId&&j.error_kind==='reconnect')};
}
