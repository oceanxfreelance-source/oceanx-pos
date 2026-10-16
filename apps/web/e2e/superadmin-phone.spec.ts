import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { E2E_DB } from '../playwright.config';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003030200efa6c8f00000000049454e44ae426082', 'hex');

/**
 * OceanX Admin (Super Admin's phone app): signs in once, sees only payments waiting and active accounts,
 * checks a slip and approves it. The rest of Super Admin is not reachable from the app.
 */
test('OceanX Admin phone app: payments only', async ({ browser }) => {
  // A Gravity Budget person whose trial ended uploads a transfer slip.
  const person = await browser.newContext();
  const pp = await person.newPage();
  const run = Date.now().toString(36);
  await pp.goto('/');
  const id = await pp.evaluate(async (run) => {
    const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product: 'budget', businessName: `Slip ${run}`, ownerName: `Aminath ${run}`, email: `slip-${run}@budget.test`, password: 'Budget-Pass-1234', currency: 'MVR' }) });
    return (await r.json()).business.id as string;
  }, run);
  execSync(`psql "${E2E_DB}" -c "UPDATE subscriptions SET current_period_end = now() - interval '1 minute' WHERE business_id = '${id}'"`);
  const expired = await pp.evaluate(async () => (await (await fetch('/api/billing')).json()).plans?.[0]?.id as string | undefined);
  expect(expired).toBeTruthy();
  const up = await pp.request.post(`/api/billing/payments?planId=${expired}&months=1&reference=BML-${run}`, {
    headers: { 'content-type': 'image/png', 'x-csrf-token': await pp.evaluate(async () => (await (await fetch('/api/auth/session')).json()).csrfToken) },
    data: PNG,
  });
  expect(up.status()).toBe(201);

  // The admin app: phone size, the app's browser identity.
  const app = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 OceanXAndroid/1.0.0' });
  const page = await app.newPage();
  await page.goto('/superadmin/login');
  await page.getByLabel('Email').fill(SA_EMAIL);
  await page.getByLabel('Password').fill(SA_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/superadmin\/phone$/);
  await expect(page.getByRole('heading', { name: 'OceanX Admin' })).toBeVisible();
  const card = page.locator('li').filter({ hasText: `Slip ${run}` });
  await expect(card).toBeVisible();
  await expect(page.getByText('Active accounts')).toBeVisible();
  await expect(page.getByText('Gravity Budget').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/admin-phone.png`, fullPage: true });
  // The full Super Admin is not part of the app.
  await page.goto('/superadmin/hub');
  await expect(page).toHaveURL(/\/superadmin\/phone$/);
  // Check the slip, approve.
  await card.getByRole('button', { name: 'View slip' }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  await page.keyboard.press('Escape');
  await card.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /approve|confirm/i }).click();
  await expect(card).toHaveCount(0);
  await person.close();
  await app.close();
});
