import { describe, expect, it } from 'vitest';
import { canConfirmPlan, datesInRange, findSharedTimes, recommendActivities, tallyVotes } from '../lib/planning';
import { buildDemoCalendars, demoActivities, getGroupPreferences } from '../lib/planning-demo';
import { defaultPreferences, sampleHangout } from '../lib/mock-data';
import { copyPreferences } from '../lib/validation';
import type { Hangout, ParticipantAvailability, TimeSlot } from '../lib/types';
const plan: Hangout = { ...sampleHangout, participantIds: ['me', 'friend'], dateRangeStart: '2026-10-17', dateRangeEnd: '2026-10-17', minDurationMinutes: 60, maxDurationMinutes: 120 };
const slot: TimeSlot = { id: 'slot', date: '2026-10-17', startMinutes: 720, endMinutes: 840 };
const calendars: ParticipantAvailability[] = [
  { participantId: 'me', busyByDate: { '2026-10-17': [{ startMinutes: 540, endMinutes: 720 }, { startMinutes: 840, endMinutes: 1260 }] } },
  { participantId: 'friend', busyByDate: { '2026-10-17': [{ startMinutes: 540, endMinutes: 690 }, { startMinutes: 900, endMinutes: 1260 }] } },
];
describe('shared availability', () => {
  it('intersects all participants and honors the selected range and duration', () => {
    expect(findSharedTimes(plan, calendars)).toEqual([{ ...slot, id: '2026-10-17-720-840' }]);
    expect(findSharedTimes({ ...plan, maxDurationMinutes: 90 }, calendars)[0].endMinutes).toBe(810);
    expect(findSharedTimes({ ...plan, minDurationMinutes: 150, maxDurationMinutes: 180 }, calendars)).toEqual([]);
  });
  it('does not mistake nested busy intervals for free time', () => {
    const nested = [{ participantId: 'me', busyByDate: { '2026-10-17': [{ startMinutes: 540, endMinutes: 1000 }, { startMinutes: 600, endMinutes: 630 }, { startMinutes: 900, endMinutes: 1260 }] } }];
    expect(findSharedTimes({ ...plan, participantIds: ['me'] }, nested)).toEqual([]);
  });
  it('requires known availability for every participant on each day', () => {
    expect(findSharedTimes(plan, calendars.slice(0, 1))).toEqual([]);
    expect(findSharedTimes(plan, [{ ...calendars[0], busyByDate: {} }, calendars[1]])).toEqual([]);
  });
  it('treats explicit empty busy data as free, with no time outside daytime bounds', () => {
    const slots = findSharedTimes({ ...plan, participantIds: ['me'] }, [{ participantId: 'me', busyByDate: { '2026-10-17': [] } }]);
    expect(slots[0]).toMatchObject({ startMinutes: 540, endMinutes: 660 });
  });
  it('supports 14 inclusive dates across a daylight-saving boundary', () => {
    expect(datesInRange('2026-10-25', '2026-11-07')).toHaveLength(14);
    expect(datesInRange('2026-10-25', '2026-11-08')).toEqual([]);
    expect(datesInRange('2026-10-25', '2026-10-24')).toEqual([]);
  });
  it('provides a deterministic normal scenario and a genuine no-overlap scenario', () => {
    expect(findSharedTimes(plan, buildDemoCalendars(plan)).length).toBeGreaterThan(0);
    const busy: Hangout = { ...plan, demoScenario: 'busy' };
    expect(findSharedTimes(busy, buildDemoCalendars(busy))).toEqual([]);
  });
});
describe('recommendations after selecting time', () => {
  it('honors every person’s budget, energy, travel distance, and setting', () => {
    const strict = { ...copyPreferences(defaultPreferences), budgetPerPerson: 0, energyLevel: 'low' as const, setting: 'indoor' as const, maxDistanceMiles: 1 };
    const options = recommendActivities(demoActivities, [defaultPreferences, strict], slot);
    expect(options.length).toBeGreaterThan(0);
    for (const activity of options) {
      expect(activity.costPerPerson).toBe(0);
      expect(activity.energyLevel).toBe('low');
      expect(activity.setting).toBe('indoor');
      expect(activity.distanceMiles).toBeLessThanOrEqual(1);
    }
  });
  it('does not silently relax dislikes or conflicting settings', () => {
    const dislikes = { ...copyPreferences(defaultPreferences), dislikedActivities: ['GAMES', 'coffee'] };
    const ids = recommendActivities(demoActivities, [dislikes], slot).map(activity => activity.id);
    expect(ids).not.toContain('games'); expect(ids).not.toContain('coffee');
    expect(recommendActivities(demoActivities, [{ ...defaultPreferences, setting: 'indoor' }, { ...defaultPreferences, setting: 'outdoor' }], slot)).toEqual([]);
  });
  it('excludes activities too long or too short for the selected time', () => {
    expect(recommendActivities(demoActivities, [defaultPreferences], { ...slot, endMinutes: 750 }).map(activity => activity.id)).not.toContain('movie');
    expect(recommendActivities(demoActivities, [defaultPreferences], { ...slot, endMinutes: 1200 })).toEqual([]);
  });
  it('uses hangout preference snapshots without mutating a profile', () => {
    const current = copyPreferences(defaultPreferences);
    const profile = copyPreferences(defaultPreferences);
    const group = getGroupPreferences({ ...plan, preferencesByParticipant: { me: { ...profile, budgetPerPerson: 0 } } }, 'me', current);
    group[0].categories.push('New category');
    expect(group[0].budgetPerPerson).toBe(0);
    expect(current).toEqual(defaultPreferences);
    expect(profile).toEqual(defaultPreferences);
  });
});
describe('group voting', () => {
  it('counts at most one valid vote for each participant and exposes ties', () => {
    const votes = { me: 'games', friend: 'coffee', stranger: 'games' };
    const result = tallyVotes(demoActivities, plan.participantIds, votes);
    expect(result.total).toBe(2);
    expect(result.winnerIds.sort()).toEqual(['coffee', 'games']);
    expect(tallyVotes(demoActivities, plan.participantIds, { me: 'unknown' }).total).toBe(0);
    expect(tallyVotes(demoActivities, ['me', 'me'], votes).total).toBe(1);
  });
  it('requires a time and all votes, then only lets a leading activity be confirmed', () => {
    const voting: Hangout = { ...plan, status: 'voting', selectedTime: slot, activityVotes: { me: 'games' } };
    expect(canConfirmPlan(voting, demoActivities, 'games')).toBe(false);
    voting.activityVotes!.friend = 'games';
    expect(canConfirmPlan(voting, demoActivities, 'games')).toBe(true);
    expect(canConfirmPlan(voting, demoActivities, 'coffee')).toBe(false);
    expect(canConfirmPlan({ ...voting, selectedTime: undefined }, demoActivities, 'games')).toBe(false);
    expect(canConfirmPlan({ ...voting, status: 'confirmed' }, demoActivities, 'games')).toBe(false);
  });
});
