import { describe, expect, it } from 'vitest';
import { applyHangoutPreferences, copyPreferences, validateAccount, validateHangout } from '../lib/validation';
import { defaultPreferences } from '../lib/mock-data';
import type { HangoutFormData } from '../lib/types';
const valid: HangoutFormData = { name: 'Sunday catch-up', emails: ['jamie@example.com'], start: '2026-10-17', end: '2026-10-30', min: 60, max: 120, description: '' };
const validate = (patch: Partial<HangoutFormData> = {}) => validateHangout({ ...valid, ...patch }, 'alex@example.com');
describe('account validation', () => {
  it('accepts a complete account', () => expect(validateAccount({ name: 'Alex', email: 'alex@example.com', password: 'password123', confirm: 'password123' })).toEqual({}));
  it('provides friendly errors for missing or mismatched values', () => expect(Object.keys(validateAccount({ name: ' ', email: 'oops', password: 'short', confirm: 'different' }))).toEqual(['name', 'email', 'password', 'confirm']));
});
describe('hangout validation', () => {
  it('accepts a 14-day inclusive date window', () => expect(validate()).toEqual({}));
  it('accepts one calendar day', () => expect(validate({ end: valid.start })).toEqual({}));
  it('rejects missing names, missing participants, and invalid emails', () => {
    expect(validate({ name: ' ' })).toHaveProperty('name');
    expect(validate({ emails: [] })).toHaveProperty('emails');
    expect(validate({ emails: ['invalid'] })).toHaveProperty('emails');
  });
  it('counts the organizer in the 10-person maximum', () => {
    expect(validate({ emails: Array.from({ length: 9 }, (_, i) => `friend${i}@example.com`) })).toEqual({});
    expect(validate({ emails: Array.from({ length: 10 }, (_, i) => `friend${i}@example.com`) })).toHaveProperty('emails');
  });
  it('rejects duplicate participants and the organizer email case-insensitively', () => {
    expect(validate({ emails: ['Jamie@example.com', 'jamie@example.com'] })).toHaveProperty('emails');
    expect(validate({ emails: [' ALEX@example.com '] })).toHaveProperty('emails');
  });
  it('rejects missing, reversed, or overly long date windows', () => {
    expect(validate({ start: '' })).toHaveProperty('dates');
    expect(validate({ end: '2026-10-16' })).toHaveProperty('dates');
    expect(validate({ end: '2026-10-31' })).toHaveProperty('dates');
  });
  it('rejects invalid durations', () => {
    expect(validate({ min: 120, max: 60 })).toHaveProperty('duration');
    expect(validate({ min: 0 })).toHaveProperty('duration');
    expect(validate({ max: 481 })).toHaveProperty('duration');
    expect(validate({ min: NaN })).toHaveProperty('duration');
  });
});
describe('preferences', () => {
  it('keeps a snapshot of saved preferences for a hangout', () => {
    const saved = copyPreferences(defaultPreferences);
    const result = applyHangoutPreferences(saved);
    expect(result).toEqual(saved);
    result.categories.push('Sports');
    expect(saved.categories).not.toContain('Sports');
  });
  it('customizes a hangout without changing the permanent profile', () => {
    const saved = copyPreferences(defaultPreferences);
    const custom = { ...copyPreferences(saved), budgetPerPerson: 50, categories: ['Movies'], dislikedActivities: ['Hiking'] };
    const result = applyHangoutPreferences(saved, custom);
    result.dislikedActivities.push('Karaoke');
    expect(saved).toEqual(defaultPreferences);
    expect(result.budgetPerPerson).toBe(50);
    expect(custom.dislikedActivities).toEqual(['Hiking']);
  });
});
