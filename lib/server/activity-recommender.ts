import 'server-only';
import type { ActivitySuggestion } from '@/lib/types';
import type { UserPreferences } from '@/lib/types';

type Curation = { activities: ActivitySuggestion[]; usedAI: boolean };
type CuratedSuggestion = { id: string; reason: string };
type SelectedTime = { startMinutes: number; endMinutes: number; timeZone: string };
const schema = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, reason: { type: 'string' } },
        required: ['id', 'reason'], additionalProperties: false,
      },
    },
  },
  required: ['suggestions'], additionalProperties: false,
};

function fallback(activities: ActivitySuggestion[]): Curation {
  return { activities: activities.slice(0, 3), usedAI: false };
}

function outputText(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null;
  const value = response as { output_text?: unknown; output?: { content?: { type?: unknown; text?: unknown }[] }[] };
  if (typeof value.output_text === 'string') return value.output_text;
  const text = value.output?.flatMap(item => item.content ?? []).filter(item => item.type === 'output_text' && typeof item.text === 'string').map(item => item.text as string).join('');
  return text || null;
}

function validSuggestions(value: unknown, candidates: ActivitySuggestion[]): CuratedSuggestion[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { suggestions?: unknown }).suggestions)) return [];
  const eligible = new Set(candidates.map(activity => activity.id));
  const used = new Set<string>();
  return (value as { suggestions: unknown[] }).suggestions.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const { id, reason } = item as { id?: unknown; reason?: unknown };
    if (typeof id !== 'string' || !eligible.has(id) || used.has(id) || typeof reason !== 'string') return [];
    const trimmed = reason.trim().slice(0, 240);
    if (!trimmed) return [];
    used.add(id);
    return [{ id, reason: trimmed }];
  }).slice(0, 3);
}

export async function curateActivities(candidates: ActivitySuggestion[], preferences: UserPreferences[], selectedTime: SelectedTime): Promise<Curation> {
  if (!process.env.OPENAI_API_KEY || !candidates.length) return fallback(candidates);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-6-luna', reasoning: { effort: 'none' }, max_output_tokens: 500,
        input: [
          { role: 'system', content: 'You curate varied, practical hangout ideas. Choose only from the candidate activities. Never invent activities, venues, prices, or constraints. The candidate list has already been filtered for the selected local time; respect it. Some candidates may be compromise picks: explain them honestly and never claim they fit everyone. Select up to three distinct options, balancing familiar group interests with at least one fresh option when possible. Give each a warm, specific reason of at most 35 words.' },
          { role: 'user', content: JSON.stringify({ selectedLocalTime: selectedTime, groupPreferences: preferences.map(({ budgetPerPerson, energyLevel, setting, categories, duration, dislikedActivities, maxDistanceMiles }) => ({ budgetPerPerson, energyLevel, setting, categories, duration, dislikedActivities, maxDistanceMiles })), candidates: candidates.map(({ id, name, description, category, setting, energyLevel, costPerPerson, tags, timeOfDay, matchReason }) => ({ id, name, description, category, setting, energyLevel, costPerPerson, tags, timeOfDay, fitNote: matchReason })) }) },
        ],
        text: { format: { type: 'json_schema', name: 'activity_curation', strict: true, schema } },
      }),
      cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return fallback(candidates);
    const text = outputText(await response.json());
    if (!text) return fallback(candidates);
    const suggestions = validSuggestions(JSON.parse(text), candidates);
    if (!suggestions.length) return fallback(candidates);
    const byId = new Map(candidates.map(activity => [activity.id, activity]));
    return { activities: suggestions.map((suggestion, index) => ({ ...byId.get(suggestion.id)!, score: suggestions.length - index, matchReason: suggestion.reason })), usedAI: true };
  } catch {
    return fallback(candidates);
  }
}
