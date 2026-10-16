import {test,expect} from '@playwright/test';
import {installApp,owner,nav} from './app-fixture';
import {defaultPreferences} from '../../lib/mock-data';
test('unconfigured services show an honest setup message without a fake demo',async({page})=>{
  await page.route('**/api/auth',route=>route.fulfill({json:{configured:false,calendarConfigured:false,user:null}}));await page.goto('/account');await expect(page.getByRole('heading',{name:'We’re getting things ready.'})).toBeVisible();await expect(page.getByText('Explore the demo')).toHaveCount(0);
});
test('real calendar controls live on their own page and recover from revoked access',async({page})=>{
  const actor=owner();actor.calendarConnected=false;const store={group:null,failCalendar:false};await installApp(page,actor,store);await page.goto('/account');await nav(page,'My calendar');
  await expect(page.getByRole('button',{name:'Check my availability'})).toBeDisabled();await page.getByRole('button',{name:'Connect Google Calendar',exact:true}).click();await expect(page.locator('.live-connection')).toHaveText('Connected');
  await page.getByRole('button',{name:'Check my availability'}).click();await expect(page.getByRole('heading',{name:'1 free window found'})).toBeVisible();store.failCalendar=true;await page.getByRole('button',{name:'Check my availability'}).click();await expect(page.locator('main').getByRole('alert')).toContainText('reconnect');await expect(page.getByRole('button',{name:'Check my availability'})).toBeDisabled();
  await page.getByRole('button',{name:'Connect Google Calendar',exact:true}).click();await page.getByRole('button',{name:'Disconnect',exact:true}).click();await expect(page.getByRole('button',{name:'Check my availability'})).toBeDisabled();
});
test('server rejects cross-origin and unauthenticated writes',async({request})=>{
  expect((await request.post('/api/auth',{headers:{Origin:'https://unrelated.example'},data:{action:'signin'}})).status()).toBe(403);
  expect([401,503]).toContain((await request.put('/api/profile',{headers:{Origin:'http://localhost:3100'},data:{name:'Intruder',preferences:defaultPreferences}})).status());
});

test('resend appears only after signup requests verification for the entered email',async({page})=>{
  const actor=owner();actor.signedIn=false;await installApp(page,actor,{group:null,signupConfirmation:true});
  await page.goto('/account');await expect(page.locator('.verification-help')).toHaveCount(0);
  await page.getByRole('button',{name:'Create an account',exact:true}).click();await expect(page.locator('.verification-help')).toHaveCount(0);
  await page.getByLabel('Your name').fill('Jamie');await page.getByLabel('Email address').fill(actor.email);
  await page.getByLabel('Password',{exact:true}).fill('password-for-testing');await page.getByLabel('Confirm password').fill('password-for-testing');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.locator('.verification-help')).toBeVisible();await expect(page.locator('.verification-help button')).toBeDisabled();
  await page.getByLabel('Email address').fill('another@example.com');await expect(page.locator('.verification-help')).toHaveCount(0);
  await page.getByRole('button',{name:'Already registered? Sign in',exact:true}).click();await expect(page.locator('.verification-help')).toHaveCount(0);
});
