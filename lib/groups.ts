import type { ActivitySuggestion, UserPreferences } from './types';
import type { LiveWindow } from './live-availability';
import { dateInZone, validTimeZone, zonedTime } from './live-availability';
import { validDateRange } from './live-validation';
import { isEmail } from './validation';
export type GroupMember = { email: string; userId: string | null; name: string; preferences: UserPreferences | null; consent: boolean };
export type AttendanceRequest = {id:string;userId:string;name:string;kind:'cannot-attend'|'reschedule';reason:string;status:'pending'|'removed'|'rescheduling'|'declined';createdAt:string;responseReason?:string};
export type GroupPlan = {
  cancellationReason?:string; attendanceRequests?:AttendanceRequest[];
  id: string; calendarRevision?: string; inviteVersion?: string; organizerId: string; name: string; description: string; start: string; end: string; timeZone: string;
  min: number; max: number; members: GroupMember[]; status: 'planning' | 'voting' | 'confirmed' | 'cancelled';
  windows: LiveWindow[]; checkedAt: string | null; selected: LiveWindow | null; activities: ActivitySuggestion[]; activitiesAiCurated?: boolean;
  votes: Record<string, string>; confirmedActivityId: string | null; createdAt: string;
};
export type CalendarSyncStatus = {scheduled:number;pending:number;failed:number;removing:number;needsReconnect:boolean;unavailable?:boolean};
export type GroupView = Omit<GroupPlan, 'members' | 'inviteVersion'> & { members: { email: string; name: string; joined: boolean; ready: boolean; isYou: boolean; isOrganizer:boolean; voted: boolean }[]; calendarSync?: CalendarSyncStatus; organizerName: string; myPreferences: UserPreferences | null; isOrganizer: boolean; invitation: boolean; myVote: string | null; counts: Record<string, number>; allVoted: boolean; winnerIds: string[]; inviteUrl: string };
export type GroupSummary = { attention?:string; attentionKey?:string; cancellationReason?:string; isOrganizer:boolean; id: string; name: string; status: GroupPlan['status']; start: string; invitation: boolean; count: number; end?: string; min?: number; max?: number; selected?: LiveWindow | null; timeZone?: string; confirmedActivityId?: string | null };
export function normalizeEmails(value: unknown, ownEmail: string): string[] | null {
  if (!Array.isArray(value) || value.length > 9 || value.some(email => typeof email !== 'string' || email.length > 254 || !isEmail(email))) return null;
  const emails = value.map(email => (email as string).trim().toLowerCase());
  if (new Set(emails).size !== emails.length || emails.includes(ownEmail.toLowerCase())) return null;
  return emails;
}
export function validGroupInput(body: Record<string, unknown>, now = Date.now()) {
  return typeof body.name === 'string' && !!body.name.trim() && body.name.length <= 100 &&
    typeof body.description === 'string' && body.description.length <= 1000 && validDateRange(body.start, body.end) &&
    typeof body.timeZone === 'string' && validTimeZone(body.timeZone) &&
    (body.start as string) >= dateInZone(now, body.timeZone) && zonedTime(body.start as string, 0, body.timeZone) <= now + 366 * 86400000 &&
    typeof body.min === 'number' && Number.isInteger(body.min) && body.min >= 30 && typeof body.max === 'number' && Number.isInteger(body.max) && body.max >= body.min && body.max <= 480;
}
export function resetPlan(group: GroupPlan) {
  group.status = 'planning'; group.windows = []; group.checkedAt = null; group.selected = null; group.activities = []; group.activitiesAiCurated = false; group.votes = {}; group.confirmedActivityId = null;
}
export function groupTally(group: GroupPlan) {
  const counts = Object.fromEntries(group.activities.map(activity => [activity.id, 0]));
  let total = 0;
  for (const member of group.members) { const vote = member.userId ? group.votes[member.userId] : null; if (vote && Object.hasOwn(counts, vote)) { counts[vote]++; total++; } }
  const max = Math.max(0, ...Object.values(counts));
  return { counts, allVoted: group.members.length >= 2 && total === group.members.length, winnerIds: Object.keys(counts).filter(id => max > 0 && counts[id] === max) };
}
export function groupView(group: GroupPlan, userId: string, origin: string, token?: string): GroupView {
  const member = group.members.find(item => item.userId === userId);
  const { inviteVersion: _version, attendanceRequests, ...publicGroup } = group;
  void _version;
  return { ...publicGroup, attendanceRequests: attendanceRequests?.filter(request=>group.organizerId===userId||request.userId===userId), organizerName: group.members.find(item => item.userId === group.organizerId)?.name ?? 'Your organizer', votes: {}, members: group.members.map(item => ({ email: item.email, name: item.name, joined: !!item.userId, ready: !!item.userId && item.consent && !!item.preferences, isYou: item.userId === userId, isOrganizer:item.userId===group.organizerId, voted: !!(item.userId && group.votes[item.userId]) })), myPreferences: member?.preferences ?? null, isOrganizer: group.organizerId === userId, invitation: !member, myVote: group.votes[userId] ?? null, ...groupTally(group), counts:{}, winnerIds:group.organizerId===userId&&groupTally(group).allVoted?groupTally(group).winnerIds:[], inviteUrl: group.organizerId === userId ? `${origin}/hangouts/${group.id}${token ? `?invite=${token}` : ''}` : '' };
}

export function groupAttention(group:GroupPlan,userId:string):string|undefined {
 if(group.status==='cancelled')return;
 const member=group.members.find(m=>m.userId===userId),owner=group.organizerId===userId;
 if(!member)return 'Accept invitation';
 if(owner&&group.attendanceRequests?.some(r=>r.status==='pending'))return 'Review attendance request';
 if(!member.consent)return 'Confirm new dates';
 if(group.status==='voting') {if(!group.votes[userId])return 'Cast your vote';if(owner&&groupTally(group).allVoted)return 'Confirm the hangout';}
 if(!owner&&group.attendanceRequests?.some(r=>r.userId===userId&&r.status!=='pending'))return 'Review organizer response';
 if(group.status==='planning'&&owner&&group.members.length>=2&&group.members.every(m=>m.userId&&m.consent&&m.preferences))return 'Choose a time';
}
