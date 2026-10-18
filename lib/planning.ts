import type { Activity, ActivitySuggestion, Hangout, ParticipantAvailability, TimeSlot, UserPreferences } from './types';

/** Date-only arithmetic uses UTC to avoid skipping a day at DST boundaries. */
export function datesInRange(start: string, end: string): string[] {
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last - first > 13 * 86400000) return [];
  return Array.from({ length: (last - first) / 86400000 + 1 }, (_, index) => new Date(first + index * 86400000).toISOString().slice(0, 10));
}

/** Find non-overlapping shared windows between 9am and 9pm in demo local time. */
export function findSharedTimes(hangout: Hangout, calendars: ParticipantAvailability[]): TimeSlot[] {
  const participants = [...new Set(hangout.participantIds)];
  if (!participants.length || participants.some(id => !calendars.some(calendar => calendar.participantId === id))) return [];
  if (hangout.minDurationMinutes < 30 || hangout.maxDurationMinutes < hangout.minDurationMinutes || hangout.maxDurationMinutes > 480) return [];
  const days = datesInRange(hangout.dateRangeStart, hangout.dateRangeEnd);
  const slots: TimeSlot[] = [];
  for (const date of days) {
    // Missing calendar data is unknown, never assumed to mean free.
    if (participants.some(id => !calendars.find(calendar => calendar.participantId === id)?.busyByDate[date])) continue;
    const busy = participants.flatMap(id => calendars.find(calendar => calendar.participantId === id)!.busyByDate[date])
      .filter(window => window.endMinutes > 540 && window.startMinutes < 1260)
      .sort((a, b) => a.startMinutes - b.startMinutes);
    let cursor = 540;
    const addWindow = (start: number, end: number) => {
      const roundedStart = Math.ceil(start / 30) * 30;
      const duration = Math.min(end - roundedStart, hangout.maxDurationMinutes);
      if (duration >= hangout.minDurationMinutes) slots.push({ id: `${date}-${roundedStart}-${roundedStart + duration}`, date, startMinutes: roundedStart, endMinutes: roundedStart + duration });
    };
    for (const window of busy) {
      if (window.startMinutes > cursor) addWindow(cursor, Math.min(window.startMinutes, 1260));
      cursor = Math.max(cursor, window.endMinutes);
      if (cursor >= 1260) break;
    }
    if (cursor < 1260) addWindow(cursor, 1260);
  }
  return slots;
}

export function recommendActivities(activities: Activity[], preferences: UserPreferences[], slot: TimeSlot): ActivitySuggestion[] {
  if (!preferences.length) return [];
  const energy = { low: 0, medium: 1, high: 2 };
  const period = slot.startMinutes >= 18 * 60 || slot.endMinutes > 20 * 60 ? 'evening' : 'daylight';
  const length = slot.endMinutes - slot.startMinutes;
  const explicitlyDisliked = (activity: Activity, person: UserPreferences) => person.dislikedActivities.some(dislike => {
    const term = dislike.trim().toLowerCase();
    return term.length > 0 && [activity.name, activity.category, ...activity.tags].some(label => label.toLowerCase().includes(term));
  });
  const fitsPerson = (activity: Activity, person: UserPreferences) =>
    activity.costPerPerson <= person.budgetPerPerson &&
    activity.distanceMiles <= person.maxDistanceMiles &&
    (person.setting === 'either' || person.setting === activity.setting) &&
    energy[activity.energyLevel] <= energy[person.energyLevel] &&
    !explicitlyDisliked(activity, person);
  const timeCompatible = activities.filter(activity =>
    (!activity.timeOfDay || activity.timeOfDay.includes(period)) && activity.minDurationMinutes <= length && activity.maxDurationMinutes >= length
  );
  const toSuggestion = (activity: Activity, matches: number, compromise: boolean): ActivitySuggestion => {
    const fans = preferences.filter(person => person.categories.includes(activity.category)).length;
    const rotation = [...`${slot.id}:${activity.id}`].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 1000, 0) / 1000;
    const score = matches * 100 + fans * 10 + (activity.costPerPerson === 0 ? 1 : 0) + rotation;
    const fit = compromise ? `A compromise pick that fits ${matches} of ${preferences.length} people’s budget, pace, setting, and travel preferences.` : fans ? `${fans} of ${preferences.length} people enjoy ${activity.category.toLowerCase()}. Fits everyone’s budget, pace, setting, and available time.` : 'Fits everyone’s budget, pace, setting, and available time. A little something new.';
    return { ...activity, score, matchReason: fit };
  };
  const strict = timeCompatible.filter(activity => preferences.every(person => fitsPerson(activity, person)));
  if (strict.length) return strict.map(activity => toSuggestion(activity, preferences.length, false)).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return timeCompatible
    .filter(activity => !preferences.some(person => explicitlyDisliked(activity, person)))
    .map(activity => ({ activity, matches: preferences.filter(person => fitsPerson(activity, person)).length }))
    .filter(({ matches }) => matches > 0)
    .map(({ activity, matches }) => toSuggestion(activity, matches, true))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function tallyVotes(activities: Activity[], participantIds: string[], votes: Record<string, string>) {
  const counts = Object.fromEntries(activities.map(activity => [activity.id, 0]));
  let total = 0;
  for (const id of new Set(participantIds)) {
    const choice = votes[id];
    if (choice && Object.hasOwn(counts, choice)) { counts[choice] += 1; total += 1; }
  }
  const max = Math.max(0, ...Object.values(counts));
  return { counts, total, winnerIds: max > 0 ? activities.filter(activity => counts[activity.id] === max).map(activity => activity.id) : [] };
}

export function canConfirmPlan(hangout: Hangout, activities: Activity[], activityId: string): boolean {
  if (!hangout.selectedTime || hangout.status !== 'voting') return false;
  const tally = tallyVotes(activities, hangout.participantIds, hangout.activityVotes ?? {});
  return tally.total === new Set(hangout.participantIds).size && tally.winnerIds.includes(activityId);
}

export function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
export function formatSlot(slot: TimeSlot): string {
  const date = new Date(`${slot.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date} · ${formatTime(slot.startMinutes)}–${formatTime(slot.endMinutes)}`;
}
export function participantName(id: string, userId: string, userName: string): string {
  return id === userId ? `${userName.split(' ')[0]} (you)` : id.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
