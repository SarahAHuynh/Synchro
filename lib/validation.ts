import type { AccountFormData, HangoutFormData, UserPreferences } from './types';
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export function validateAccount(data: AccountFormData) {
  const errors: Record<string, string> = {};
  if (!data.name.trim()) errors.name = 'Let us know what to call you.';
  if (!isEmail(data.email)) errors.email = 'Enter an email like you@example.com.';
  if (data.password.length < 8) errors.password = 'Use at least 8 characters for your password.';
  if (data.confirm !== data.password || !data.confirm) errors.confirm = 'Your passwords should match. Try again.';
  return errors;
}
export function validateHangout(data: HangoutFormData, organizerEmail: string) {
  const errors: Record<string, string> = {};
  if (!data.name.trim()) errors.name = 'Give your hangout a name.';
  const emails = data.emails.map(email => email.trim().toLowerCase());
  if (!emails.length) errors.emails = 'Add at least one friend. Hangouts are for 2–10 people, including you.';
  else if (emails.some(email => !isEmail(email))) errors.emails = 'Enter a valid email for each friend.';
  else if (new Set(emails).size !== emails.length || emails.includes(organizerEmail.trim().toLowerCase())) errors.emails = 'Use a different email for each friend. You’re already included.';
  if (emails.length > 9) errors.emails = 'Keep it cozy: 10 people maximum, including you.';
  const start = Date.parse(data.start), end = Date.parse(data.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) errors.dates = 'Choose a start and end date.';
  else if (end < start) errors.dates = 'The end date should be on or after the start date.';
  else if ((end - start) / 86400000 > 13) errors.dates = 'Choose up to 14 calendar days, including the start and end dates.';
  if (!Number.isFinite(data.min) || !Number.isFinite(data.max) || data.min < 30 || data.max > 480 || data.min > data.max) errors.duration = 'Choose 30–480 minutes, with a maximum at least as long as the minimum.';
  return errors;
}
export function copyPreferences(preferences: UserPreferences): UserPreferences {
  return { ...preferences, categories: [...preferences.categories], dislikedActivities: [...preferences.dislikedActivities] };
}
export function applyHangoutPreferences(saved: UserPreferences, custom?: UserPreferences) { return copyPreferences(custom ?? saved); }
