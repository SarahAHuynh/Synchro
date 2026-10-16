'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

export default function CancelHangoutDialog({ open, hangoutName, busy, onClose, onCancel }: { open: boolean; hangoutName: string; busy: boolean; onClose: () => void; onCancel: (reason: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) { setReason(''); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open]);

  return <dialog ref={dialog} className="cancel-hangout-dialog" aria-labelledby="cancel-hangout-title" aria-describedby="cancel-hangout-description" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="cancel-hangout-title">Cancel {hangoutName}?</h2>
    <p id="cancel-hangout-description">This cancels the hangout for everyone. Participants will see a cancellation notice, and Synchro-created calendar events will be queued for removal.</p>
    <div className="field"><label htmlFor="cancel-hangout-reason">Reason for cancelling</label><textarea id="cancel-hangout-reason" required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></div>
    <div className="dialog-actions"><Button type="button" variant="secondary" disabled={busy} autoFocus onClick={onClose}>Keep hangout</Button><Button className="danger-button" disabled={busy || !reason.trim()} onClick={() => void onCancel(reason.trim())}>{busy ? 'Cancelling…' : 'Cancel for everyone'}</Button></div>
  </dialog>;
}
