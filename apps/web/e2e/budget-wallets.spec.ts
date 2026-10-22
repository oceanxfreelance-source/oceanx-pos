import { expect, test } from '@playwright/test';

const SHOTS = 'e2e/screenshots';

/**
 * Gravity Budget dollars and savings: sign up with "Rf and $", spend in each money (never mixed), and put money
 * into "My savings" with no goal.
 */
test('budget dollars: Rf and $ kept apart, My savings with no goal', async ({ browser }) => {
  test.setTimeout(120_000);
  const run = Date.now().toString(36);
  const person = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await person.newPage();
  await page.goto('/budget/register');
  await page.getByRole('textbox', { name: /^Your name\*?$/ }).fill('Hawwa Dollars');
  await page.getByLabel('Email').fill(`wallets-${run}@budget.test`);
  await page.getByLabel('Password').fill('Budget-Pass-1234');
  await page.getByRole('radio', { name: 'Rf and $' }).click();
  await page.getByRole('button', { name: 'Start my free trial' }).click();
  await page.getByLabel(/^Income this month/).fill('15000');
  await page.getByRole('button', { name: 'Start my budget' }).click();
  await expect(page.getByText('Left to spend this month')).toBeVisible();
  await expect(page.getByText(/15,000\.00/).first()).toBeVisible();

  // Spend $25 in dollars: the Rf home does not change.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount').fill('25');
  await dialog.getByRole('tab', { name: '$' }).click();
  await dialog.getByRole('radio', { name: /Shopping/ }).click();
  await page.screenshot({ path: `${SHOTS}/budget-add-dollars.png` });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/15,000\.00/).first()).toBeVisible();

  // Switch to $: its own numbers.
  await page.getByRole('tab', { name: '$' }).click();
  await expect(page.getByText(/\$ 25\.00/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-home-dollars.png`, fullPage: true });

  // My savings (no goal): put in $100.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Amount/).fill('100');
  await dialog.getByRole('button', { name: 'Put in' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('link', { name: 'Savings' }).last().click();
  await expect(page.getByRole('heading', { name: 'Dollar savings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My savings' })).toBeVisible();
  await expect(page.getByText(/\$ 100\.00/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-savings.png`, fullPage: true });

  // Back on Rf: nothing changed there.
  await page.goto('/');
  await page.getByRole('tab', { name: /^(MVR|Rf)/ }).click();
  await expect(page.getByText(/15,000\.00/).first()).toBeVisible();
});
