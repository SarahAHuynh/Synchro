'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Heart, LoaderCircle, MapPin, RotateCcw, Sparkles, Users } from 'lucide-react';
import type { ActivitySuggestion, Hangout, TimeSlot, User } from '@/lib/types';
import { buildDemoCalendars, demoActivities, getGroupPreferences } from '@/lib/planning-demo';
import { canConfirmPlan, findSharedTimes, formatSlot, formatTime, participantName, recommendActivities, tallyVotes } from '@/lib/planning';
import ActivityScene from './activity-scene';
import { Button, Card, Chip, formatDate, Progress } from './ui';

export default function PlanningFlow({ hangout, user, onUpdate, onOverview, onPreferences, onEdit }: {
  hangout: Hangout;
  user: User;
  onUpdate: (hangout: Hangout) => void;
  onOverview: () => void;
  onPreferences: () => void;
  onEdit: () => void;
}) {
  const [searching, setSearching] = useState(!hangout.selectedTime);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voterId, setVoterId] = useState(user.id);
  const [notice, setNotice] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stage = hangout.status === 'confirmed' ? 'confirmed' : hangout.selectedTime ? 'activities' : 'time';
  useEffect(() => {
    if (hangout.selectedTime) { setSearching(false); return; }
    setSearching(true);
    setSelectedId(null);
    const timer = setTimeout(() => setSearching(false), 650);
    return () => clearTimeout(timer);
  }, [hangout.id, hangout.demoScenario, hangout.dateRangeStart, hangout.dateRangeEnd, hangout.minDurationMinutes, hangout.maxDurationMinutes, hangout.selectedTime]);

  useEffect(() => { setNotice(''); headingRef.current?.focus({ preventScroll: true }); }, [stage]);
  const slots = useMemo(() => findSharedTimes(hangout, buildDemoCalendars(hangout)), [hangout]);
  const suggestions = useMemo(() => hangout.selectedTime ? recommendActivities(demoActivities, getGroupPreferences(hangout, user.id, user.preferences), hangout.selectedTime) : [], [hangout, user.id, user.preferences]);
  const tally = tallyVotes(suggestions, hangout.participantIds, hangout.activityVotes ?? {});
  const selectedSlot = slots.find(slot => slot.id === selectedId);
  const selectedActivity = demoActivities.find(activity => activity.id === hangout.confirmedActivityId);
  const allVoted = tally.total === hangout.participantIds.length;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ');

  function chooseTime(slot: TimeSlot) {
    onUpdate({ ...hangout, selectedTime: slot, activityVotes: {}, confirmedActivityId: undefined, status: 'voting' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function vote(activity: ActivitySuggestion) {
    const votes = { ...hangout.activityVotes };
    if (votes[voterId] === activity.id) delete votes[voterId];
    else votes[voterId] = activity.id;
    onUpdate({ ...hangout, activityVotes: votes });
    setNotice(votes[voterId] ? `Vote saved for ${participantName(voterId, user.id, user.name)}.` : 'Vote removed. Choose another favorite when you’re ready.');
  }
  function fillSampleVotes() {
    const votes = { ...hangout.activityVotes };
    const favorite = votes[user.id] ?? suggestions[0]?.id;
    if (!favorite) return;
    for (const id of hangout.participantIds) if (id !== user.id && !votes[id]) votes[id] = favorite;
    onUpdate({ ...hangout, activityVotes: votes });
    setNotice('Sample votes added for the other participants. You can change each one using the demo controls.');
  }
  function resetTime() {
    onUpdate({ ...hangout, selectedTime: undefined, activityVotes: {}, confirmedActivityId: undefined, status: 'finding-time' });
    setSelectedId(null);
  }
  function confirm(activity: ActivitySuggestion) {
    if (!canConfirmPlan(hangout, suggestions, activity.id)) return;
    onUpdate({ ...hangout, confirmedActivityId: activity.id, status: 'confirmed' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  return <div className="planning-page">
    <div className="planning-topline"><button className="text-button" onClick={onOverview}><ArrowLeft size={17} /> Overview</button><span className="demo-badge">SAMPLE CALENDARS · DEMO VOTES</span></div>
    <div className="page-heading"><span className="eyebrow">{stage === 'time' ? 'FIND YOUR LITTLE OVERLAP' : stage === 'activities' ? 'A TIME TOGETHER. A PLAN TO LOVE.' : 'SOMETHING GOOD TO LOOK FORWARD TO'}</span>
      <h1 ref={headingRef} tabIndex={-1}>{stage === 'time' ? 'A moment for everyone.' : stage === 'activities' ? 'What shall we do?' : 'See you soon.'}</h1>
      <p>{stage === 'time' ? 'First, a shared time. Then, something everyone can look forward to.' : stage === 'activities' ? 'A few ideas that fit your people, your budget, and your time.' : 'From “we should” to a little time together.'}</p>
    </div>
    <Progress step={stage === 'time' ? 0 : stage === 'activities' ? 1 : 2} labels={['Find a time', 'Choose together', 'Your plan']} />
    <div className="planning-layout" key={stage}>
      <div className="planning-content">
        {stage === 'time' && <Card className="planning-card">
          <div className="section-heading"><h2>When everyone is free</h2><CalendarDays size={23} /></div>
          <p className="muted">{hangout.minDurationMinutes}–{hangout.maxDurationMinutes} minutes together, between {formatDate(hangout.dateRangeStart)} and {formatDate(hangout.dateRangeEnd)}.</p>
          <div className="demo-controls"><span className="eyebrow">TRY A SAMPLE SCENARIO</span><div className="chips"><Chip selected={hangout.demoScenario !== 'busy'} onClick={() => onUpdate({ ...hangout, demoScenario: 'typical' })}>A little room to meet</Chip><Chip selected={hangout.demoScenario === 'busy'} onClick={() => onUpdate({ ...hangout, demoScenario: 'busy' })}>Everyone’s busy</Chip></div></div>
          {searching ? <div className="matching-state" role="status"><span className="matching-orbit"><LoaderCircle className="spin" size={32} /></span><h3>Finding a little overlap…</h3><p>Comparing your group’s sample calendars.</p></div> : slots.length ? <>
            <p className="result-count" role="status"><CheckCircle2 size={18} /> {slots.length} shared {slots.length === 1 ? 'window' : 'windows'} found. Everyone is free.</p>
            <p className="muted small">All times use {timeZone}. These are simulated free/busy windows, between 9 AM and 9 PM.</p>
            <div className="time-options" role="group" aria-label="Shared time options">{slots.map((slot, index) => <button type="button" key={slot.id} className={`time-option ${selectedId === slot.id ? 'selected' : ''}`} aria-pressed={selectedId === slot.id} onClick={() => setSelectedId(slot.id)}>
              <span className="time-option-date"><strong>{new Date(`${slot.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><span>{formatDate(slot.date)}</span></span>
              <span className="time-option-main"><strong>{formatTime(slot.startMinutes)} – {formatTime(slot.endMinutes)}</strong><small>{slot.endMinutes - slot.startMinutes} minutes · {hangout.participantIds.length} people free{index === 0 ? ' · Earliest match' : ''}</small></span>
              <span className="selection-circle">{selectedId === slot.id && <Check size={16} />}</span>
            </button>)}</div>
            <div className="form-actions"><button className="text-button" onClick={onPreferences}><ArrowLeft size={16} /> My preferences</button><Button disabled={!selectedSlot} onClick={() => selectedSlot && chooseTime(selectedSlot)}>Choose this time <ArrowRight size={17} /></Button></div>
          </> : <div className="empty-state"><Clock3 size={36} /><h2>No shared time just yet.</h2><p>{hangout.demoScenario === 'busy' ? 'This sample scenario has everyone busy. Try the other scenario, or adjust your plan.' : 'The sample calendars don’t share a window this long. Try a shorter duration or different dates.'}</p><div className="empty-actions"><Button onClick={onEdit}>Adjust dates or duration</Button>{hangout.demoScenario === 'busy' && <Button variant="secondary" onClick={() => onUpdate({ ...hangout, demoScenario: 'typical' })}>Try the other scenario</Button>}</div></div>}
        </Card>}

        {stage === 'activities' && <>
          <div className="selected-time-banner"><span className="icon-tile mint"><Check size={21} /></span><div><strong>Your shared time is picked.</strong><p>{formatSlot(hangout.selectedTime!)}</p></div></div>
          <Card className="planning-card voting-panel"><div className="section-heading"><h2>One person, one favorite.</h2><span className="vote-count">{tally.total} / {hangout.participantIds.length} voted</span></div><p className="muted">Cast your vote below. Then try the other participants’ votes using these demo controls.</p>
            <div className="demo-controls"><label htmlFor="demo-voter">Preview voting as</label><select id="demo-voter" value={voterId} onChange={event => { setVoterId(event.target.value); setNotice(''); }}>{hangout.participantIds.map(id => <option key={id} value={id}>{participantName(id, user.id, user.name)}{id === user.id ? '' : ' · sample participant'}</option>)}</select>
              <Button variant="secondary" onClick={fillSampleVotes} disabled={!suggestions.length || hangout.participantIds.filter(id => id !== user.id).every(id => hangout.activityVotes?.[id])}><Users size={17} /> Add sample votes</Button>
              <p className="small muted">This changes demo votes on your screen. No one has been contacted.</p>
            </div>
            <div className="vote-progress" role="progressbar" aria-label="Participants who have voted" aria-valuenow={tally.total} aria-valuemin={0} aria-valuemax={hangout.participantIds.length}><span style={{ width: `${tally.total / hangout.participantIds.length * 100}%` }} /></div>
          </Card>
          <div className="vote-notice" role="status" aria-live="polite">{notice || (allVoted ? tally.winnerIds.length > 1 ? 'It’s a tie. As organizer, choose one of the group’s top choices.' : 'Everyone has voted. Your group’s favorite is ready to confirm.' : 'Pick a favorite. You can change your vote before the plan is confirmed.')}</div>
          {suggestions.length ? <div className="activity-list">{suggestions.map((activity, index) => {
            const voted = hangout.activityVotes?.[voterId] === activity.id;
            const winner = allVoted && tally.winnerIds.includes(activity.id);
            return <Card className={`activity-card ${voted ? 'has-vote' : ''}`} key={activity.id}>
              <ActivityScene activity={activity} />
              <div className="activity-body"><div className="row between"><span className="eyebrow">{index === 0 ? 'A GOOD MATCH FOR YOUR GROUP' : 'A LITTLE MORE INSPIRATION'}</span>{winner && <span className="tag"><Heart size={13} /> Group favorite</span>}</div><h2>{activity.name}</h2><p>{activity.description}</p>
                <div className="summary-pills"><span>{activity.costPerPerson === 0 ? 'Free' : `$${activity.costPerPerson} / person`}</span><span>{activity.setting}</span><span>{hangout.selectedTime!.endMinutes - hangout.selectedTime!.startMinutes} minutes</span><span>{activity.distanceMiles === 0 ? 'At home / nearby' : `Within ${activity.distanceMiles} mile`}</span></div>
                <p className="match-reason"><Sparkles size={17} />{activity.matchReason}</p>
                <div className="activity-actions"><Button variant={voted ? 'primary' : 'secondary'} aria-pressed={voted} onClick={() => vote(activity)}>{voted ? <Check size={17} /> : <Heart size={17} />}{voted ? 'Voted' : 'Vote for this'}</Button><span className="muted">{tally.counts[activity.id]} {tally.counts[activity.id] === 1 ? 'vote' : 'votes'}</span>{winner && <Button onClick={() => confirm(activity)}>Confirm this plan <ArrowRight size={17} /></Button>}</div>
              </div>
            </Card>;
          })}</div> : <Card className="empty-state"><Sparkles size={35} /><h2>Let’s make a little adjustment.</h2><p>No sample activity fits everyone’s budget, setting, dislikes, and selected duration. Your preferences won’t be silently changed.</p><Button onClick={onPreferences}>Review my hangout preferences</Button><Button variant="ghost" onClick={resetTime}>Choose another time</Button></Card>}
          <p className="small muted activity-disclaimer">Ideas come from a small sample catalog. Costs and distances are illustrative; no venues or live location results are searched.</p>
          <div className="planning-back"><Button variant="ghost" onClick={resetTime}><ArrowLeft size={17} /> Choose another time (clears votes)</Button><button className="text-button" onClick={onPreferences}>Change my preferences & restart</button></div>
        </>}

        {stage === 'confirmed' && selectedActivity && hangout.selectedTime && <Card className="confirmed-plan"><ActivityScene activity={selectedActivity} /><span className="success-icon"><Check size={34} /></span><span className="eyebrow">YOUR DEMO PLAN IS CONFIRMED</span><h2>{hangout.name}</h2><p className="confirmed-activity">{selectedActivity.name}</p><p>{selectedActivity.description}</p><div className="plan-details"><div><CalendarDays size={21} /><span><strong>{formatSlot(hangout.selectedTime)}</strong><small>{timeZone} · {hangout.selectedTime.endMinutes - hangout.selectedTime.startMinutes} minutes</small></span></div><div><Users size={21} /><span><strong>{hangout.participantIds.length} people, one good plan.</strong><small>{hangout.participantIds.map(id => participantName(id, user.id, user.name)).join(', ')}</small></span></div><div><MapPin size={21} /><span><strong>{selectedActivity.setting === 'indoor' ? 'An indoor get-together' : 'A little time outdoors'}</strong><small>{selectedActivity.costPerPerson === 0 ? 'Free' : `About $${selectedActivity.costPerPerson} per person`} · Agree on a meeting spot with your group.</small></span></div></div><div className="soft-note"><Heart size={22} /><p>This plan is saved for this visit. Calendars and other participants’ votes are simulated. No invitations or calendar events have been sent.</p></div><div className="empty-actions"><Button variant="secondary" onClick={onOverview}>Back to overview</Button></div><Button variant="ghost" onClick={() => onUpdate({ ...hangout, status: 'voting', confirmedActivityId: undefined })}><RotateCcw size={16} /> Reopen voting</Button></Card>}
        {stage === 'confirmed' && <p className="vote-notice" role="status">{notice}</p>}
      </div>
      <aside className="planning-sidebar"><Card className="planning-recap"><span className="eyebrow">THE LITTLE PLAN</span><h2>{hangout.name}</h2><p><Users size={17} /> {hangout.participantIds.length} people · Organized by {user.name.split(' ')[0]}</p><p><CalendarDays size={17} /> {formatDate(hangout.dateRangeStart)} – {formatDate(hangout.dateRangeEnd)}</p>{hangout.description && <p className="recap-description">{hangout.description}</p>}<div className="participant-list">{hangout.participantIds.map((id, index) => <div key={id}><span className={`participant-avatar participant-${index % 3}`}>{participantName(id, user.id, user.name)[0]}</span><span><strong>{participantName(id, user.id, user.name)}</strong><small>{id === user.id ? 'Your submitted preferences' : 'Sample calendar & preferences'}</small></span>{hangout.activityVotes?.[id] && <CheckCircle2 size={17} aria-label="Voted" />}</div>)}</div><p className="small muted">No event titles are needed. This demo compares synthetic free/busy windows.</p></Card><div className="planning-tip"><Sparkles size={23} /><h3>Time first. Good times next.</h3><p>Find a shared moment, choose a favorite, and leave the rest for when you’re together.</p></div></aside>
    </div>
  </div>;
}
