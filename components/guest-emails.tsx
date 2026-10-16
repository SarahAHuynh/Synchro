'use client';
import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { isEmail } from '@/lib/validation';
import { Button, Field } from './ui';
export default function GuestEmails({ emails, onChange, ownEmail, disabled = false, limit = 9, label = 'Guest email', onPendingChange }: { emails: string[]; onChange: (value: string[]) => void; ownEmail: string; disabled?: boolean; limit?: number; label?: string; onPendingChange?: (value: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(''); const [error, setError] = useState('');
  function add() {
    const email = draft.trim().toLowerCase();
    if (!isEmail(email) || email.length > 254 || /[,;\s]/.test(email)) { setError('Enter one valid email.'); return; }
    if (email === ownEmail.toLowerCase()) { setError('You’re already included.'); return; }
    if (emails.includes(email)) { setError('This guest is already added.'); return; }
    if (emails.length >= limit) { setError('This hangout is full.'); return; }
    onChange([...emails, email]); setDraft(''); onPendingChange?.(''); setError('');
  }
  return <div className="guest-editor"><div className="guest-entry"><Field label={label} name={id} type="email" value={draft} disabled={disabled || emails.length >= limit} onChange={event => { setDraft(event.target.value); onPendingChange?.(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder="friend@example.com" error={error} /><Button type="button" variant="secondary" disabled={disabled || !draft.trim() || emails.length >= limit} onClick={add}><Plus size={16} /> Add</Button></div>{emails.length > 0 && <ul className="guest-chips" aria-label="Added guests">{emails.map(email => <li key={email}><span>{email}</span><button type="button" disabled={disabled} aria-label={`Remove ${email}`} onClick={() => onChange(emails.filter(item => item !== email))}><X size={14} /></button></li>)}</ul>}{draft.trim() && !error && <p className="small muted">Press Add to include this guest.</p>}</div>;
}
