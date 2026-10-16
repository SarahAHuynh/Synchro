import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
let failed = false;
function report(name, ok, detail = '') {
  console.log(`${ok ? 'OK' : 'NEEDS ATTENTION'}: ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed = true;
}
const required = ['APP_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'CALENDAR_TOKEN_ENCRYPTION_KEY'];
for (const name of required) report(name, Boolean(process.env[name]), process.env[name] ? 'set (value hidden)' : 'missing from .env.local');
report('Calendar encryption key', /^[a-f\d]{64}$/i.test(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY ?? ''), 'must be 64 hexadecimal characters');
let base;
try { base = new URL(process.env.SUPABASE_URL); report('Supabase URL', base.protocol === 'https:' && base.hostname.endsWith('.supabase.co')); } catch { report('Supabase URL', false, 'enter the HTTPS project URL from Supabase Connect'); }
try { const app = new URL(process.env.APP_URL); report('App address', app.origin === process.env.APP_URL && (app.protocol === 'https:' || (app.protocol === 'http:' && ['localhost','127.0.0.1'].includes(app.hostname))), 'use the exact browser origin, without a trailing slash'); } catch { report('App address', false, 'invalid APP_URL'); }
if (!failed && !process.argv.includes('--offline')) {
  for (const [name, path, key] of [
    ['Auth providers', '/auth/v1/settings', process.env.SUPABASE_PUBLISHABLE_KEY],
    ['Profiles table', '/rest/v1/profiles?select=id&limit=0', process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['Calendar table', '/rest/v1/calendar_connections?select=user_id&limit=0', process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['Attendance notifications', '/rest/v1/hangout_notifications?select=id&limit=0', process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['Calendar events queue', '/rest/v1/calendar_event_jobs?select=event_id&limit=0', process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['Phase 4 hangout table', '/rest/v1/hangout_groups?select=id,document,invite_emails,revision&limit=0', process.env.SUPABASE_SERVICE_ROLE_KEY],
  ]) {
    try {
      const response = await fetch(new URL(path, base), { headers: { apikey: key }, signal: AbortSignal.timeout(10000) });
      report(name, response.ok, response.ok ? 'reachable' : `HTTP ${response.status}; check keys and run the required migrations`);
      if (response.ok && name === 'Auth providers') { const data = await response.json(); report('Google sign-in provider', data.external?.google === true); report('Email sign-in provider', data.external?.email === true); console.log('Email confirmation required: ' + (typeof data.mailer_autoconfirm === 'boolean' ? String(!data.mailer_autoconfirm) : 'unknown'));  }
    } catch { report(name, false, 'cannot reach Supabase; check the project URL and network'); }
  }
  try {
    const response = await fetch(new URL('/rest/v1/hangout_groups?select=id&limit=0', base), { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000) });
    report('Group table blocks anonymous access', [401,403].includes(response.status));
  } catch { report('Group table access check', false, 'could not reach Supabase'); }
}
console.log('\nNo account data or secret values were printed. This does not test Google consent.');
console.log('Next: open /account, sign in, connect Google Calendar, and check a known busy date.');
process.exitCode = failed ? 1 : 0;
