import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GroupPlan } from '../groups';
function key() {
  const value = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Invitation signing is not configured.');
  return Buffer.from(value, 'hex');
}
export function invitationToken(group: GroupPlan) {
  return createHmac('sha256', key()).update(`synchro-invitation:v1:${group.id}:${group.inviteVersion ?? 'initial'}`).digest('hex');
}
export function validInvitationToken(group: GroupPlan, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(invitationToken(group), 'hex'));
}
