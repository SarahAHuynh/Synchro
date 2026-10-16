'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Copy, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/client-api';
import { readInvitation, clearInvitation, type PendingInvitation } from '@/lib/pending-invitation';
import type { GroupSummary, GroupView } from '@/lib/groups';
import type { UserPreferences } from '@/lib/types';
import { defaultPreferences } from '@/lib/mock-data';
import { copyPreferences } from '@/lib/validation';
import { Button, Card, Field, formatDate } from './ui';
import PreferenceForm from './preference-form';
import GuestEmails from './guest-emails';
import GroupCard from './group-card';
import { AttendanceControls, AttendanceReview } from './attendance-controls';
import PlanningFlow from './planning-flow';
import CancelHangoutDialog from './cancel-hangout-dialog';
type Account={id:string;email:string;preferences:UserPreferences|null;calendarConnected:boolean};
type Invitation={invitation:true;id:string;name:string;description:string;start:string;end:string;timeZone:string;min:number;max:number;status:string;invitedEmail:string;organizerName:string;cancellationReason?:string};
const date=(offset=0)=>{const d=new Date(Date.now()+offset*86400000);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export default function GroupWorkspace({user,initialCreate=false}:{user:Account;initialCreate?:boolean}) {
  const router=useRouter();
  const [groups,setGroups]=useState<GroupSummary[]>([]);const [selected,setSelected]=useState('');const [detail,setDetail]=useState<GroupView|Invitation|null>(null);
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [name,setName]=useState('');const [description,setDescription]=useState('');const [emails,setEmails]=useState<string[]>([]);const [emailDraft,setEmailDraft]=useState('');
  const [start,setStart]=useState(date());const [end,setEnd]=useState(date(6));const [min,setMin]=useState(60);const [max,setMax]=useState(120);const [zone,setZone]=useState('UTC');
  const [editing,setEditing]=useState(false);const [settings,setSettings]=useState(false);
  const [preferences,setPreferences]=useState(copyPreferences(user.preferences??defaultPreferences));const [extraEmails,setExtraEmails]=useState<string[]>([]);
  const [copied,setCopied]=useState('');const [copyFailed,setCopyFailed]=useState(false);
  const [cancelOpen,setCancelOpen]=useState(false);
  const pending=useRef<PendingInvitation|null>(null);const selectedRef=useRef('');const readVersion=useRef(0);const inFlight=useRef(false);const headingRef=useRef<HTMLElement>(null);
  const reload=useCallback(async()=>{
    const version=++readVersion.current;
    const result=await api<{groups:GroupSummary[]}>('/api/hangouts');if(version!==readVersion.current)return;setGroups(result.groups);
    const id=selectedRef.current;
    if(id){const token=pending.current?.id===id?pending.current.token:'';const next=await api<GroupView|Invitation>(`/api/hangouts/${id}`,'GET',undefined,token?{'x-synchro-invite':token}:undefined);if(id===selectedRef.current&&version===readVersion.current){setDetail(next);if(!next.invitation){clearInvitation(id);pending.current=null;}}}
  },[]);
  useEffect(()=>{
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);pending.current=readInvitation();
    const id=!initialCreate?(new URLSearchParams(window.location.search).get('hangout')??pending.current?.id):null;
    if(id){selectedRef.current=id;setSelected(id);}
    reload().catch(error=>setError(error.message)).finally(()=>setLoading(false));
    const timer=setInterval(()=>{if(!document.hidden&&!inFlight.current)void reload().catch(error=>setError(error.message));},15000);
    return()=>clearInterval(timer);
  },[reload,initialCreate]);
  useEffect(()=>{headingRef.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});},[selected,editing,settings]);
  async function perform(task:()=>Promise<void>){if(inFlight.current)return false;inFlight.current=true;readVersion.current++;setBusy(true);setError('');setMessage('');try{await task();return true;}catch(error){setError(error instanceof Error?error.message:'Please try again.');return false;}finally{inFlight.current=false;setBusy(false);}}
  function choose(id:string){selectedRef.current=id;setSelected(id);setDetail(null);setEditing(false);setSettings(false);setCopied('');window.history.replaceState({},'',`/account/hangouts${id?'?hangout='+id:''}`);}
  async function action(body:Record<string,unknown>,success='Saved.'){
    const token=pending.current?.id===selected?pending.current.token:undefined;
    await api(`/api/hangouts/${selected}`,'POST',{...body,inviteToken:token});
    if(body.action==='join'||body.action==='leave'){clearInvitation(selected);pending.current=null;}
    if(body.action==='leave')choose('');
    setEditing(false);await reload();setMessage(success);window.dispatchEvent(new Event('synchro:hangouts-updated'));
  }
  const view=detail&&!detail.invitation?detail as GroupView:null;const invite=detail?.invitation?detail as Invitation:null;
  function openPreferences(){setPreferences(copyPreferences(view?.myPreferences??user.preferences??defaultPreferences));setEditing(true);setSettings(false);setError('');setMessage('');}
  function openSettings(){if(!view)return;setStart(view.start);setEnd(view.end);setMin(view.min);setMax(view.max);setSettings(true);setEditing(false);setError('');setMessage('');}
  const consentField=<p className="availability-notice">Continuing shares your free/busy availability and allows confirmed hangouts to be added to your Google Calendar.</p>;
  const dateFields=<div className="group-fields"><Field label="Start date" name="group-start" type="date" min={date()} value={start} onChange={event=>setStart(event.target.value)} required/><Field label="End date" name="group-end" type="date" min={start} value={end} onChange={event=>setEnd(event.target.value)} required/><Field label="Minimum (minutes)" name="group-min" type="number" min={30} max={480} value={min} onChange={event=>setMin(Number(event.target.value))} required/><Field label="Maximum (minutes)" name="group-max" type="number" min={min} max={480} value={max} onChange={event=>setMax(Number(event.target.value))} required/></div>;
  const notice=<>{error&&<p className="live-error" role="alert">{error}</p>}{message&&<p className="live-message" role="status">{message}</p>}</>;
  const needsSetup=!user.preferences||!user.calendarConnected;
  const setup=<Card className="setup-steps"><h3>{initialCreate?'Before you plan':'Before you accept'}</h3><p>Set your preferences and connect Google Calendar so Synchro can find a time for everyone.</p><div className="row">{!user.preferences&&<Link className="button secondary" href="/account/preferences">Set up preferences <ArrowRight size={16}/></Link>}{!user.calendarConnected&&<Link className="button primary" href="/account/calendar">Connect Google Calendar <ArrowRight size={16}/></Link>}</div></Card>;
  return <section ref={headingRef} tabIndex={-1} className="group-workspace" aria-label="Your group hangouts">
    {editing?<><Button variant="ghost" disabled={busy} onClick={()=>setEditing(false)}><ArrowLeft size={16}/> Back to hangout</Button>{notice}{consentField}<PreferenceForm busy={busy} hangoutOnly value={preferences} onChange={setPreferences} onBack={()=>setEditing(false)} onSave={()=>{void perform(()=>action({action:invite?'join':'preferences',preferences:{...preferences,dislikedActivities:preferences.dislikedActivities.map(item=>item.trim()).filter(Boolean)},consent:true},invite?'You’re in.':'Hangout preferences saved.'));}}/></>:
    initialCreate?<div className="form-page"><div className="page-heading"><h1>Plan a hangout</h1></div>{notice}{needsSetup?setup:<Card className="form-card"><form onSubmit={event=>{event.preventDefault();if(emailDraft.trim()){setError('Press Add to include the guest email, or clear it.');return;}void perform(async()=>{const result=await api<{id:string}>('/api/hangouts','POST',{name,description,emails,start,end,min,max,timeZone:zone,consent:true});router.push(`/account/hangouts?hangout=${result.id}`);});}}><fieldset disabled={busy}><Field label="What shall we call it?" name="group-name" placeholder="Sunday with the usual crew" maxLength={100} value={name} onChange={event=>setName(event.target.value)} required/><fieldset><legend>Who’s coming?</legend><p className="muted small">Share an invite link after creating. Add emails now if you like.</p><GuestEmails emails={emails} onChange={setEmails} onPendingChange={setEmailDraft} ownEmail={user.email}/></fieldset><fieldset><legend>When could it happen?</legend>{dateFields}</fieldset><details className="optional-details"><summary>Add a note</summary><Field label="Note" name="group-description" maxLength={1000} value={description} onChange={event=>setDescription(event.target.value)}/></details><p className="small muted">{zone.replaceAll('_',' ')} · Up to 14 days</p>{consentField}<div className="form-actions"><Link className="button ghost" href="/account">Back</Link><Button disabled={busy}>Create hangout <ArrowRight size={17}/></Button></div></fieldset></form></Card>}</div>:
    <>{!selected?<><div className="dashboard-heading"><div><h1>Your hangouts.</h1></div>{groups.length>0&&<Link className="button primary" href="/account/plan"><Plus size={17}/> Plan a hangout</Link>}</div>{notice}{loading?<p role="status">Loading hangouts…</p>:groups.length?<div className="hangout-list">{groups.map(group=><GroupCard key={group.id} group={group} userId={user.id} onCancelled={()=>void reload().catch(error=>setError(error.message))} onDismissed={()=>setGroups(current=>current.filter(item=>item.id!==group.id))} onOpen={()=>void perform(async()=>{choose(group.id);await reload();})}/>)}</div>:<Card className="empty-hangouts"><span className="icon-tile"><CalendarDays size={30}/></span><h2>No hangouts yet</h2><Link className="button primary" href="/account/plan">Plan a hangout <ArrowRight size={16}/></Link></Card>}</>:
    <><div className="planning-topline"><Button variant="ghost" onClick={()=>{if(settings){setSettings(false);return;}clearInvitation(selected);pending.current=null;choose('');}}><ArrowLeft size={17}/>{settings?'Back to hangout':'All hangouts'}</Button><Button variant="ghost" disabled={busy} onClick={()=>void perform(async()=>{await reload();setMessage('Up to date.');})} aria-label="Refresh hangout"><RefreshCw size={17}/></Button></div>{notice}
      {!detail?<p role="status">{loading?'Opening your hangout…':'Refresh to try again.'}</p>:<>
        <div className="page-heading"><span className="eyebrow">{settings?'THE DETAILS':invite?'YOU’RE INVITED':''}</span><h1>{invite?<>You’re invited to<br/>{detail.name}</>:detail.name}</h1>{detail.description&&<p>{detail.description}</p>}</div>
        {view?.calendarSync&&view.status!=='confirmed'&&(view.calendarSync.removing>0||view.calendarSync.failed>0)&&<Card className="setup-steps"><p>{view.calendarSync.needsReconnect?'Reconnect Google Calendar to finish syncing.':'Some calendar updates still need to sync.'}</p>{view.calendarSync.needsReconnect&&<Link className="button secondary" href="/account/calendar">Reconnect Google Calendar</Link>}<Button disabled={busy} onClick={()=>void perform(()=>action({action:'sync-calendar'},'Calendar sync checked.'))}>Retry calendar sync</Button></Card>}{detail.status==='cancelled'?<Card className="planning-card"><h2>This hangout was cancelled.</h2>{detail.cancellationReason&&<p>Reason: {detail.cancellationReason}</p>}<Link href="/account/plan" className="button secondary">Make a new plan</Link></Card>:invite?<Card className="form-card"><div className="organizer-identity"><span className="avatar large-avatar">{invite.organizerName[0]}</span><div><span className="muted">Your organizer</span><h2>{invite.organizerName} invited you.</h2></div></div><div className="invite-date-summary"><CalendarDays size={25}/><div><strong>{formatDate(invite.start)} – {formatDate(invite.end)}</strong><span>{invite.min}–{invite.max} minutes · {invite.timeZone.replaceAll('_',' ')}</span></div></div>{invite.status==='confirmed'?<p>This plan is confirmed. Ask the organizer to reopen it to join.</p>:needsSetup?setup:<>{consentField}<div className="choice-stack"><Button disabled={busy} onClick={()=>void perform(()=>action({action:'join',useSaved:true,consent:true},'You’re in.'))}>Accept invitation <ArrowRight size={17}/></Button><Button disabled={busy} variant="secondary" onClick={openPreferences}>Customize and join</Button></div></>}<Button variant="ghost" onClick={()=>{clearInvitation(selected);pending.current=null;choose('');}}>Not now</Button></Card>:view&&<>
          {view.isOrganizer&&!settings&&view.status==='planning'&&<div className="invite-strip"><div><small>Anyone with this link can join · 10 people max</small></div><div className="copy-invite"><Button variant="primary" className="copy-invitation-button" disabled={busy} onClick={async()=>{try{await navigator.clipboard.writeText(view.inviteUrl);setCopied('Link copied');setCopyFailed(false);}catch{setCopied('Copy the link below');setCopyFailed(true);}}}><Copy size={16}/> Copy invitation link</Button><span role="status" aria-live="polite" className="copy-feedback">{copied&&<><Check size={15}/>{copied}</>}</span></div>{copyFailed&&<Field label="Invitation link" name="copy-link" value={view.inviteUrl} readOnly onFocus={event=>event.target.select()}/>}</div>}
          {settings?<Card className="form-card"><h2>Who’s coming?</h2><ul className="member-settings">{view.members.map(member=><li key={member.email}><span><strong>{member.name}{member.isYou?' (you)':''}{member.isOrganizer?' · Organizer':''}</strong><small>{member.email}</small></span>{view.isOrganizer&&!member.isYou&&<Button variant="ghost" disabled={busy} onClick={()=>{const reason=window.prompt('Why are you removing this guest? The plan stays if at least two people remain.');if(reason?.trim())void perform(()=>action({action:'remove',email:member.email,reason},'Guest removed. Copy the new invite link to share.'));}}>Remove</Button>}</li>)}</ul>{view.isOrganizer?<>
            <GuestEmails label="Add a guest" emails={extraEmails} onChange={setExtraEmails} ownEmail={user.email} limit={10-view.members.length} disabled={busy}/>{extraEmails.length>0&&<Button disabled={busy} onClick={()=>void perform(async()=>{await action({action:'invite',emails:extraEmails},'Guests added.');setExtraEmails([]);})}>Save guests</Button>}
            <hr/><h2>Dates & duration</h2><form onSubmit={event=>{event.preventDefault();void perform(()=>action({action:'dates',start,end,min,max},'Dates updated. Everyone needs to confirm the new dates.'));}}>{dateFields}<p className="small muted">Changing dates clears votes and asks everyone to confirm availability again.</p><Button disabled={busy}>Change dates</Button></form><hr/><div className="group-management"><Button variant="secondary" disabled={busy} onClick={()=>{if(window.confirm('Replace this invitation link? The old link will stop working for new guests.'))void perform(async()=>{await action({action:'renew-link'},'Invite link replaced.');setCopied('');});}}>Replace invite link</Button>{view.status!=='planning'&&<Button variant="secondary" disabled={busy} onClick={()=>{if(window.confirm('Clear the selected time and votes?'))void perform(()=>action({action:'reset'},'Plan reopened.'));}}>Reopen planning</Button>}<Button variant="ghost" disabled={busy} onClick={()=>setCancelOpen(true)}>Cancel hangout</Button></div>
          </>:null}</Card>:<>
            {view.members.some(member=>member.isYou&&!member.ready)&&<Card className="setup-steps"><h3>The dates changed.</h3>{consentField}<Button disabled={busy} onClick={()=>void perform(()=>action({action:'preferences',preferences:view.myPreferences,consent:true},'Availability confirmed.'))}>Confirm availability</Button></Card>}
            <>{view.isOrganizer&&<AttendanceReview group={view} busy={busy} error={error} onAction={body=>perform(()=>action(body,'Attendance request updated.'))}/>}<PlanningFlow attendanceControl={!view.isOrganizer?<AttendanceControls group={view} busy={busy} error={error} onAction={body=>perform(()=>action(body,'Your request was sent to the organizer.'))}/>:undefined} group={view} busy={busy} onAction={(body,message)=>void perform(()=>action(body,message))} onPreferences={openPreferences} onSettings={openSettings}/></>
          </>}
        </>}
      </>}
    </>}
    </>}
    {view&&<CancelHangoutDialog open={cancelOpen} hangoutName={view.name} busy={busy} onClose={()=>setCancelOpen(false)} onCancel={async reason=>{const saved=await perform(()=>action({action:'cancel',reason},'Hangout cancelled.'));if(saved)setCancelOpen(false);}}/>}
  </section>;
}
