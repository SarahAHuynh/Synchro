import { expect, type Page, type Route } from '@playwright/test';
import { defaultPreferences } from '../../lib/mock-data';
import { groupView, groupAttention, resetPlan, type GroupPlan } from '../../lib/groups';
import type { UserPreferences } from '../../lib/types';
import { activityCatalog } from '../../lib/activity-catalog';
export const groupId='00000000-0000-4000-8000-000000000001';
export const inviteToken='c'.repeat(64);
export type Actor={id:string;name:string;email:string;signedIn:boolean;preferences:UserPreferences|null;calendarConnected:boolean};
export const owner=():Actor=>({id:'owner',name:'Jamie',email:'jamie@example.com',signedIn:true,preferences:structuredClone(defaultPreferences),calendarConnected:true});
export const guest=():Actor=>({id:'guest',name:'Alex',email:'alex@example.com',signedIn:true,preferences:structuredClone(defaultPreferences),calendarConnected:true});
export type Store={group:GroupPlan|null;profileAttempts?:number;failProfileOnce?:boolean;failCalendar?:boolean;noSlots?:boolean;calendarSyncFailure?:boolean;signupConfirmation?:boolean;notifications?:{userId:string;id:string;title:string;reason:string}[]};
export function makeGroup():GroupPlan{return {id:groupId,organizerId:'owner',name:'Sunday together',description:'',start:'2027-01-17',end:'2027-01-17',timeZone:'America/Los_Angeles',min:60,max:120,members:[{email:'jamie@example.com',userId:'owner',name:'Jamie',preferences:structuredClone(defaultPreferences),consent:true}],status:'planning',windows:[],checkedAt:null,selected:null,activities:[],votes:{},confirmedActivityId:null,createdAt:new Date().toISOString()};}
const respond=(route:Route,json:unknown,status=200)=>route.fulfill({json,status});
export async function installApp(page:Page,actor:Actor,store:Store){
  await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{(window as Window&{copied?:string}).copied=value;}}});});
  await page.route('**/api/**',async route=>{
    const req=route.request();const path=new URL(req.url()).pathname;const body=req.method()==='GET'?{}:req.postDataJSON()??{};
    if(path==='/api/auth'){
      if(req.method()==='GET')return respond(route,{configured:true,calendarConfigured:true,user:actor.signedIn?actor:null});
      if(body.action==='signout')actor.signedIn=false;
      if(body.action==='resend')return respond(route,{message:'If this account needs verification, a new link has been requested.'});
      if(body.action==='signup'&&store.signupConfirmation)return respond(route,{signedIn:false,confirmationRequired:true,message:'Check your email to confirm your account.'});
      if(['signin','signup','google'].includes(body.action)){actor.signedIn=true;if(body.name)actor.name=body.name;}
      return respond(route,body.action==='google'?{url:'/account?resume=1'}:{ok:true,signedIn:actor.signedIn});
    }
    if(path==='/api/hangout-notifications')return respond(route,{notifications:(store.notifications??[]).filter(n=>n.userId===actor.id)});
    if(path==='/api/profile'){
      store.profileAttempts=(store.profileAttempts??0)+1;
      if(store.failProfileOnce&&store.profileAttempts===1)return route.abort('failed');
      actor.preferences=body.preferences;actor.name=body.name;return respond(route,{ok:true});
    }
    if(path==='/api/calendar/connect'){actor.calendarConnected=true;return respond(route,{url:'/account?calendar=connected'});}
    if(path==='/api/calendar/disconnect'){actor.calendarConnected=false;return respond(route,{message:'Calendar disconnected.'});}
    if(path==='/api/calendar/availability')return store.failCalendar?respond(route,{error:'Please reconnect your calendar.'},409):respond(route,{windows:[{start:'2027-01-17T17:00:00Z',end:'2027-01-17T18:00:00Z'}],checkedAt:new Date().toISOString()});
    if(path==='/api/hangouts'){
      if(req.method()==='POST'){expect(body.consent).toBe(true);store.group={...makeGroup(),name:body.name,start:body.start,end:body.end,timeZone:body.timeZone,min:body.min,max:body.max,members:[makeGroup().members[0],...body.emails.map((email:string)=>({email,userId:null,name:email.split('@')[0],preferences:null,consent:false}))]};return respond(route,{id:groupId},201);}
      const g=store.group;return respond(route,{groups:g&&g.members.some(m=>m.email===actor.email)?[{attention:groupAttention(g,actor.id),cancellationReason:g.cancellationReason,isOrganizer:g.organizerId===actor.id,id:g.id,name:g.name,start:g.start,end:g.end,status:g.status,count:g.members.length,invitation:!g.members.some(m=>m.userId===actor.id),selected:g.selected,timeZone:g.timeZone}]:[]});
    }
    if(path===`/api/hangouts/${groupId}`){
      const g=store.group;if(!g)return respond(route,{error:'Not found'},404);
      let m=g.members.find(m=>m.email===actor.email);
      if(!m&&req.headers()['x-synchro-invite']!==inviteToken&&body.inviteToken!==inviteToken)return respond(route,{error:'Ask for an invitation link.'},404);
      if(req.method()==='GET'){
        if(!m?.userId)return respond(route,{invitation:true,id:g.id,name:g.name,description:g.description,start:g.start,end:g.end,timeZone:g.timeZone,min:g.min,max:g.max,status:g.status,invitedEmail:actor.email,organizerName:'Jamie'});
        return respond(route,{...groupView(g,actor.id,'http://localhost:3100',inviteToken),calendarSync:{scheduled:g.status==='confirmed'&&!store.calendarSyncFailure?g.members.length:0,pending:0,failed:store.calendarSyncFailure?1:0,removing:0,needsReconnect:!!store.calendarSyncFailure}});
      }
      if(body.action==='join'||body.action==='preferences'){
        expect(body.consent).toBe(true);
        if(!m){m={email:actor.email,userId:null,name:actor.name,preferences:null,consent:false};g.members.push(m);}
        m.userId=actor.id;m.name=actor.name;m.preferences=body.useSaved?actor.preferences:body.preferences;m.consent=true;resetPlan(g);
      }
      if(body.action==='find'){resetPlan(g);g.checkedAt=new Date().toISOString();g.windows=store.noSlots?[]:[{start:'2027-01-17T17:00:00Z',end:'2027-01-17T18:00:00Z'}];}
      if(body.action==='select'){g.selected=g.windows[0];g.status='voting';g.activities=activityCatalog.slice(0,2).map(a=>({...a,score:1,matchReason:'Fits your group.'}));}
      if(body.action==='vote')g.votes[actor.id]=body.activityId;
      if(body.action==='confirm'){g.status='confirmed';g.calendarRevision='test-confirmation';g.confirmedActivityId=body.activityId;}
      if(body.action==='sync-calendar')store.calendarSyncFailure=false;
      if(body.action==='reset')resetPlan(g);
      if(body.action==='dates'){g.start=body.start;g.end=body.end;g.min=body.min;g.max=body.max;resetPlan(g);g.members.forEach(m=>m.consent=false);}
      if(body.action==='cancel'){expect(body.reason?.trim()).toBeTruthy();g.status='cancelled';g.cancellationReason=body.reason;}
      if(body.action==='request-attendance'){g.attendanceRequests=[...(g.attendanceRequests??[]).filter(r=>r.userId!==actor.id),{id:'test-request-'+actor.id,userId:actor.id,name:actor.name,kind:body.kind,reason:body.reason,status:'pending',createdAt:new Date().toISOString()}];}
      if(body.action==='resolve-attendance'){const request=g.attendanceRequests!.find(r=>r.id===body.requestId)!;request.responseReason=body.reason;if(body.decision==='reschedule'){request.status='rescheduling';resetPlan(g);}else if(body.decision==='remove'){request.status='removed';g.members=g.members.filter(m=>m.userId!==request.userId);delete g.votes[request.userId];if(g.members.length<2)resetPlan(g);store.notifications=[...(store.notifications??[]),{id:request.id,userId:request.userId,title:`You are no longer attending ${g.name}`,reason:body.reason}];}else request.status='declined';}

      return respond(route,{ok:true});
    }
    return respond(route,{error:'Unhandled test request'},404);
  });
}
export async function nav(page:Page,label:string){const button=page.getByRole('button',{name:'Open navigation'});if(await button.isVisible())await button.click();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:label,exact:true}).click();}
export async function savePreferences(page:Page){await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Save preferences'}).click();}
