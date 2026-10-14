import type { Activity, Hangout, ParticipantAvailability, UserPreferences } from './types';
import { defaultPreferences } from './mock-data';
import { copyPreferences } from './validation';
import { datesInRange } from './planning';

export const demoActivities: Activity[] = [
  { id: 'games', name: 'A little friendly competition', description: 'Bring out a favorite board game, put on a playlist, and make an afternoon of it.', category: 'Games', setting: 'indoor', energyLevel: 'low', costPerPerson: 0, minDurationMinutes: 30, maxDurationMinutes: 240, distanceMiles: 0, tags: ['board games', 'cards', 'at home'] },
  { id: 'walk', name: 'A walk with no rush', description: 'Take an easy neighborhood loop. Leave room for a bench, a chat, and a change of direction.', category: 'Walking', setting: 'outdoor', energyLevel: 'low', costPerPerson: 0, minDurationMinutes: 30, maxDurationMinutes: 120, distanceMiles: 0, tags: ['walk', 'walking', 'relaxing'] },
  { id: 'picnic', name: 'Bring-a-little picnic', description: 'Everyone brings a snack. Find a patch of grass and settle into an unhurried catch-up.', category: 'Food', setting: 'outdoor', energyLevel: 'low', costPerPerson: 10, minDurationMinutes: 60, maxDurationMinutes: 180, distanceMiles: 1, tags: ['food', 'picnic', 'snacks'] },
  { id: 'coffee', name: 'Coffee & a proper catch-up', description: 'Make your favorite drinks at home and give the conversation your full attention.', category: 'Food', setting: 'indoor', energyLevel: 'low', costPerPerson: 5, minDurationMinutes: 30, maxDurationMinutes: 120, distanceMiles: 0, tags: ['coffee', 'tea', 'food', 'relaxing'] },
  { id: 'creative', name: 'Make something, together', description: 'Grab paper and pencils for a relaxed drawing session. No artistic talent required.', category: 'Creative activities', setting: 'indoor', energyLevel: 'low', costPerPerson: 0, minDurationMinutes: 30, maxDurationMinutes: 180, distanceMiles: 0, tags: ['drawing', 'art', 'crafts', 'creative'] },
  { id: 'movie', name: 'Your own little movie night', description: 'Pick a film from a service you already have, get comfortable, and press play together.', category: 'Movies', setting: 'indoor', energyLevel: 'low', costPerPerson: 0, minDurationMinutes: 120, maxDurationMinutes: 180, distanceMiles: 0, tags: ['movies', 'film', 'screens'] },
  { id: 'sports', name: 'A casual game at the park', description: 'Bring a ball for a friendly kickabout. Keep the score optional and the company good.', category: 'Sports', setting: 'outdoor', energyLevel: 'medium', costPerPerson: 0, minDurationMinutes: 30, maxDurationMinutes: 120, distanceMiles: 1, tags: ['sports', 'football', 'soccer'] },
  { id: 'relax', name: 'An afternoon to slow down', description: 'Bring a book or just yourself. Share a quiet hour and leave a little room to reconnect.', category: 'Relaxing activities', setting: 'indoor', energyLevel: 'low', costPerPerson: 0, minDurationMinutes: 30, maxDurationMinutes: 240, distanceMiles: 0, tags: ['relaxing', 'reading', 'books'] },
];

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
