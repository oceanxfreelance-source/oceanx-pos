import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { E2E_DB } from '../playwright.config';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';

/**
 * Gravity Budget "pay on salary day" (the 30th): Super Admin turns the offer on; a customer whose trial ended
 * chooses it on the payment screen, keeps using the app, and sees the reminder. Super Admin sees who chose it.
 */
test('budget: pay on salary day, turned on by Super Admin and chosen by the customer', async ({ browser }) => {
  test.setTimeout(90_000);
  const run = Date.now().toString(36);
  const sa = await (await browser.newContext()).newPage();
  await sa.goto('/superadmin/login');
  await sa.getByLabel('Email').fill(SA_EMAIL);
  await sa.getByLabel('Password').fill(SA_PASSWORD);
  await sa.getByRole('button', { name: 'Sign in' }).click();
  await expect(sa).toHaveURL(/superadmin\/hub$/);
  await sa.goto('/superadmin/budget/plans');
  const offer = sa.getByRole('switch', { name: 'Offer pay on salary day' });
  if ((await offer.getAttribute('aria-checked')) !== 'true') await offer.click();
  await expect(offer).toHaveAttribute('aria-checked', 'true');

  // A customer whose free trial has ended.
  const person = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await person.newPage();
  await page.goto('/budget/register');
  const id = await page.evaluate(async (run) => {
    const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product: 'budget', businessName: `Salary ${run}`, ownerName: `Mariyam ${run}`, email: `salary-${run}@budget.test`, password: 'Budget-Pass-1234', currency: 'MVR' }) });
    return (await r.json()).business.id as string;
  }, run);
  execSync(`psql "${E2E_DB}" -c "UPDATE subscriptions SET current_period_end = now() - interval '1 minute' WHERE business_id = '${id}'"`);
  await page.goto('/');
  await expect(page.getByText('Pay on salary day').first()).toBeVisible();
  await expect(page.getByText(/Waiting for your salary\?/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-payday-choose.png`, fullPage: true });
  await page.getByRole('button', { name: /^Pay on \d+ \w+ \d{4}$/ }).click();
  await expect(page.getByText(/Done! Pay on/)).toBeVisible();

  // The app opens again, with the salary-day reminder at the top.
  await expect(page.getByText(/Salary day .*: pay .*MVR 50\.00.* then/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/budget-payday-banner.png` });

  // Super Admin sees who chose it.
  await sa.reload();
  const row = sa.locator('li').filter({ hasText: `Salary ${run}` });
  await expect(row).toBeVisible();
  await expect(row.getByText(/Salary day (2[89]|30) /)).toBeVisible();
  await expect(row.getByText('Not paid yet')).toBeVisible();
  await sa.screenshot({ path: `${SHOTS}/sa-budget-payday.png`, fullPage: true });

  // Super Admin turns the offer off at the end of the month; the customer's chosen date stays.
  await offer.click();
  await expect(offer).toHaveAttribute('aria-checked', 'false');
  await expect(row).toBeVisible();
});
