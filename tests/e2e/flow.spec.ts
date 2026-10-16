import {test,expect} from '@playwright/test';
import {installApp,owner,nav,savePreferences} from './app-fixture';
test('the original welcome and sidebar lead to real account screens, with no demo route',async({page})=>{
  const actor=owner();actor.signedIn=false;await installApp(page,actor,{group:null});
  await page.goto('/?demo=1');await expect(page.getByRole('heading',{name:'Make time for your people.'})).toBeVisible();
  await expect(page.getByText('PROTOTYPE',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Sign in',exact:true})).toHaveCount(1);await expect(page.locator('.public-header').getByRole('link',{name:'Sign in'})).toHaveCount(0);
  await page.getByRole('button',{name:'Get started',exact:true}).click();await expect(page).toHaveURL(/\/account\?mode=signup/);
  await page.getByLabel('Your name').fill('Jamie');await page.getByLabel('Email address').fill(actor.email);await page.getByLabel('Password',{exact:true}).fill('password-for-testing');await page.getByLabel('Confirm password').fill('password-for-testing');await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Hey, Jamie'})).toBeVisible();
  await expect(page.locator('.dashboard-hero')).toBeVisible();await expect(page.locator('.empty-hangouts')).toBeVisible();
  await expect(page.getByRole('button',{name:'Check my availability'})).toHaveCount(0);
  await nav(page,'My preferences');await page.getByRole('button',{name:'Edit preferences',exact:true}).click();await expect(page.getByRole('heading',{name:'My preferences'})).toBeVisible();await page.getByRole('slider',{name:'Budget per person'}).fill('40');await savePreferences(page);await expect(page.getByText('Your preferences are saved.',{exact:true})).toBeVisible();
  await nav(page,'Overview');await expect(page.locator('.preferences-card')).toContainText('$40 / person');
  await nav(page,'My calendar');await expect(page.getByRole('heading',{name:'Google Calendar',exact:true})).toBeVisible();
  await nav(page,'Upcoming hangouts');await expect(page.getByRole('heading',{name:'Your hangouts.'})).toBeVisible();
  await nav(page,'Profile');await expect(page.getByText(actor.email,{exact:true})).toBeVisible();await page.getByRole('button',{name:'Sign out'}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});
test('home keeps the original cards, readable spacing and responsive navigation',async({page})=>{
  await installApp(page,owner(),{group:null});await page.goto('/account');
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});await expect(page.locator('.empty-hangouts')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const padding=await page.locator('.empty-hangouts').evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft));expect(padding).toBeGreaterThanOrEqual(20);
  }
  await page.screenshot({path:test.info().outputPath('unified-home.png'),fullPage:true,animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.screen-transition').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
test('saved preferences open for editing and retain custom activities and longer duration',async({page})=>{
  const actor=owner();await installApp(page,actor,{group:null});await page.goto('/account/preferences');
  await expect(page.getByRole('slider')).toHaveCount(0);await expect(page.locator('.saved-preferences')).toContainText('Food');
  await page.getByRole('button',{name:'Edit preferences',exact:true}).click();await page.getByRole('button',{name:'Continue'}).click();
  await page.getByLabel('Add an activity').fill('Pottery');await page.getByRole('button',{name:'Add',exact:true}).click();await page.getByRole('button',{name:'3+ hours',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pottery',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Continue'}).click();await expect(page.locator('.form-card .soft-note')).toHaveCount(0);await page.getByRole('button',{name:'Save preferences'}).click();
  await expect(page.getByText('Your preferences are saved.',{exact:true})).toBeVisible();await expect(page.locator('.form-card')).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit preferences',exact:true})).toBeVisible();
  await page.screenshot({path:test.info().outputPath('preferences-confirmation.png'),fullPage:true,animations:'disabled'});await page.reload();await expect(page.locator('.saved-preferences')).toContainText('Pottery');await expect(page.locator('.saved-preferences')).toContainText('3+ hours');await expect(page.getByRole('slider')).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('saved-preferences.png'),fullPage:true,animations:'disabled'});
});
