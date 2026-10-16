'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, Heart, Settings2 } from 'lucide-react';
import type { UserPreferences } from '@/lib/types';
import type { GroupSummary } from '@/lib/groups';
import { api } from '@/lib/client-api';
import { Card, PreferenceSummary } from './ui';
import GroupCard from './group-card';
export default function AccountHome({user}:{user:{name:string;calendarConnected:boolean;preferences:UserPreferences|null}}) {
  const [groups,setGroups]=useState<GroupSummary[]|null>(null); const [error,setError]=useState(''); const router=useRouter();
  useEffect(()=>{api<{groups:GroupSummary[]}>('/api/hangouts').then(data=>setGroups(data.groups.filter(g=>g.status!=='cancelled'))).catch(error=>setError(error.message));},[]);
  return <div className="dashboard"><div className="dashboard-heading"><div><h1>Hey, {user.name.split(' ')[0]} <span className="greeting-spark">✳</span></h1></div></div>
    <div className="dashboard-hero"><div><h2>Make time for<br/>your <em className="people-word">people.</em></h2><Link className="button primary" href="/account/plan">Plan a hangout <ArrowRight size={17}/></Link></div><div className="hero-art" aria-hidden="true"><span className="hero-spark">✳</span><div className="time-note"><span>ON THE AGENDA</span><Heart size={35} strokeWidth={1.3}/><strong>time together</strong></div><span className="hero-orbit"/></div></div>
    <div className="dashboard-grid"><div><div className="section-heading"><h2 className="future-hangouts-title">Future hangouts</h2><Link className="text-button view-all-button" href="/account/hangouts">View all <ArrowRight size={15}/></Link></div>{error?<p className="live-error" role="alert">{error}</p>:groups===null?<p role="status">Loading hangouts…</p>:groups.length?<GroupCard onCancelled={()=>setGroups(current=>current?.filter(group=>group.id!==groups[0].id)??null)} group={groups[0]} onOpen={()=>router.push(`/account/hangouts?hangout=${groups[0].id}`)}/>:<Card className="empty-hangouts"><span className="icon-tile"><CalendarDays size={26}/></span><h3>No hangouts yet</h3></Card>}</div>
      <div className="dashboard-aside"><Card className="calendar-card compact-calendar"><CalendarDays size={23}/><strong>{user.calendarConnected?'Calendar in sync':'Calendar not connected'}</strong></Card><Card className="preferences-card"><div className="row between"><h3>Your kind of hangout</h3><Settings2 size={18}/></div>{user.preferences&&<PreferenceSummary preferences={user.preferences}/>}<Link className="text-button" href="/account/preferences">{user.preferences?'Edit preferences':'Set up preferences'} <ArrowRight size={15}/></Link></Card></div>
    </div>
  </div>;
}
