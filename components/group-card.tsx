'use client';
import { useEffect, useRef, useState } from 'react';
import type { GroupSummary } from '@/lib/groups';
import { api } from '@/lib/client-api';
import { Button, HangoutCard } from './ui';
export default function GroupCard({group,onOpen,onCancelled,onDismissed,userId}:{group:GroupSummary;onOpen:()=>void;onCancelled?:()=>void;onDismissed?:()=>void;userId:string}) {
  const dismissalKey=`synchro:dismissed-cancelled-cards:${userId}`;
  const [confirming,setConfirming]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState(''),[dismissed,setDismissed]=useState(()=>{
    if(group.status!=='cancelled'||typeof window==='undefined')return false;
    try { const saved=JSON.parse(localStorage.getItem(dismissalKey)??'[]'); return Array.isArray(saved)&&saved.includes(group.id); } catch { return false; }
  });
  const dialog=useRef<HTMLDialogElement>(null),dismissalNotified=useRef(false);
  useEffect(()=>{if(confirming)dialog.current?.showModal();else dialog.current?.close();},[confirming]);
  useEffect(()=>{if(dismissed&&!dismissalNotified.current){dismissalNotified.current=true;onDismissed?.();}},[dismissed,onDismissed]);
  const label = group.selected ? new Date(group.selected.start).toLocaleString(undefined,{timeZone:group.timeZone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : undefined;
  async function cancel(){if(busy)return;setBusy(true);setError('');try{await api(`/api/hangouts/${group.id}`,'POST',{action:'cancel',reason});setConfirming(false);onCancelled?.();window.dispatchEvent(new Event('synchro:hangouts-updated'));}catch(error){setError(error instanceof Error?error.message:'Could not cancel. Try again.');}finally{setBusy(false);}}
  function dismiss(){
    setDismissed(true);
    try { const saved=JSON.parse(localStorage.getItem(dismissalKey)??'[]'); localStorage.setItem(dismissalKey,JSON.stringify([...new Set([...(Array.isArray(saved)?saved:[]),group.id])])); } catch {}
  }
  if(dismissed)return null;
  return <><div className="group-card-wrap">{group.attention&&<div className="attention-card-label">Action needed: {group.attention}</div>}{group.status==='cancelled'&&<button type="button" className="cancelled-card-dismiss" aria-label={`Remove ${group.name} from this list`} onClick={dismiss}>×</button>}<HangoutCard cancelling={busy} onCancel={group.isOrganizer&&group.status!=='cancelled'?()=>{setError('');setReason('');setConfirming(true);}:undefined} statusLabel={group.status==='cancelled'?'Cancelled':group.invitation?'You’re invited':undefined} invited={group.invitation} timeLabel={label} onOpen={onOpen} hangout={{id:group.id,name:group.name,organizerId:'',participantIds:Array.from({length:group.count},(_,i)=>String(i+1)),dateRangeStart:group.start,dateRangeEnd:group.end??group.start,minDurationMinutes:group.min??60,maxDurationMinutes:group.max??120,status:group.status==='confirmed'?'confirmed':group.status==='voting'?'voting':'awaiting-preferences',confirmedActivityId:group.confirmedActivityId??undefined}}/></div>
    <dialog ref={dialog} className="cancel-hangout-dialog" aria-labelledby={`cancel-title-${group.id}`} aria-describedby={`cancel-description-${group.id}`} onCancel={event=>{event.preventDefault();if(!busy)setConfirming(false);}}><h2 id={`cancel-title-${group.id}`}>Cancel {group.name}?</h2><p id={`cancel-description-${group.id}`}>This cancels the hangout for everyone. All participants will see a cancellation notice in Synchro. Any Synchro-created calendar events will be queued for removal.</p><div className="field"><label htmlFor={`cancel-reason-${group.id}`}>Reason for cancelling</label><textarea id={`cancel-reason-${group.id}`} required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></div>{error&&<p role="alert" className="live-error">{error}</p>}<div className="dialog-actions"><Button variant="secondary" disabled={busy} autoFocus onClick={()=>setConfirming(false)}>Keep hangout</Button><Button className="danger-button" disabled={busy||!reason.trim()} onClick={()=>void cancel()}>{busy?'Cancelling…':'Cancel for everyone'}</Button></div></dialog>
  </>;
}
