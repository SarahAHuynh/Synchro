import 'server-only';
export function authConfigured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.APP_URL); }
export function calendarConfigured() { return authConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && /^[a-f\d]{64}$/i.test(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY ?? '')); }
export function appOrigin() {
  const url = new URL(process.env.APP_URL ?? 'http://localhost:3000');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('APP_URL must use HTTPS outside localhost.');
  return url.origin;
}
