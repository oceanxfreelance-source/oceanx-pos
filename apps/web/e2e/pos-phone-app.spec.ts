import { expect, test, type Page } from '@playwright/test';

/**
 * The POS Android app on a phone: a takeaway shop gets the whole system (upright phone app), a café keeps
 * the POS-only tablet app. The app's bridge is stood in for here and records what the page asks of it.
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { OceanXAndroid: object; phoneTillCalls: boolean[] };
    w.phoneTillCalls = [];
    w.OceanXAndroid = { print: () => {}, saveFile: () => {}, phoneTill: (on: boolean) => w.phoneTillCalls.push(on) };
  });
});

async function register(page: Page, type: string, name: string) {
  const run = Date.now().toString(36);
  await page.goto('/register');
  await page.getByLabel('Business type').selectOption(type);
  await page.getByLabel('Business name').fill(`${name} ${run}`);
  await page.getByLabel('Your name').fill('Aisha');
  await page.getByLabel('Email').fill(`${type}-${run}@phone.test`);
  await page.getByLabel('Password').fill('Phone-App-1234');
  await page.getByRole('button', { name: 'Create my business' }).click();
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { phoneTillCalls: boolean[] }).phoneTillCalls);

test('takeaway shop on a phone: the whole system in the POS app', async ({ page }) => {
  await register(page, 'takeaway', 'Juice Bar');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Aisha');
  expect(await calls(page)).toContain(true);
  for (const path of ['/customers', '/invoices', '/quotations']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
  await page.goto('/pos');
  await expect(page.getByRole('textbox', { name: 'Search items…' })).toBeVisible();
  // Back goes to the dashboard (the tablet app has a sign-out button there instead).
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
});

test('café on a phone: the POS app stays the POS only', async ({ page }) => {
  await register(page, 'cafe', 'Corner Cafe');
  await expect(page).toHaveURL(/\/pos$/);
  expect(await calls(page)).not.toContain(true);
  await page.goto('/customers');
  await expect(page).toHaveURL(/\/pos$/);
});
