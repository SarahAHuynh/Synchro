import type { UserPreferences } from './types';
import { categories } from './mock-data';
export function validPreferences(value: unknown): value is UserPreferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.budgetPerPerson === 'number' && Number.isFinite(p.budgetPerPerson) && p.budgetPerPerson >= 0 && p.budgetPerPerson <= 150 &&
    ['low', 'medium', 'high'].includes(String(p.energyLevel)) && ['indoor', 'outdoor', 'either'].includes(String(p.setting)) &&
    Array.isArray(p.categories) && p.categories.length <= categories.length && p.categories.every(v => categories.includes(v)) &&
    ['30-60', '1-2-hours', '2-3-hours'].includes(String(p.duration)) &&
    Array.isArray(p.dislikedActivities) && p.dislikedActivities.length <= 30 && p.dislikedActivities.every(v => typeof v === 'string' && v.length <= 100) &&
    typeof p.maxDistanceMiles === 'number' && Number.isFinite(p.maxDistanceMiles) && p.maxDistanceMiles >= 1 && p.maxDistanceMiles <= 50;
}
export function validDateRange(start: unknown, end: unknown) {
  if (typeof start !== 'string' || typeof end !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  const first = Date.parse(`${start}T00:00:00Z`), last = Date.parse(`${end}T00:00:00Z`);
  return Number.isFinite(first) && Number.isFinite(last) && new Date(first).toISOString().slice(0,10) === start && new Date(last).toISOString().slice(0,10) === end && last >= first && last - first <= 13 * 86400000;
}
