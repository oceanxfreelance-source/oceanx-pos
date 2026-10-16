import { expect, test } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user-oceanx-pos/1f9b44d6-a486-5231-9cd8-b567dd442884/scratchpad/offline';

test('budget offline: opens, shows the last data, adds offline, sends when online; trial end locks offline', async ({ page, context }) => {
  const run = Date.now().toString(36);
  await page.goto('/');
  await expect(page).toHaveURL(/\/register$/); // someone new starts on sign-up
  await page.getByRole('textbox', { name: /^Your name\*?$/ }).fill('Offline Tester');
  await page.getByLabel('Email').fill(`off-${run}@budget.test`);
  await page.getByLabel('Password').fill('Budget-Pass-1234');
  await page.getByRole('button', { name: 'Start my free trial' }).click();
  await page.getByLabel(/^Income this month/).fill('10000');
  await page.getByRole('button', { name: 'Start my budget' }).click();
  await expect(page.getByText('Left to spend this month')).toBeVisible();
  await expect(page.getByText('10,000.00').first()).toBeVisible();
  // The app is kept on the phone (service worker) and the screens are loaded once.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText('Left to spend this month')).toBeVisible();
  await page.waitForTimeout(4000);

  // No internet: the app still opens with the last data.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Left to spend this month')).toBeVisible();
  await expect(page.getByText("You're offline")).toBeVisible();
  await expect(page.getByText('10,000.00').first()).toBeVisible();

  // Add spending offline: kept on the phone, counted in at once.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Amount').fill('250');
  await d.getByRole('radio', { name: /Food & groceries/ }).click();
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved on your phone')).toBeVisible();
  await expect(page.getByText('9,750.00').first()).toBeVisible();
  await expect(page.getByText('Waiting to send')).toBeVisible();
  await page.screenshot({ path: `${OUT}/offline-home.png`, fullPage: true });
  // Still there after closing and opening the app offline.
  await page.reload();
  await expect(page.getByText('Waiting to send')).toBeVisible();

  // Internet back: sent by itself, once.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('1 record sent')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Waiting to send')).toHaveCount(0);
  const total = await page.evaluate(async () => (await (await fetch('/api/budget/entries')).json()).total);
  expect(total).toBe(2);
  await page.reload();
  await expect(page.getByText('9,750.00').first()).toBeVisible();

  // The trial ends while offline: the app locks even without internet.
  await context.setOffline(true);
  await page.clock.install({ time: Date.now() + 2 * 86_400_000 });
  await page.reload();
  await expect(page.getByText('Left to spend this month')).toHaveCount(0);
  await expect(page.getByText('Your free trial has ended')).toBeVisible();
  await expect(page.getByText('Connect to the internet to see the payment details')).toBeVisible();
  await page.screenshot({ path: `${OUT}/offline-trial-ended.png`, fullPage: true });
});
