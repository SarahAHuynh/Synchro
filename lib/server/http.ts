import 'server-only';
import { NextResponse } from 'next/server';
import { appOrigin, authConfigured } from './config';
import { sessionClient } from './supabase';
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private', 'Vary': 'Cookie' } }); }
export function failure(error: unknown) { return json({ error: error instanceof ApiError ? error.message : 'We couldn’t complete that request. Please try again.' }, error instanceof ApiError ? error.status : 500); }
export function sameOrigin(request: Request) { if (request.headers.get('origin') !== appOrigin()) throw new ApiError('Please make this request from Synchro.', 403); }
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError('Send a JSON request.', 400);
  const text = await request.text();
  if (text.length > 20000) throw new ApiError('That request is too large.', 413);
  try { const value: unknown = JSON.parse(text); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>; }
  catch { throw new ApiError('Please check the form and try again.', 400); }
}
export async function authenticated() {
  if (!authConfigured()) throw new ApiError('Account services are not configured yet.', 503);
  const client = await sessionClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ApiError('Please sign in to continue.', 401);
  return { client, user: data.user };
}
