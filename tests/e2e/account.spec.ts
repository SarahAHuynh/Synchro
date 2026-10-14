import { expect, test } from '@playwright/test';
import { defaultPreferences } from '../../lib/mock-data';

test('unconfigured account services never imply a real connection', async ({ page }) => {
  await page.route('**/api/auth', route => route.fulfill({ json: { configured: false, calendarConfigured: false, user: null } }));
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Your real space is coming together.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Google Calendar' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Explore the demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make time for your people.' })).toBeVisible();
});

test('live account UI handles real-service responses, saved preferences, and reconnect errors', async ({ page }) => {
  // Contract test only: this does not substitute for a real Google/Supabase acceptance test.
  let connected = false;
  let signedIn = false;
  let saved = false;
  const requests: string[] = [];
  await page.route('**/api/auth', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      if (body.action === 'signin') signedIn = true;
      if (body.action === 'signout') signedIn = false;
      await route.fulfill({ json: { signedIn, ok: true } });
    } else await route.fulfill({ json: { configured: true, calendarConfigured: true, user: signedIn ? { id: 'real-id', name: 'Jamie', email: 'jamie@example.com', preferences: saved ? defaultPreferences : null, calendarConnected: connected } : null } });
  });
  await page.route('**/api/profile', route => { saved = true; return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/calendar/connect', route => { connected = true; return route.fulfill({ json: { url: '/account?calendar=connected' } }); });
  await page.route('**/api/calendar/availability', route => { requests.push(route.request().postDataJSON().timeZone); return route.fulfill({ json: { windows: [{ start: '2026-10-17T17:00:00Z', end: '2026-10-17T18:00:00Z' }], checkedAt: '2026-10-13T17:00:00Z' } }); });
  await page.route('**/api/calendar/disconnect', route => { connected = false; return route.fulfill({ json: { message: 'Your calendar is disconnected.' } }); });
  await page.goto('/account');
  await page.getByLabel('Email address').fill('jamie@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password-for-testing');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hey, Jamie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check my availability' })).toBeDisabled();
  await page.getByRole('button', { name: 'Set up preferences' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Your preferences are saved to your account.')).toBeVisible();
  await page.getByRole('button', { name: 'Connect Google Calendar', exact: true }).click();
  await expect(page.locator('.live-connection')).toHaveText('Connected');
  await page.getByRole('button', { name: 'Check my availability' }).click();
  await expect(page.getByRole('heading', { name: '1 free window found' })).toBeVisible();
  expect(requests[0]).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('real-account-workspace.png'), fullPage: true, animations: 'disabled' });
  await page.route('**/api/calendar/availability', route => route.fulfill({ status: 409, json: { error: 'Your Google connection expired or was revoked. Please reconnect your calendar.' } }));
  await page.getByRole('button', { name: 'Check my availability' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Please reconnect');
  await expect(page.getByRole('heading', { name: '1 free window found' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check my availability' })).toBeDisabled();
  await page.getByRole('button', { name: 'Connect Google Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check my availability' })).toBeDisabled();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('server rejects cross-origin mutations and unauthenticated profile access', async ({ request }) => {
  const crossOrigin = await request.post('/api/auth', { headers: { Origin: 'https://unrelated.example' }, data: { action: 'signin' } });
  expect(crossOrigin.status()).toBe(403);
  const profile = await request.put('/api/profile', { headers: { Origin: 'http://localhost:3000' }, data: { name: 'Intruder', preferences: defaultPreferences } });
  expect([401, 503]).toContain(profile.status());
});
