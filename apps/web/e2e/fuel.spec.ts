import { expect, test } from '@playwright/test';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';

/** Theyo Fihaara (fuel sheds): its own project in Super Admin; the team opens a shed and the owner signs in. */
test('fuel: Super Admin opens a fuel shed and the owner signs in', async ({ page, browser }) => {
  const run = Date.now().toString(36);
  const SHED = `Harbour Fuel ${run}`;
  await page.goto('/superadmin/login');
  await page.getByLabel('Email').fill(SA_EMAIL);
  await page.getByLabel('Password').fill(SA_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/superadmin\/hub$/);

  // Built-in project with its own console: sheds, payments, plan. No public sign-up.
  await page.locator('aside').first().getByRole('link', { name: 'Theyo Fihaara', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Theyo Fihaara');
  await expect(page.getByText('No public sign-up yet')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/fuel-sa-project.png` });
  await page.locator('aside').first().getByRole('link', { name: 'Plan' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Theyo Fihaara plan');
  await expect(page.getByText('MVR 599.00')).toBeVisible();

  await page.locator('aside').first().getByRole('link', { name: 'Fuel sheds' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fuel sheds');
  await page.getByRole('button', { name: 'New fuel shed' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/Business type/)).toHaveCount(0);
  await dialog.getByLabel(/^Shed name/).fill(SHED);
  await dialog.getByLabel(/^Name/).fill('Ibrahim Manik');
  await dialog.getByRole('textbox', { name: /^Email/ }).last().fill(`owner-${run}@fuel.test`);
  const password = await dialog.getByLabel(/First password/).inputValue();
  await page.screenshot({ path: `${SHOTS}/fuel-sa-create.png` });
  await dialog.getByRole('button', { name: 'Open shed account' }).click();
  await dialog.getByRole('button', { name: /Open/ }).click();
  await expect(page).toHaveURL(/superadmin\/fuel\/accounts\/[0-9a-f-]+$/);
  await expect(page.getByText(SHED).first()).toBeVisible();

  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('/fuel/login');
  await expect(p.getByText('Your account is opened by the OceanX team')).toBeVisible();
  await p.getByLabel('Email').fill(`owner-${run}@fuel.test`);
  await p.getByLabel('Password').fill(password);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await expect(p.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await p.getByLabel(/^Current password/).fill(password);
  await p.getByLabel(/^New password/).fill('Harbour-Fuel-2026');
  await p.getByLabel(/^Confirm password/).fill('Harbour-Fuel-2026');
  await p.getByRole('button', { name: 'Change password' }).click();
  await expect(p.getByRole('heading', { name: 'Your Theyo Fihaara account is ready' })).toBeVisible();
  await p.screenshot({ path: `${SHOTS}/fuel-owner-home.png` });
  await ctx.close();
});
