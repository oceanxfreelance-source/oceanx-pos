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
  await p.getByLabel('Email').fill(`owner-${run}@fuel.test`);
  await p.getByLabel('Password').fill(password);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await expect(p.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await p.getByLabel(/^Current password/).fill(password);
  await p.getByLabel(/^New password/).fill('Harbour-Fuel-2026');
  await p.getByLabel(/^Confirm password/).fill('Harbour-Fuel-2026');
  await p.getByRole('button', { name: 'Change password' }).click();
  await expect(p.getByRole('heading', { name: 'Set up your shed' })).toBeVisible();
  await ctx.close();
});

/** A shed asks for an account on its own black-and-amber page; it waits for the team, then Super Admin approves it. */
test('fuel: a shed signs up and gets in at once', async ({ page, browser }) => {
  const run = Date.now().toString(36);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/fuel/login');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${SHOTS}/fuel-login.png` });
  const phoneLogin = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
  const pl = await phoneLogin.newPage();
  await pl.goto('/fuel/login');
  await pl.waitForTimeout(3000);
  await pl.screenshot({ path: `${SHOTS}/fuel-login-phone.png` });
  await phoneLogin.close();
  await page.getByRole('link', { name: 'Create an account' }).click();
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
  await page.getByRole('button', { name: 'Create my shed account' }).click();
  // The shed sets itself up: one person, petrol only, drums, one nozzle, delivery charge.
  await expect(page.getByRole('heading', { name: 'Set up your shed' })).toBeVisible();
  await page.getByRole('radio', { name: /One person/ }).click();
  await page.screenshot({ path: `${SHOTS}/fuel-setup-1.png` });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('switch', { name: 'Diesel' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter a price for each fuel.')).toBeVisible();
  await page.getByLabel('Price per litre (MVR)').fill('17.21');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Drums' }).click();
  await page.getByLabel(/All drums hold/).fill('1600');
  await page.getByLabel(/Order more at/).fill('400');
  await page.screenshot({ path: `${SHOTS}/fuel-setup-3.png` });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Meter reading now').fill('58214.6');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('switch', { name: 'Delivery charge' }).click();
  await page.getByLabel('Amount (MVR)').fill('150');
  await page.screenshot({ path: `${SHOTS}/fuel-setup-5.png` });
  await page.getByRole('button', { name: 'Finish set-up' }).click();
  await expect(page.getByRole('heading', { name: 'Your shed is set up' })).toBeVisible();
  await expect(page.getByText('Petrol 17.21')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/fuel-home-ready.png` });
  // Changes later in Shed settings: add diesel with its own tank.
  await page.getByRole('link', { name: 'Shed settings' }).first().click();
  await expect(page.getByRole('heading', { name: 'Shed settings' })).toBeVisible();
  await page.getByRole('radio', { name: /Shifts/ }).click();
  await page.screenshot({ path: `${SHOTS}/fuel-shed-settings.png`, fullPage: true });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Shed settings saved')).toBeVisible();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await phone.newPage();
  await p.goto('/fuel/register');
  await expect(p.getByRole('heading', { name: 'Get Theyo Fihaara for your shed' })).toBeVisible();
  await p.screenshot({ path: `${SHOTS}/fuel-register-phone.png`, fullPage: true });
  await phone.close();
});
