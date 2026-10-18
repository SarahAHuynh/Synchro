import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { curateActivities } from '../lib/server/activity-recommender';
import { activityCatalog } from '../lib/activity-catalog';

const candidates = activityCatalog.slice(0, 4).map((activity, index) => ({ ...activity, score: 4 - index, matchReason: 'Fits everyone.' }));
const preferences = [{ budgetPerPerson: 30, energyLevel: 'medium' as const, setting: 'either' as const, categories: ['Games'], duration: '1-2-hours' as const, dislikedActivities: [], maxDistanceMiles: 10 }];

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  vi.stubGlobal('fetch', vi.fn());
});

describe('AI activity curation', () => {
  it('accepts only valid distinct catalog IDs and preserves the AI reasons', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ suggestions: [{ id: candidates[2].id, reason: 'A playful change of pace for this group.' }, { id: candidates[0].id, reason: 'A familiar favorite with room to chat.' }] }) }] }] }), { status: 200 }));
    const result = await curateActivities(candidates, preferences, { startMinutes: 1140, endMinutes: 1260, timeZone: 'America/Los_Angeles' });
    expect(result.usedAI).toBe(true);
    expect(result.activities.map(activity => activity.id)).toEqual([candidates[2].id, candidates[0].id]);
    expect(result.activities[0].matchReason).toBe('A playful change of pace for this group.');
  });

  it('uses the deterministic shortlist if the AI response is invalid', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({ suggestions: [{ id: 'invented-activity', reason: 'Not allowed.' }] }) }), { status: 200 }));
    const result = await curateActivities(candidates, preferences, { startMinutes: 1140, endMinutes: 1260, timeZone: 'America/Los_Angeles' });
    expect(result).toEqual({ activities: candidates.slice(0, 3), usedAI: false });
  });
});
