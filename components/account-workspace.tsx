'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Link2, LoaderCircle, LogOut, ShieldCheck, Users } from 'lucide-react';
import { Button, Card, Field, PreferenceSummary } from './ui';
import PreferenceForm from './preference-form';
import ActivityScene from './activity-scene';
import { defaultPreferences } from '@/lib/mock-data';
import { copyPreferences } from '@/lib/validation';
import type { UserPreferences } from '@/lib/types';
import type { LiveWindow } from '@/lib/live-availability';
type Account = { id: string; name: string; email: string; preferences: UserPreferences | null; calendarConnected: boolean };
type AccountState = { configured: boolean; calendarConfigured: boolean; user: Account | null };
class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error ?? 'Please try again.', response.status);
  return data;
}
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export default function AccountWorkspace() {
  const [state, setState] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'password'>('signin');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [editing, setEditing] = useState(false);
  const [preferences, setPreferences] = useState(copyPreferences(defaultPreferences));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [duration, setDuration] = useState(60);
  const [windows, setWindows] = useState<LiveWindow[] | null>(null);
  const [checkedAt, setCheckedAt] = useState('');
  const [zone, setZone] = useState('');
  async function reload() {
    const data = await api<AccountState>('/api/auth');
    setState(data);
    if (data.user) { setName(data.user.name); setPreferences(copyPreferences(data.user.preferences ?? defaultPreferences)); }
  }
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('mode') === 'signup') setMode('signup');
    if (query.has('recovery')) setMode('password');
    if (query.get('calendar') === 'connected') setMessage('Your Google Calendar is connected. Let’s find a little free time.');
    if (query.get('calendar') === 'cancelled') setMessage('Connection cancelled. Your calendar has not changed.');
    if (query.get('calendar') === 'failed' || query.has('error')) setError('That connection could not be completed. Try again from this browser.');
    window.history.replaceState({}, '', window.location.pathname);
    setStart(localDate(new Date()));
    setEnd(localDate(new Date(Date.now() + 6 * 86400000)));
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    reload().catch(error => setError(error.message)).finally(() => setLoading(false));
  }, []);
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (error) { if (error instanceof RequestError && error.status === 409) setState(current => current?.user ? { ...current, user: { ...current.user, calendarConnected: false } } : current); setError(error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); }
  }
  function changeMode(next: typeof mode) { setMode(next); setPassword(''); setConfirm(''); setError(''); setMessage(''); }
  const notice = <>{error && <p className="live-error" role="alert">{error}</p>}{message && <p className="live-message" role="status">{message}</p>}</>;
  if (loading) return <main className="live-loading" aria-busy="true"><LoaderCircle className="spin" size={30} /><p>Opening your space…</p></main>;
  return <div className="live-shell"><header className="live-header"><Link className="wordmark" href="/"><span className="brand-icon"><Link2 size={26} /></span>synchro<span className="brand-period">.</span></Link><Link className="text-button" href="/?demo=1"><ArrowLeft size={16} /> Explore planning demo</Link></header>
    <main className="live-main">{!state && <Card className="setup-message"><h1>Let’s try that again.</h1><p>We couldn’t open your account space right now.</p>{notice}<Button disabled={busy} onClick={() => void perform(reload)}>Try again</Button></Card>}
      {state && !state.configured && <Card className="setup-message"><ShieldCheck size={32} /><h1>Your real space is coming together.</h1><p>Real accounts and calendar access aren’t configured on this installation yet. You can still explore the full planning demo.</p>{notice}<Link className="button primary" href="/?demo=1">Explore the demo <ArrowRight size={17} /></Link></Card>}
      {state?.configured && (!state.user || mode === 'password') && <div className="auth-layout live-auth"><div className="auth-intro"><span className="eyebrow">MAKE ROOM FOR YOUR PEOPLE</span><h1>{mode === 'reset' || mode === 'password' ? 'A fresh start.' : 'Good times begin here.'}</h1><p>Your account. Your preferences. Your calendar, kept private.</p><ActivityScene activity={{ id: 'coffee', name: 'coffee and a catch-up', category: 'A little more together' }} /></div><Card className="auth-card"><h2>{mode === 'signup' ? 'Make yourself at home.' : mode === 'reset' ? 'Reset your password.' : mode === 'password' ? 'Choose a new password.' : 'Welcome back.'}</h2>{notice}<form onSubmit={event => { event.preventDefault(); void perform(async () => {
        if ((mode === 'signup' || mode === 'password') && password !== confirm) throw new Error('Your passwords should match. Try again.');
        const result = await api<{ message?: string; signedIn?: boolean }>('/api/auth', 'POST', { action: mode, name, email, password });
        setPassword(''); setConfirm('');
        if (result.message) setMessage(result.message);
        if (result.signedIn || mode === 'password') { setMode('signin'); await reload(); }
      }); }}>
        {mode === 'signup' && <Field label="Your name" name="live-name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={100} required />}
        {mode !== 'password' && <Field label="Email address" name="live-email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" required />}
        {mode !== 'reset' && <Field label="Password" name="live-password" value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={mode === 'signin' ? 1 : 12} maxLength={128} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder={mode === 'signin' ? 'Your password' : 'At least 12 characters'} required />}
        {(mode === 'signup' || mode === 'password') && <Field label="Confirm password" name="live-confirm" value={confirm} onChange={event => setConfirm(event.target.value)} type="password" autoComplete="new-password" required />}
        <Button className="full" disabled={busy || (mode === 'password' && !state.user)}>{busy ? <LoaderCircle size={18} className="spin" /> : null}{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'password' ? 'Update password' : 'Sign in'} <ArrowRight size={17} /></Button>
      </form>{mode === 'signin' || mode === 'signup' ? <><div className="divider"><span>or continue with</span></div><Button variant="secondary" className="full" disabled={busy} onClick={() => void perform(async () => { const data = await api<{url:string}>('/api/auth','POST',{action:'google'}); window.location.assign(data.url); })}><span className="google-g">G</span> Google</Button><div className="auth-links"><button className="text-button" onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Already registered? Sign in'}</button>{mode === 'signin' && <button className="text-button" onClick={() => changeMode('reset')}>Forgot password?</button>}</div><p className="small muted">Google sign-in creates your account. Calendar access is a separate choice after you sign in.</p></> : <Button variant="ghost" onClick={() => changeMode('signin')}>Back to sign in</Button>}</Card></div>}
      {state?.user && mode !== 'password' && <>
        <div className="dashboard-heading"><div><span className="eyebrow">YOUR REAL SYNCHRO SPACE</span><h1>Hey, {state.user.name.split(' ')[0]} <span className="greeting-spark">✳</span></h1><p>{state.user.email}</p></div><Button variant="secondary" disabled={busy} onClick={() => void perform(async () => { await api('/api/auth','POST',{action:'signout'}); setState({...state,user:null}); setWindows(null); setEditing(false); setPassword(''); setMode('signin'); })}><LogOut size={17} /> Sign out</Button></div>
        {notice}
        {editing ? <PreferenceForm value={preferences} onChange={setPreferences} onBack={() => { setEditing(false); setPreferences(copyPreferences(state.user!.preferences ?? defaultPreferences)); }} onSave={() => void perform(async () => { const clean = { ...preferences, dislikedActivities: preferences.dislikedActivities.map(item => item.trim()).filter(Boolean) }; await api('/api/profile','PUT',{name,preferences:clean}); await reload(); setEditing(false); setMessage('Your preferences are saved to your account.'); })} /> : <>
          <div className="live-dashboard-grid"><Card className="live-calendar-card"><div className="row between"><span className="icon-tile mint"><CalendarDays size={24} /></span><span className={`live-connection ${state.user.calendarConnected ? 'connected' : ''}`}>{state.user.calendarConnected ? <><Check size={16} /> Connected</> : 'Not connected'}</span></div><h2>A little room in your calendar.</h2><p>Connect Google Calendar to check your real availability. Synchro reads free/busy times on your primary calendar—never event names, guests, or descriptions.</p>{!state.calendarConfigured && <p className="demo-callout">Google Calendar connection is not available on this installation yet.</p>}<div className="row live-calendar-actions"><Button disabled={busy || !state.calendarConfigured} onClick={() => void perform(async () => { const data = await api<{url:string}>('/api/calendar/connect','POST',{}); window.location.assign(data.url); })}>{state.user.calendarConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'} <ArrowRight size={17} /></Button>{state.user.calendarConnected && <Button disabled={busy} variant="ghost" onClick={() => void perform(async () => { const result = await api<{message:string}>('/api/calendar/disconnect','POST',{}); setWindows(null); await reload(); setMessage(result.message); })}>Disconnect</Button>}</div></Card><Card className="live-profile-card"><ActivityScene compact activity={{id:'relax',name:'a quiet afternoon',category:'Your kind of good time'}} /><div><h2>Your preferences</h2>{state.user.preferences ? <PreferenceSummary preferences={state.user.preferences} /> : <p>Tell us what a good time looks like for you. Your preferences will be saved to your account.</p>}<Button variant="secondary" onClick={() => { setPreferences(copyPreferences(state.user!.preferences ?? defaultPreferences)); setEditing(true); }}>{state.user.preferences ? 'Edit preferences' : 'Set up preferences'}</Button></div></Card></div>
          <Card className="live-availability"><div className="section-heading"><div><span className="eyebrow">FROM YOUR REAL GOOGLE CALENDAR</span><h2>When do you have a little time?</h2></div><CalendarDays size={25} /></div><p>Check your own availability between 9 AM and 9 PM. Choose up to 14 days. Times are shown in {zone.replaceAll('_',' ')}.</p><form onSubmit={event => { event.preventDefault(); setWindows(null); void perform(async () => { const result = await api<{windows:LiveWindow[];checkedAt:string}>('/api/calendar/availability','POST',{start,end,duration,timeZone:zone}); setWindows(result.windows); setCheckedAt(result.checkedAt); }); }}><div className="live-date-fields"><Field label="Start date" name="live-start" type="date" min={localDate(new Date())} value={start} onChange={event => {setStart(event.target.value);setWindows(null);}} required /><Field label="End date" name="live-end" type="date" min={start} value={end} onChange={event => {setEnd(event.target.value);setWindows(null);}} required /><Field label="Time together (minutes)" name="live-duration" type="number" min={30} max={480} value={duration} onChange={event => {setDuration(Number(event.target.value));setWindows(null);}} required /></div><Button disabled={busy || !state.user.calendarConnected}>{busy ? <LoaderCircle className="spin" size={18} /> : <CalendarDays size={18} />} Check my availability</Button></form>{!state.user.calendarConnected && <p className="small muted">Connect your calendar above to begin.</p>}{windows !== null && <div className="live-results" role="status"><h3>{windows.length ? `${windows.length} free ${windows.length === 1 ? 'window' : 'windows'} found` : 'No free time in that window yet.'}</h3><p className="small muted">Checked at {new Date(checkedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}. Availability can change.</p>{windows.length ? <ul>{windows.map(window => <li key={window.start}><Check size={18} /><span>{new Date(window.start).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}<strong>{new Date(window.start).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} – {new Date(window.end).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</strong></span></li>)}</ul> : <p>Try other dates or a shorter duration.</p>}</div>}</Card>
          <div className="live-next"><Users size={24} /><div><h3>Your calendar is the first piece.</h3><p>Live group planning will need each person’s account, consent, and calendar. For now, group scheduling and voting are available in the separate demo.</p><Link className="text-button" href="/?demo=1">Explore group planning <ArrowRight size={16} /></Link></div></div>
        </>}
      </>}
    </main><footer className="live-footer">Your people. Your pace. Your privacy.</footer>
  </div>;
}
