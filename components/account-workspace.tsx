'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Link2, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react';
import { api, RequestError } from '@/lib/client-api';
import { readInvitation, saveInvitation } from '@/lib/pending-invitation';
import GroupWorkspace from './group-workspace';
import AccountShell, { type AccountScreen } from './account-shell';
import AccountHome from './account-home';
import GoogleLogo from './google-logo';
import SavedPreferences from './saved-preferences';
import { Button, Card, Field, PreferenceSummary } from './ui';
import PreferenceForm from './preference-form';
import ActivityScene from './activity-scene';
import { defaultPreferences } from '@/lib/mock-data';
import { copyPreferences } from '@/lib/validation';
import type { UserPreferences } from '@/lib/types';
import type { LiveWindow } from '@/lib/live-availability';
type Account = { id: string; name: string; email: string; preferences: UserPreferences | null; calendarConnected: boolean; calendarEventsEnabled?:boolean };
type AccountState = { configured: boolean; calendarConfigured: boolean; user: Account | null };
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export default function AccountWorkspace({screen='overview'}:{screen?:AccountScreen}) {
  const router=useRouter();
  const [state,setState]=useState<AccountState|null>(null);
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<'signin'|'signup'|'reset'|'password'>('signin');
  const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [email,setEmail]=useState('');const [name,setName]=useState('');
  const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
  const [editingPreferences,setEditingPreferences]=useState(false);
  const [preferencesSaved,setPreferencesSaved]=useState(false);
  const [preferences,setPreferences]=useState(copyPreferences(defaultPreferences));
  const [verificationEmail,setVerificationEmail]=useState('');
  const [resendWait,setResendWait]=useState(0);
  useEffect(()=>{if(!resendWait)return;const timer=setTimeout(()=>setResendWait(resendWait-1),1000);return()=>clearTimeout(timer);},[resendWait]);
  const [pending,setPending]=useState(false);
  const [start,setStart]=useState('');const [end,setEnd]=useState('');const [duration,setDuration]=useState(60);
  const [windows,setWindows]=useState<LiveWindow[]|null>(null);const [checkedAt,setCheckedAt]=useState('');const [zone,setZone]=useState('');
  async function reload() { const data=await api<AccountState>('/api/auth');setState(data);if(data.user){setName(data.user.name);setPreferences(copyPreferences(data.user.preferences??defaultPreferences));} }
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    const id=query.get('hangout');const token=query.get('invite')??'';
    if(id&&/^[a-f0-9-]{36}$/i.test(id))saveInvitation(id,/^[a-f0-9]{64}$/.test(token)?token:'');
    setPending(!!readInvitation());
    if(query.get('mode')==='signup')setMode('signup');
    if(query.has('recovery'))setMode('password');
    if(query.get('calendar')==='connected')setMessage('Calendar connected.');
    if(query.get('calendar')==='cancelled')setMessage('Connection cancelled.');
    if(query.get('calendar')==='failed')setError('Calendar connection couldn’t be completed. Please try again.');
    if(query.has('error')){
      const reason=query.get('reason');
      setError(reason==='browser'?'This link could not finish sign-in in this browser. Try signing in with your email and password. Open future verification links in the same browser and device used to sign up.':reason==='expired'?'This link has expired or has already been used. Try signing in with your email and password.':'The verification link could not finish sign-in. Your email may already be verified—try signing in with your email and password.');
    }
    if((query.has('resume')||query.has('calendar'))&&readInvitation()){router.replace('/account/hangouts');return;}
    if(query.has('calendar')&&screen!=='calendar'){router.replace(`/account/calendar?${query}`);return;}
    // Keep a selected hangout in the URL, but remove one-time auth flags and invitation secrets.
    const clean=new URLSearchParams();if(id)clean.set('hangout',id);
    window.history.replaceState({},'',`${window.location.pathname}${clean.size?'?'+clean:''}`);
    setStart(localDate(new Date()));setEnd(localDate(new Date(Date.now()+6*86400000)));setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    reload().catch(error=>setError(error.message)).finally(()=>setLoading(false));
  },[router,screen]);
  async function perform(action:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setMessage('');try{await action();}catch(error){if(error instanceof RequestError&&error.status===409)setState(current=>current?.user?{...current,user:{...current.user,calendarConnected:false}}:current);setError(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}}
  function changeMode(next:typeof mode){setVerificationEmail('');setResendWait(0);setMode(next);setPassword('');setConfirm('');setError('');setMessage('');}
  const notice=<>{error&&<p className="live-error" role="alert">{error}</p>}{message&&<p className="live-message" role="status">{message}</p>}</>;
  if(loading)return <main className="live-loading" aria-busy="true"><LoaderCircle className="spin" size={30}/><p>Opening your space…</p></main>;
  if(state?.user&&mode!=='password')return <AccountShell user={state.user} screen={screen}>{notice}
    {pending&&(screen==='preferences'||screen==='calendar')&&<Link className="text-button return-invitation" href="/account/hangouts"><ArrowLeft size={16}/> Back to invitation</Link>}
    {screen==='overview'&&<AccountHome user={state.user}/>}
    {(screen==='create'||screen==='upcoming')&&<GroupWorkspace user={state.user} initialCreate={screen==='create'}/>}
    {screen==='preferences'&&(editingPreferences||!state.user.preferences)?<PreferenceForm busy={busy} value={preferences} onChange={setPreferences} onBack={()=>{setEditingPreferences(false);if(!state.user?.preferences)router.push('/account');}} onSave={()=>void perform(async()=>{const clean={...preferences,dislikedActivities:preferences.dislikedActivities.map(item=>item.trim()).filter(Boolean)};await api('/api/profile','PUT',{name,preferences:clean});setState(current=>current?.user?{...current,user:{...current.user,preferences:clean}}:current);setEditingPreferences(false);setPreferencesSaved(true);setMessage('');if(readInvitation())router.push('/account/hangouts');})}/>:screen==='preferences'&&state.user.preferences&&<SavedPreferences preferences={state.user.preferences} saved={preferencesSaved} onEdit={()=>{setMessage('');setPreferencesSaved(false);setPreferences(copyPreferences(state.user!.preferences??defaultPreferences));setEditingPreferences(true);}}/>}

    {screen==='calendar'&&<div className="form-page"><div className="page-heading"><h1>Google Calendar</h1><p>Find shared availability and add confirmed hangouts to your Google Calendar.</p></div><Card className="form-card"><div className="row between"><span className="icon-tile mint"><CalendarDays size={24}/></span><span className={`live-connection ${state.user.calendarConnected?'connected':''}`}>{state.user.calendarConnected?<><Check size={16}/> Connected</>:'Not connected'}</span></div>{!state.calendarConfigured&&<p className="live-error">Calendar connection isn’t configured yet.</p>}{state.user.calendarConnected&&!state.user.calendarEventsEnabled&&<p className="soft-note">Reconnect once to allow Synchro to add confirmed hangouts to your calendar.</p>}<div className="row live-calendar-actions"><Button disabled={busy||!state.calendarConfigured} onClick={()=>void perform(async()=>{const data=await api<{url:string}>('/api/calendar/connect','POST',{});window.location.assign(data.url);})}>{state.user.calendarConnected?'Reconnect Google Calendar':'Connect Google Calendar'} <ArrowRight size={17}/></Button>{state.user.calendarConnected&&<Button disabled={busy} variant="ghost" onClick={()=>void perform(async()=>{const result=await api<{message:string}>('/api/calendar/disconnect','POST',{});setWindows(null);await reload();setMessage(result.message);})}>Disconnect</Button>}</div></Card><Card className="live-availability"><div className="section-heading"><div><h2>Check your availability</h2></div><CalendarDays size={25} /></div><p>9 AM–9 PM · {zone.replaceAll('_',' ')}</p><form onSubmit={event => { event.preventDefault(); setWindows(null); void perform(async () => { const result = await api<{windows:LiveWindow[];checkedAt:string}>('/api/calendar/availability','POST',{start,end,duration,timeZone:zone}); setWindows(result.windows); setCheckedAt(result.checkedAt); }); }}><div className="live-date-fields"><Field label="Start date" name="live-start" type="date" min={localDate(new Date())} value={start} onChange={event => {setStart(event.target.value);setWindows(null);}} required /><Field label="End date" name="live-end" type="date" min={start} value={end} onChange={event => {setEnd(event.target.value);setWindows(null);}} required /><Field label="Time together (minutes)" name="live-duration" type="number" min={30} max={480} value={duration} onChange={event => {setDuration(Number(event.target.value));setWindows(null);}} required /></div><Button disabled={busy || !state.user.calendarConnected}>{busy ? <LoaderCircle className="spin" size={18} /> : <CalendarDays size={18} />} Check my availability</Button></form>{!state.user.calendarConnected && <p className="small muted">Connect your calendar above to begin.</p>}{windows !== null && <div className="live-results" role="status"><h3>{windows.length ? `${windows.length} free ${windows.length === 1 ? 'window' : 'windows'} found` : 'No free time in that window yet.'}</h3><p className="small muted">Checked at {new Date(checkedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}. Availability can change.</p>{windows.length ? <ul>{windows.map(window => <li key={window.start}><Check size={18} /><span>{new Date(window.start).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}<strong>{new Date(window.start).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} – {new Date(window.end).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</strong></span></li>)}</ul> : <p>Try other dates or a shorter duration.</p>}</div>}</Card></div>}
    {screen==='profile'&&<div className="form-page"><div className="page-heading"><h1>Hi, {state.user.name.split(' ')[0]}.</h1></div><Card className="form-card"><div className="row profile-heading"><Button disabled={busy} variant="secondary" className="profile-signout" onClick={()=>void perform(async()=>{await api('/api/auth','POST',{action:'signout'});setState({...state,user:null});setPassword('');setMode('signin');})}><LogOut size={16}/> Sign out</Button><span className="avatar large-avatar">{state.user.name[0]}</span><div><h2>{state.user.name}</h2><p>{state.user.email}</p></div></div><div className="profile-row"><h3>Google Calendar</h3><Link className="text-button" href="/account/calendar">Manage <ArrowRight size={16}/></Link></div><div className="profile-row"><h3>Saved preferences</h3><Link className="text-button" href="/account/preferences">Edit <ArrowRight size={16}/></Link></div>{state.user.preferences&&<PreferenceSummary preferences={state.user.preferences}/>}</Card></div>}
  </AccountShell>;
  return <div className="onboarding-shell"><header className="public-header"><Link className="wordmark" href="/"><span className="brand-icon"><Link2 size={26}/></span>synchro<span className="brand-period">.</span></Link></header><main className="public-main auth-main">
    {!state&&<Card className="setup-message"><h1>Let’s try that again.</h1>{notice}<Button disabled={busy} onClick={()=>void perform(reload)}>Try again</Button></Card>}
    {state&&!state.configured&&<Card className="setup-message"><ShieldCheck size={32}/><h1>We’re getting things ready.</h1><p>Account services aren’t configured yet.</p></Card>}
      {state?.configured && (!state.user || mode === 'password') && <div className="auth-layout live-auth"><div className="auth-intro"><h1>{mode === 'reset' || mode === 'password' ? 'A fresh start.' : <>Make time for your <em className="people-word">people.</em></>}</h1><div className="auth-art"><span className="auth-decoration" aria-hidden="true">✦ ♡ ✳</span><ActivityScene activity={{ id: 'coffee', name: 'coffee and a catch-up', category: '' }} /></div></div><Card className="auth-card">{pending && <div className="invitation-guide"><strong>Join your hangout</strong><p>Sign in or create an account to join your hangout.</p><ol><li>Sign in or create an account</li><li>Set preferences & connect Google Calendar</li><li>Accept your invitation</li></ol></div>}<h2>{mode === 'signup' ? 'Create an account' : mode === 'reset' ? 'Reset your password.' : mode === 'password' ? 'Choose a new password.' : 'Welcome back.'}</h2>{notice}<form onSubmit={event => { event.preventDefault(); void perform(async () => {
        if ((mode === 'signup' || mode === 'password') && password !== confirm) throw new Error('Your passwords should match. Try again.');
        const result = await api<{ message?: string; signedIn?: boolean;confirmationRequired?:boolean }>('/api/auth', 'POST', { action: mode, name, email, password });
        setPassword(''); setConfirm('');
        if(result.confirmationRequired){setVerificationEmail(email.trim());setResendWait(60);}
        if (result.message) setMessage(result.message);
        if (result.signedIn || mode === 'password') { setMode('signin'); await reload(); if (readInvitation()) router.replace('/account/hangouts'); }
      }); }}>
        {mode === 'signup' && <Field label="Your name" name="live-name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={100} required />}
        {mode !== 'password' && <Field label="Email address" name="live-email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" required />}
        {mode !== 'reset' && <Field label="Password" name="live-password" value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={mode === 'signin' ? 1 : 12} maxLength={128} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder={mode === 'signin' ? 'Your password' : 'At least 12 characters'} required />}
        {(mode === 'signup' || mode === 'password') && <Field label="Confirm password" name="live-confirm" value={confirm} onChange={event => setConfirm(event.target.value)} type="password" autoComplete="new-password" required />}
        <Button className="full" disabled={busy || (mode === 'password' && !state.user)}>{busy ? <LoaderCircle size={18} className="spin" /> : null}{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'password' ? 'Update password' : 'Sign in'} <ArrowRight size={17} /></Button>
      </form>{mode==='signup'&&verificationEmail&&verificationEmail.toLowerCase()===email.trim().toLowerCase()&&<div className="verification-help">{verificationEmail&&<p>Check the inbox and spam folder for {verificationEmail}. Already verified? Sign in.</p>}<Button variant="secondary" disabled={busy||resendWait>0||!email.trim()} onClick={()=>void perform(async()=>{const result=await api<{message:string}>('/api/auth','POST',{action:'resend',email:verificationEmail});setResendWait(60);setMessage(result.message);})}>{resendWait?`Resend available in ${resendWait}s`:'Resend verification email'}</Button></div>}{mode === 'signin' || mode === 'signup' ? <><div className="divider"><span>or continue with</span></div><Button variant="secondary" className="full google-signin" disabled={busy} onClick={() => void perform(async () => { const data = await api<{url:string}>('/api/auth','POST',{action:'google'}); window.location.assign(data.url); })}><GoogleLogo/> Google Sign In</Button><div className="auth-links"><button className="text-button" onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Already registered? Sign in'}</button>{mode === 'signin' && <button className="text-button" onClick={() => changeMode('reset')}>Forgot password?</button>}</div></> : <Button variant="ghost" onClick={() => changeMode('signin')}>Back to sign in</Button>}</Card></div>}
</main></div>;
}
