'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { api } from '@/lib/client-api';
import type { GroupSummary } from '@/lib/groups';
type Notice={id:string;title:string;reason:string;href?:string;kind:'cancelled'|'attention'|'info';name?:string};
export default function CancellationNotices({userId}:{userId:string}) {
 const [notices,setNotices]=useState<Notice[]>([]);const storageKey=`synchro:seen-cancellations:${userId}`;
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{
   const [groupsResult,notificationsResult]=await Promise.allSettled([api<{groups:GroupSummary[]}>('/api/hangouts'),api<{notifications:{id:string;title:string;reason:string}[]}>('/api/hangout-notifications')]);
   if(!active||groupsResult.status!=='fulfilled')return;
   const next:Notice[]=groupsResult.value.groups.flatMap<Notice>(group=>group.status==='cancelled'&&!group.isOrganizer?[{id:group.id,title:`${group.name} was cancelled.`,reason:group.cancellationReason?`Reason: ${group.cancellationReason}`:'The organizer cancelled this hangout for everyone.',href:`/account/hangouts?hangout=${group.id}`,kind:'cancelled' as const,name:group.name}]:group.attention?[{id:`${group.id}:${group.attentionKey??group.attention}`,title:`${group.name}: ${group.attention}`,reason:'This hangout needs your attention.',href:`/account/hangouts?hangout=${group.id}`,kind:'attention' as const,name:group.name}]:[]);
   if(notificationsResult.status==='fulfilled')next.push(...notificationsResult.value.notifications.map(n=>({...n,kind:'info' as const})));
   let dismissed:string[]=[];try{const value=JSON.parse(localStorage.getItem(storageKey)??'[]');if(Array.isArray(value))dismissed=value;}catch{}
   setNotices(next.filter(notice=>!dismissed.includes(notice.id)));
  };
  void refresh();const tick=setInterval(()=>{if(!document.hidden)void refresh();},15000);const onRefresh=()=>void refresh();window.addEventListener('focus',onRefresh);window.addEventListener('synchro:hangouts-updated',onRefresh);
  return()=>{active=false;clearInterval(tick);window.removeEventListener('focus',onRefresh);window.removeEventListener('synchro:hangouts-updated',onRefresh);};
 },[storageKey]);
 function dismiss(id:string){setNotices(current=>current.filter(n=>n.id!==id));try{const saved=JSON.parse(localStorage.getItem(storageKey)??'[]');localStorage.setItem(storageKey,JSON.stringify([...new Set([...(Array.isArray(saved)?saved:[]),id])]));}catch{}}
 return notices.length?<section className="cancellation-notices" aria-label="Hangout notifications" aria-live="polite">{notices.map(notice=><div className={`cancellation-notice notice-${notice.kind}`} key={notice.id}><Bell size={21}/><span><strong>{notice.title}</strong><span>{notice.reason}</span></span>{notice.href&&<Link className={`text-button ${notice.kind==='attention'?'attention-notice-view':''}`} href={notice.href}>View</Link>}<button className="icon-button notice-dismiss" aria-label={notice.kind==='cancelled'?`Dismiss cancellation for ${notice.name}`:`Dismiss notification: ${notice.title}`} onClick={()=>dismiss(notice.id)}><X size={19}/></button></div>)}</section>:null;
}
