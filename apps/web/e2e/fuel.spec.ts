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

  // Built-in project with its own console: sheds, payments, plan, and its sign-up link.
  await page.locator('aside').first().getByRole('link', { name: 'Theyo Fihaara', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Theyo Fihaara');
  await expect(page.getByRole('link', { name: /fuel\/register/ })).toBeVisible();
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
  await expect(p.getByText('New shed?')).toBeVisible();
  await expect(p.getByText('Litres', { exact: true }).first()).toBeVisible();
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

/** A shed asks for an account on its own black-and-amber page; it waits for the team, then Super Admin approves it. */
test('fuel: a shed requests an account and waits for approval', async ({ page, browser }) => {
  const run = Date.now().toString(36);
  await page.goto('/fuel/login');
  await page.screenshot({ path: `${SHOTS}/fuel-login.png` });
  await page.getByRole('link', { name: 'Request an account' }).click();
  await expect(page.getByRole('heading', { name: 'Get Theyo Fihaara for your shed' })).toBeVisible();
  await page.getByLabel(/^Shed name/).fill(`Island Fuel ${run}`);
  await page.getByLabel(/^Island and atoll/).fill('Thinadhoo, Gaafu Dhaalu');
  await page.getByRole('radio', { name: '2–4' }).click();
  await page.getByRole('radio', { name: 'Drums' }).click();
  await page.getByLabel(/^Your name/).fill('Ali Moosa');
  await page.getByLabel(/^Phone \(Viber\)/).fill('7771234');
  await page.getByLabel(/^Email/).fill(`ali-${run}@fuel.test`);
  await page.getByLabel(/^Password/).fill('Island-Fuel-2026');
  await page.screenshot({ path: `${SHOTS}/fuel-register.png`, fullPage: true });
  await page.getByRole('button', { name: 'Request my shed account' }).click();
  await expect(page.getByRole('heading', { name: 'We got your request' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/fuel-pending.png` });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await phone.newPage();
  await p.goto('/fuel/register');
  await expect(p.getByRole('heading', { name: 'Get Theyo Fihaara for your shed' })).toBeVisible();
  await p.screenshot({ path: `${SHOTS}/fuel-register-phone.png`, fullPage: true });
  await phone.close();
});
