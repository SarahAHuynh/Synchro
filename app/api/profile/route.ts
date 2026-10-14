import { ApiError, authenticated, failure, json, readBody, sameOrigin } from '@/lib/server/http';
import { validPreferences } from '@/lib/live-validation';
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await authenticated();
    const body = await readBody(request);
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 || !validPreferences(body.preferences)) throw new ApiError('Please check your name and preferences.', 400);
    const { error } = await client.from('profiles').upsert({ id: user.id, name: body.name.trim(), preferences: body.preferences, updated_at: new Date().toISOString() });
    if (error) throw new ApiError('Your preferences weren’t saved. Please try again.', 503);
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
