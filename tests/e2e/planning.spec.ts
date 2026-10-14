import { expect, test, type Page } from '@playwright/test';
async function next(page: Page) { await page.getByRole('button', { name: 'Continue', exact: true }).click(); }
async function onboard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('button', { name: 'Sign up with Google · demo' }).click();
  await page.getByRole('button', { name: 'Connect Google Calendar', exact: true }).click();
  await next(page); await next(page); await next(page);
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await page.getByRole('button', { name: 'Go to overview' }).click();
}
async function create(page: Page) {
  await page.locator('.dashboard-heading').getByRole('button', { name: 'Plan a hangout' }).click();
  await page.getByLabel('What shall we call it?').fill('Sunday with friends');
  await page.getByLabel('Friend 1 email').fill('jamie@example.com');
  await page.getByLabel('Start date').fill('2026-10-17');
  await page.getByLabel('End date').fill('2026-10-19');
  await next(page);
  await page.getByRole('button', { name: 'Keep my current preferences' }).click();
  await page.getByRole('button', { name: 'Find a shared time' }).click();
  await expect(page.getByRole('group', { name: 'Shared time options' })).toBeVisible();
}
async function capture(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
}
test('choose time, vote, resolve a tie, confirm, and reopen a plan', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await onboard(page);
  await capture(page, 'dashboard-readable');
  await create(page);
  await expect(page.getByRole('button', { name: 'Choose this time' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Vote for this' })).toHaveCount(0);
  await capture(page, 'shared-times');
  await page.getByRole('button', { name: 'Everyone’s busy' }).click();
  await expect(page.getByRole('heading', { name: 'No shared time just yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Try the other scenario' }).click();
  await page.getByRole('group', { name: 'Shared time options' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Choose this time' }).click();
  await expect(page.getByRole('heading', { name: 'What shall we do?' })).toBeVisible();
  await capture(page, 'activity-voting');
  const cards = page.locator('.activity-card');
  await cards.nth(0).getByRole('button', { name: 'Vote for this' }).click();
  await expect(page.getByRole('button', { name: 'Confirm this plan' })).toHaveCount(0);
  await page.getByLabel('Preview voting as').selectOption('jamie@example.com');
  await cards.nth(1).getByRole('button', { name: 'Vote for this' }).click();
  await expect(page.locator('.vote-count')).toHaveText('2 / 2 voted');
  await expect(page.getByRole('button', { name: 'Confirm this plan' })).toHaveCount(2);
  await cards.nth(1).getByRole('button', { name: 'Voted' }).click();
  await expect(page.locator('.vote-count')).toHaveText('1 / 2 voted');
  await page.getByRole('button', { name: 'Add sample votes' }).click();
  await expect(page.getByRole('button', { name: 'Confirm this plan' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Confirm this plan' }).click();
  await expect(page.getByRole('heading', { name: 'See you soon.' })).toBeVisible();
  await capture(page, 'confirmed');
  await expect(page.getByRole('button', { name: 'Download calendar file' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to overview', exact: true }).click();
  await expect(page.getByText('Confirmed · demo')).toBeVisible();
  await page.locator('.dashboard-heading').getByRole('button', { name: 'Plan a hangout' }).click();
  await expect(page.getByLabel('What shall we call it?')).toHaveValue('');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'View hangout' }).click();
  await expect(page.getByRole('heading', { name: 'See you soon.' })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen voting' }).click();
  await expect(page.locator('.vote-count')).toHaveText('2 / 2 voted');
  await page.getByRole('button', { name: 'Choose another time (clears votes)' }).click();
  await page.getByRole('group', { name: 'Shared time options' }).getByRole('button').nth(1).click();
  await page.getByRole('button', { name: 'Choose this time' }).click();
  await expect(page.locator('.vote-count')).toHaveText('0 / 2 voted');
  await expect(page.getByRole('button', { name: 'Confirm this plan' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('readable typography, stronger contrast, responsive layouts, and reduced motion', async ({ page }) => {
  await onboard(page);
  const measures = await page.locator('.dashboard-heading p').evaluate(element => {
    const style = getComputedStyle(element);
    return { size: parseFloat(style.fontSize) };
  });
  expect(measures.size).toBeGreaterThanOrEqual(16);
  for (const selector of ['.dashboard-heading p', '.calendar-card p', '.summary-pills > span', '.button.primary', '.nav-link.active']) {
    const ratio = await page.locator(selector).first().evaluate(element => {
      const luminance = (color: string) => {
        const values = color.match(/[\d.]+/g)!.slice(0, 3).map(value => {
          const n = Number(value) / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      let background = 'rgb(255, 255, 255)';
      let current: Element | null = element;
      while (current) {
        const color = getComputedStyle(current).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') { background = color; break; }
        current = current.parentElement;
      }
      const a = luminance(getComputedStyle(element).color), b = luminance(background);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(ratio, `Text contrast for ${selector}`).toBeGreaterThanOrEqual(4.5);
  }
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await capture(page, `dashboard-${width}`);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.screen-transition').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.setViewportSize({ width: 390, height: 844 });
  await create(page);
  await page.getByRole('group', { name: 'Shared time options' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Choose this time' }).click();
  expect(await page.locator('.planning-layout').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
});

test('no matching activity offers recovery without changing saved preferences', async ({ page }) => {
  await onboard(page);
  await create(page);
  await page.locator('.planning-card').getByRole('button', { name: 'My preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Customize for this hangout' }).click();
  await page.getByRole('slider', { name: 'Budget per person' }).fill('0');
  await page.getByRole('button', { name: 'outdoor', exact: true }).click();
  await next(page); await next(page);
  await page.getByLabel('Anything you’d rather skip?').fill('Walking, Sports');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await page.getByRole('button', { name: 'Find a shared time' }).click();
  await page.getByRole('group', { name: 'Shared time options' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Choose this time' }).click();
  await expect(page.getByRole('heading', { name: 'Let’s make a little adjustment.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this plan' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review my hangout preferences' }).click();
  await expect(page.getByText('$25 / person')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my current preferences' }).click();
  await page.getByRole('button', { name: 'Find a shared time' }).click();
  await page.getByRole('group', { name: 'Shared time options' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Choose this time' }).click();
  await expect(page.getByRole('button', { name: 'Vote for this' }).first()).toBeVisible();
});
