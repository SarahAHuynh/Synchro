import { calendarSyncStatus, processCalendarJobs, requireEventQueue } from '@/lib/server/calendar-events';
import { randomBytes, randomUUID } from 'node:crypto';
import { invitationToken } from '@/lib/server/invitations';
import { ApiError, authenticated, failure, json, readBody, sameOrigin } from '@/lib/server/http';
import { checkSelected, groupDatabaseError, loadGroup, requireConnection, saveGroup, sharedBusy } from '@/lib/server/groups';
import { adminClient } from '@/lib/server/supabase';
import { appOrigin } from '@/lib/server/config';
import { groupTally, groupView, normalizeEmails, resetPlan, validGroupInput } from '@/lib/groups';
import { validPreferences } from '@/lib/live-validation';
import { liveFreeWindows } from '@/lib/live-availability';
import { recommendActivities } from '@/lib/planning';
import { activityCatalog } from '@/lib/activity-catalog';
import { curateActivities } from '@/lib/server/activity-recommender';
type Context = { params: Promise<{ id: string }> };
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await authenticated(); const { group, member } = await loadGroup((await context.params).id, user, _request.headers.get('x-synchro-invite') ?? '');
    if (!member.userId) return json({ invitation: true, id: group.id, name: group.name, description: group.description, start: group.start, end: group.end, timeZone: group.timeZone, min: group.min, max: group.max, status: group.status, invitedEmail: member.email, cancellationReason:group.cancellationReason, organizerName: group.members.find(item => item.userId === group.organizerId)?.name });
    return json({...groupView(group, user.id, appOrigin(), group.organizerId === user.id ? invitationToken(group) : undefined), calendarSync: await calendarSyncStatus(group.id,user.id)});
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request); const { user, client } = await authenticated(); const body = await readBody(request);
    const { group, member, revision } = await loadGroup((await context.params).id, user, typeof body.inviteToken === 'string' ? body.inviteToken : '');
    if (body.action === 'sync-calendar') {
      if (!member.userId) throw new ApiError('Accept this invitation first.',403);
      await processCalendarJobs(group.id,true);
      return json({ok:true});
    }
    if (group.status === 'cancelled') throw new ApiError('This hangout was cancelled.', 409);
    const organizer = group.organizerId === user.id;
    const ownerActions = ['find', 'select', 'confirm', 'reset', 'cancel', 'invite', 'remove', 'dates', 'renew-link', 'schedule-calendar', 'resolve-attendance'];
    if (ownerActions.includes(String(body.action)) && !organizer) throw new ApiError('Only the organizer can do that.', 403);
    if (!member.userId && !['join', 'leave'].includes(String(body.action))) throw new ApiError('Accept this invitation first.', 403);
    const reason=typeof body.reason==='string'?body.reason.trim():'';
    if(['cancel','remove','request-attendance'].includes(String(body.action))&&(!reason||reason.length>500))throw new ApiError('Please give a reason (up to 500 characters).',400);
    if(['request-attendance','resolve-attendance','remove'].includes(String(body.action))){const {error}=await adminClient().from('hangout_notifications').select('id').limit(0);if(error)throw new ApiError('Run the attendance notifications migration in Supabase first.',503);}
    if(['find','select','confirm'].includes(String(body.action))&&group.attendanceRequests?.some(r=>r.status==='pending'))throw new ApiError('Review pending attendance requests first.',409);
    if(body.action==='request-attendance') {
      if(organizer)throw new ApiError('Use Manage hangout to change your plan.',400);
      if(!['cannot-attend','reschedule'].includes(String(body.kind)))throw new ApiError('Choose cannot attend or reschedule.',400);
      if(group.attendanceRequests?.some(r=>r.userId===user.id&&r.status==='pending'))throw new ApiError('Your request is already waiting for the organizer.',409);
      group.attendanceRequests=(group.attendanceRequests??[]).filter(r=>r.userId!==user.id);
      if(group.attendanceRequests.length>=100)throw new ApiError('This plan has reached its change-request limit.',409);
      group.attendanceRequests.push({id:randomUUID(),userId:user.id,name:member.name,kind:body.kind as 'cannot-attend'|'reschedule',reason,status:'pending',createdAt:new Date().toISOString()});
    } else if(body.action==='resolve-attendance') {
      const request=group.attendanceRequests?.find(r=>r.id===body.requestId&&r.status==='pending');
      if(!request||!['remove','reschedule','keep'].includes(String(body.decision)))throw new ApiError('Choose a pending request and a decision.',400);
      if(!reason||reason.length>500)throw new ApiError('Explain your decision (up to 500 characters).',400);
      request.responseReason=reason;
      if(body.decision==='remove'){request.status='removed';group.members=group.members.filter(m=>m.userId!==request.userId);delete group.votes[request.userId];group.inviteVersion=randomBytes(16).toString('hex');if(group.members.length<2)resetPlan(group);}
      else if(body.decision==='reschedule'){request.status='rescheduling';resetPlan(group);}
      else request.status='declined';
    } else if (body.action === 'join' || body.action === 'preferences') {
      if (group.status === 'confirmed') throw new ApiError('Ask the organizer to reopen the plan before changing preferences.', 409);
      if (body.action === 'join' && member.userId) throw new ApiError('You have already joined.', 409);
      if (body.consent !== true) throw new ApiError('Agree to share availability for this hangout before joining.', 400);
      await requireConnection(user.id);
      const { data: profile, error } = await client.from('profiles').select('name, preferences').eq('id', user.id).maybeSingle();
      groupDatabaseError(error);
      const preferences = body.useSaved === true ? profile?.preferences : body.preferences;
      if (!validPreferences(preferences)) throw new ApiError('Save your preferences or customize them for this hangout.', 400);
      if (!group.members.includes(member)) {
        if (group.members.length >= 10) throw new ApiError('This hangout is full (10 people).', 409);
        group.members.push(member);
      }
      member.userId = user.id; member.name = profile?.name || user.email!.split('@')[0]; member.preferences = preferences; member.consent = true;
      resetPlan(group);
    } else if (body.action === 'leave') {
      if (organizer) throw new ApiError('The organizer can cancel the hangout instead.', 400);
      if (!group.members.includes(member)) return json({ ok: true });
      throw new ApiError('Use I can’t make it to send the organizer a request and reason.',409);
    } else if (body.action === 'invite') {
      const emails = normalizeEmails(body.emails, member.email);
      if (!emails || !emails.length || emails.some(email => group.members.some(item => item.email === email)) || emails.length + group.members.length > 10) throw new ApiError('Add unique guest emails, up to 10 people including you.', 400);
      group.members.push(...emails.map(email => ({ email, userId: null, name: email.split('@')[0], preferences: null, consent: false }))); resetPlan(group);
    } else if (body.action === 'remove') {
      if (typeof body.email !== 'string' || body.email === member.email || !group.members.some(item => item.email === body.email)) throw new ApiError('Choose a guest to remove.', 400);
      const removed=group.members.find(item=>item.email===body.email)!;
      if(removed.userId){group.attendanceRequests=(group.attendanceRequests??[]).filter(r=>r.userId!==removed.userId);group.attendanceRequests.push({id:randomUUID(),userId:removed.userId,name:removed.name,kind:'cannot-attend',reason,responseReason:reason,status:'removed',createdAt:new Date().toISOString()});}
      group.members = group.members.filter(item => item.email !== body.email);if(removed.userId)delete group.votes[removed.userId];if(group.members.length<2)resetPlan(group);
      group.inviteVersion = randomBytes(16).toString('hex');
    } else if (body.action === 'dates') {
      if (!validGroupInput({ ...group, start: body.start, end: body.end, min: body.min, max: body.max })) throw new ApiError('Choose up to 14 future days and 30–480 minutes.', 400);
      group.start = body.start as string; group.end = body.end as string; group.min = body.min as number; group.max = body.max as number; resetPlan(group);
      group.members.forEach(item => { item.consent = false; });
    } else if (body.action === 'find') {
      if (group.status === 'confirmed') throw new ApiError('Reopen the confirmed plan first.', 409);
      if (!validGroupInput(group)) throw new ApiError('Update this hangout’s dates before finding a time.', 409);
      const busy = await sharedBusy(group); resetPlan(group);
      group.windows = liveFreeWindows(group.start, group.end, group.timeZone, group.min, busy, Date.now(), group.max);
      group.checkedAt = new Date().toISOString();
    } else if (body.action === 'select') {
      if (group.status !== 'planning' || !group.checkedAt || Date.now() - Date.parse(group.checkedAt) > 10 * 60000) throw new ApiError('Find shared times again to refresh availability.', 409);
      const slot = group.windows.find(item => item.start === body.start && item.end === body.end);
      if (!slot) throw new ApiError('Choose one of the shared times.', 400);
      await checkSelected(group, slot);
      const minutes = (Date.parse(slot.end) - Date.parse(slot.start)) / 60000;
      const localMinute = new Intl.DateTimeFormat('en-US', { timeZone: group.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(slot.start)).reduce((total, part) => part.type === 'hour' ? total + Number(part.value) * 60 : part.type === 'minute' ? total + Number(part.value) : total, 0);
      const selectedTime = { startMinutes: localMinute, endMinutes: localMinute + minutes, timeZone: group.timeZone };
      const candidates = recommendActivities(activityCatalog, group.members.map(item => item.preferences!), { id: slot.start, date: group.start, ...selectedTime });
      const curation = await curateActivities(candidates, group.members.map(item => item.preferences!), selectedTime);
      group.activities = curation.activities; group.activitiesAiCurated = curation.usedAI;
      group.selected = slot; group.status = 'voting'; group.votes = {}; group.confirmedActivityId = null;
    } else if (body.action === 'vote') {
      if (group.status !== 'voting' || !group.selected || Date.parse(group.selected.start) <= Date.now()) throw new ApiError('Voting is not open for this time.', 409);
      if (typeof body.activityId !== 'string' || !group.activities.some(item => item.id === body.activityId)) throw new ApiError('Choose a recommended activity.', 400);
      group.votes[user.id] = body.activityId;
    } else if (body.action === 'confirm') {
      const tally = groupTally(group);
      if (group.status !== 'voting' || !group.selected || !tally.allVoted || typeof body.activityId !== 'string' || !tally.winnerIds.includes(body.activityId)) throw new ApiError('Everyone must vote; choose a leading activity to confirm.', 409);
      await checkSelected(group, group.selected);
      await requireEventQueue();
      group.status = 'confirmed'; group.confirmedActivityId = body.activityId; group.calendarRevision=randomUUID();
    } else if (body.action === 'schedule-calendar') {
      if(group.status!=='confirmed'||!group.selected)throw new ApiError('Confirm the plan first.',409);
      await requireEventQueue();
      if(!group.calendarRevision)group.calendarRevision=randomUUID();
    } else if (body.action === 'renew-link') { group.inviteVersion = randomBytes(16).toString('hex');
    } else if (body.action === 'reset') { resetPlan(group);
    } else if (body.action === 'cancel') { resetPlan(group); group.status = 'cancelled'; group.cancellationReason=reason;
    } else { throw new ApiError('Unknown hangout action.', 400); }
    await saveGroup(group, revision);
    // The database trigger saved durable jobs in the same transaction as the plan.
    // Google failures must not undo or misreport a successfully saved plan.
    try { await processCalendarJobs(group.id); } catch { /* Retried from the UI or scheduled worker. */ }
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
