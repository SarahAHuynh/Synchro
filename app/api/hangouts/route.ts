import { randomUUID } from 'node:crypto';
import { ApiError, authenticated, failure, json, readBody, sameOrigin } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
import { groupDatabaseError, requireConnection, verifiedEmail } from '@/lib/server/groups';
import { groupAttention, normalizeEmails, validGroupInput } from '@/lib/groups';
import type { GroupPlan } from '@/lib/groups';
import { validPreferences } from '@/lib/live-validation';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const { user } = await authenticated(); const email = verifiedEmail(user);
    const { data, error } = await adminClient().from('hangout_groups').select('document').contains('invite_emails', [email]).order('created_at', { ascending: false }).limit(100);
    groupDatabaseError(error);
    return json({ groups: (data ?? []).map(row => { const g = row.document as GroupPlan; return { attention:groupAttention(g,user.id),attentionKey:`${groupAttention(g,user.id)}:${g.checkedAt??g.createdAt}:${g.start}:${g.end}:${(g.attendanceRequests??[]).map(r=>r.id+':'+r.status).join(',')}`, cancellationReason:g.cancellationReason,isOrganizer:g.organizerId===user.id, id: g.id, name: g.name, start: g.start, status: g.status, count: g.members.length, end: g.end, min: g.min, max: g.max, selected: g.selected, timeZone: g.timeZone, confirmedActivityId: g.confirmedActivityId, invitation: !g.members.some(item => item.userId === user.id) }; }) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); const { user, client } = await authenticated(); const email = verifiedEmail(user); const body = await readBody(request);
    const emails = normalizeEmails(body.emails, email);
    if (!emails || !validGroupInput(body) || body.consent !== true) throw new ApiError('Check the dates, duration, and guest emails, and agree to share availability for this hangout.', 400);
    const { data: profile, error } = await client.from('profiles').select('name, preferences').eq('id', user.id).maybeSingle();
    groupDatabaseError(error);
    if (!profile || !validPreferences(profile.preferences)) throw new ApiError('Save your account preferences before creating a hangout.', 409);
    await requireConnection(user.id);
    const group: GroupPlan = { id: randomUUID(), organizerId: user.id, name: (body.name as string).trim(), description: (body.description as string).trim(), start: body.start as string, end: body.end as string, timeZone: body.timeZone as string, min: body.min as number, max: body.max as number, members: [{ email, userId: user.id, name: profile.name, preferences: profile.preferences, consent: true }, ...emails.map(email => ({ email, userId: null, name: email.split('@')[0], preferences: null, consent: false }))], status: 'planning', windows: [], checkedAt: null, selected: null, activities: [], votes: {}, confirmedActivityId: null, createdAt: new Date().toISOString() };
    const { error: insertError } = await adminClient().from('hangout_groups').insert({ id: group.id, invite_emails: group.members.map(member => member.email), document: group });
    groupDatabaseError(insertError);
    return json({ id: group.id }, 201);
  } catch (error) { return failure(error); }
}
