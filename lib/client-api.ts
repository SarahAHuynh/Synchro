export class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, method = 'GET', body?: unknown, headers?: Record<string, string>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method, credentials: 'same-origin', headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  } catch {
    throw new RequestError('Synchro could not reach the app server. Your changes are still here. Check your connection and that the app is running, then try saving again.', 0);
  }
  let data;
  try { data = await response.json(); } catch { throw new RequestError('The app server returned an unexpected response. Your changes are still here; please try again.', response.status); }
  if (!response.ok) throw new RequestError(data.error ?? 'Please try again.', response.status);
  return data as T;
}
