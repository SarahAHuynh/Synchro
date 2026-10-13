export type UserPreferences = {
  budgetPerPerson: number;
  energyLevel: 'low' | 'medium' | 'high';
  setting: 'indoor' | 'outdoor' | 'either';
  categories: string[];
  duration: '30-60' | '1-2-hours' | '2-3-hours';
  dislikedActivities: string[];
  maxDistanceMiles: number;
};
export type DateRange = { start: string; end: string };
export type User = { id: string; name: string; email: string; preferences: UserPreferences; calendarStatus: 'not-connected' | 'connecting' | 'connected' };
export type Hangout = {
  id: string;
  name: string;
  organizerId: string;
  participantIds: string[];
  dateRangeStart: string;
  dateRangeEnd: string;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  status: 'draft' | 'awaiting-preferences' | 'finding-time' | 'voting' | 'confirmed';
  description?: string;
  preferencesByParticipant?: Record<string, UserPreferences>;
};
export type HangoutFormData = { name: string; emails: string[]; start: string; end: string; min: number; max: number; description: string };
export type AccountFormData = { name: string; email: string; password: string; confirm: string };
