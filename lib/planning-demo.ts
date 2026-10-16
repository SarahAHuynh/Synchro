import type { Hangout, ParticipantAvailability, UserPreferences } from './types';
import { defaultPreferences } from './mock-data';
import { copyPreferences } from './validation';
import { datesInRange } from './planning';

export { activityCatalog as demoActivities } from './activity-catalog';

/** Deliberately synthetic calendars; no network requests or real event data. */
export function buildDemoCalendars(hangout: Hangout): ParticipantAvailability[] {
  return hangout.participantIds.map((participantId, index) => ({
    participantId,
    busyByDate: Object.fromEntries(datesInRange(hangout.dateRangeStart, hangout.dateRangeEnd).map((date, day) => [date,
      hangout.demoScenario === 'busy'
        ? [{ startMinutes: 540, endMinutes: 1260 }]
        : [
          { startMinutes: 540, endMinutes: 660 + index % 3 * 30 },
          { startMinutes: 840 + day % 2 * 30, endMinutes: 960 + index % 2 * 30 },
          { startMinutes: 1140, endMinutes: 1260 },
        ],
    ])),
  }));
}

/** The current user's submitted preferences are real demo input; others are fixtures. */
export function getGroupPreferences(hangout: Hangout, userId: string, saved: UserPreferences): UserPreferences[] {
  return hangout.participantIds.map((id, index) => {
    if (hangout.preferencesByParticipant?.[id]) return copyPreferences(hangout.preferencesByParticipant[id]);
    if (id === userId) return copyPreferences(saved);
    return { ...copyPreferences(defaultPreferences), budgetPerPerson: 15 + index % 3 * 5, categories: index % 2 ? ['Food', 'Games', 'Movies'] : ['Walking', 'Creative activities', 'Relaxing activities'] };
  });
}
