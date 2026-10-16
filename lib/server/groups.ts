import 'server-only';
import { adminClient } from './supabase';
import { ApiError } from './http';
import { validInvitationToken } from './invitations';
import { calendarBusy } from './calendar';
import type { GroupPlan, GroupMember } from '../groups';
import type { User } from '@supabase/supabase-js';
import type { LiveWindow } from '../live-availability';
export function verifiedEmail(user: User) {
  if (!user.email || !user.email_confirmed_at) throw new ApiError('Confirm your email before joining a hangout.', 403);
  return user.email.toLowerCase();
}
export function groupDatabaseError(error: { code?: string } | null) {
  if (error) throw new ApiError(error.code === 'PGRST205' || error.code === '42P01' ? 'Group planning needs its database setup. Run the Phase 4 migration in Supabase, then retry.' : 'We couldn’t save or load this hangout. Please try again.', 503);
}
export async function loadGroup(id: string, user: User, token = '') {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new ApiError('Hangout not found.', 404);
  const email = verifiedEmail(user);
  const db = adminClient();
  let query = db.from('hangout_groups').select('document, revision').eq('id', id);
  if (!/^[a-f0-9]{64}$/.test(token)) query = query.contains('invite_emails', [email]);
  const { data, error } = await query.maybeSingle();
  groupDatabaseError(error);
  if (!data) throw new ApiError('This hangout is unavailable. Sign in with the email that was invited.', 404);
  const group = data.document as GroupPlan;
  let member = group.members.find(item => item.email === email && (!item.userId || item.userId === user.id));
  if (!member && !group.members.some(item => item.email === email) && validInvitationToken(group, token)) member = { email, userId: null, name: email.split('@')[0], preferences: null, consent: false };
  if (!member) throw new ApiError('This invitation is unavailable. Ask the organizer for a new link.', 404);
  return { db, group, member, revision: data.revision as number };
}
export async function saveGroup(group: GroupPlan, revision: number) {
  const { data, error } = await adminClient().from('hangout_groups').update({ document: group, invite_emails: group.members.map(item => item.email), revision: revision + 1 }).eq('id', group.id).eq('revision', revision).select('id').maybeSingle();
  groupDatabaseError(error);
  if (!data) throw new ApiError('Someone just updated this hangout. Refresh it and try again; your change has not been saved.', 409);
}
export async function requireConnection(userId: string) {
  const { data, error } = await adminClient().from('calendar_connections').select('user_id').eq('user_id', userId).maybeSingle();
  groupDatabaseError(error);
  if (!data) throw new ApiError('Connect your Google Calendar in your account before joining.', 409);
}
export function requireReady(group: GroupPlan) {
  if (group.members.length < 2 || group.members.some(member => !member.userId || !member.preferences || !member.consent)) throw new ApiError('At least two people must join, share availability, and confirm preferences before finding a time.', 409);
}
export async function sharedBusy(group: GroupPlan): Promise<LiveWindow[]> {
  requireReady(group);
  // Each stored user ID came from a verified session accepting this specific hangout.
  const results = await Promise.all(group.members.map(async (member: GroupMember) => {
    try { return await calendarBusy(member.userId!, group.start, group.end, group.timeZone); }
    catch { throw new ApiError(`${member.name}’s availability could not be confirmed. Ask them to check their calendar connection, then retry.`, 503); }
  }));
  return results.flat();
}
export async function checkSelected(group: GroupPlan, selected: LiveWindow) {
  if (Date.parse(selected.start) <= Date.now()) throw new ApiError('That time has passed. Find a new shared time.', 409);
  const busy = await sharedBusy(group);
  if (busy.some(block => Date.parse(block.start) < Date.parse(selected.end) && Date.parse(block.end) > Date.parse(selected.start))) throw new ApiError('Someone’s calendar changed and this time is no longer free. Find a new shared time.', 409);
}
