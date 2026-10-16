'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link2, Menu, X } from 'lucide-react';
import Navigation from './navigation';
import CancellationNotices from './cancellation-notices';
export type AccountScreen = 'overview' | 'create' | 'preferences' | 'upcoming' | 'profile' | 'calendar';
export const accountPaths: Record<AccountScreen, string> = { overview:'/account',create:'/account/plan',preferences:'/account/preferences',upcoming:'/account/hangouts',profile:'/account/profile',calendar:'/account/calendar' };
export default function AccountShell({ user, screen, children }: { user: {id:string;name:string}; screen: AccountScreen; children: ReactNode }) {
  const [open,setOpen]=useState(false);
  const menuRef=useRef<HTMLButtonElement>(null);
  const sidebarRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!open)return;
    sidebarRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    function close(event: KeyboardEvent) { if(event.key==='Escape'){setOpen(false);menuRef.current?.focus();} }
    document.addEventListener('keydown',close);
    return ()=>document.removeEventListener('keydown',close);
  },[open]);
  return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a>
    <aside ref={sidebarRef} className={`sidebar ${open?'is-open':''}`}><Link className="wordmark" href="/account"><span className="brand-icon"><Link2 size={27}/></span>synchro<span className="brand-period">.</span></Link><div className="sidebar-profile"><span className="avatar">{user.name[0]}</span><span><strong>{user.name}</strong><small>Personal space</small></span></div><Navigation screen={screen} /></aside>
    <header className="mobile-header"><Link className="wordmark" href="/account">synchro.</Link><button ref={menuRef} className="icon-button" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></header>{open&&<button className="menu-overlay" aria-label="Close navigation" onClick={()=>{setOpen(false);menuRef.current?.focus();}}/>}
    <main id="main" tabIndex={-1} className="app-main"><div className="topbar"><Link className="avatar small-avatar" href="/account/profile" aria-label="Your profile">{user.name[0]}</Link></div><CancellationNotices userId={user.id}/><div className="screen-transition">{children}</div></main>
  </div>;
}
