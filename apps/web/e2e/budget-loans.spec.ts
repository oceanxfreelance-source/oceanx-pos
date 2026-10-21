import { expect, test } from '@playwright/test';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';

/**
 * Gravity Budget Loans (early access): Super Admin turns it on for one account; that person gets a Loans tab,
 * notes money lent and borrowed, gets money back bit by bit, and sees the reminder on the home screen.
 */
test('budget loans: early access for one account, lend, borrow, pay back, reminder', async ({ browser }) => {
  test.setTimeout(120_000);
  const run = Date.now().toString(36);
  const person = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await person.newPage();
  await page.goto('/budget/register');
  await page.getByRole('textbox', { name: /^Your name\*?$/ }).fill('Aminath Rasheed');
  await page.getByLabel('Email').fill(`loans-${run}@budget.test`);
  await page.getByLabel('Password').fill('Budget-Pass-1234');
  await page.getByRole('button', { name: 'Start my free trial' }).click();
  await page.getByLabel(/^Income this month/).fill('15000');
  await page.getByRole('button', { name: 'Start my budget' }).click();
  await expect(page.getByText('Left to spend this month')).toBeVisible();
  // Not on yet: no Loans tab.
  await expect(page.getByRole('link', { name: 'Loans' })).toHaveCount(0);
  const businessId = await page.evaluate(async () => (await (await fetch('/api/auth/session')).json()).business.id as string);

  // Super Admin turns Loans on for this account only.
  const sa = await (await browser.newContext()).newPage();
  await sa.goto('/superadmin/login');
  await sa.getByLabel('Email').fill(SA_EMAIL);
  await sa.getByLabel('Password').fill(SA_PASSWORD);
  await sa.getByRole('button', { name: 'Sign in' }).click();
  await expect(sa).toHaveURL(/superadmin\/hub$/);
  await sa.goto(`/superadmin/budget/accounts/${businessId}`);
  const sw = sa.getByRole('switch', { name: 'Loans' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sa.screenshot({ path: `${SHOTS}/sa-loans-early-access.png`, fullPage: true });

  // The person now has the Loans tab.
  await page.reload();
  await page.getByRole('link', { name: 'Loans' }).first().click();
  await expect(page.getByRole('heading', { name: 'Loans' })).toBeVisible();
  const today = await page.evaluate(async () => (await (await fetch('/api/budget/loans')).json()).today as string);

  // I gave Ali 500, due today.
  await page.getByRole('button', { name: 'New loan' }).click();
  let d = page.getByRole('dialog');
  await d.getByLabel('Person').fill('Ali');
  await d.getByLabel('Phone (optional)').fill('7771234');
  await d.getByLabel(/^Amount/).fill('500');
  await d.getByLabel('Return by').fill(today);
  await d.getByLabel('Note').fill('ferry ticket');
  await d.getByRole('button', { name: 'Save loan' }).click();
  await expect(page.getByRole('heading', { name: 'Ali' })).toBeVisible();
  await expect(page.getByText('Ali still owes you')).toBeVisible();

  // Ali paid back 200: 300 left.
  await page.getByRole('button', { name: 'Got money back' }).click();
  d = page.getByRole('dialog');
  await d.getByLabel(/^Amount/).fill('200');
  await d.getByRole('button', { name: 'Save this amount' }).click();
  await expect(page.getByText(/300\.00/).first()).toBeVisible();
  await expect(page.getByText(/Got back .*200\.00/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-loans-person.png`, fullPage: true });

  // I took 1,000 from Ibrahim.
  await page.goto('/loans');
  await page.getByRole('button', { name: 'New loan' }).click();
  d = page.getByRole('dialog');
  await d.getByRole('radio', { name: /I took money/ }).click();
  await d.getByLabel('Person').fill('Ibrahim');
  await d.getByLabel(/^Amount/).fill('1000');
  await d.getByRole('button', { name: 'Save loan' }).click();
  await expect(page.getByText('You owe Ibrahim')).toBeVisible();

  // The list: totals both ways.
  await page.goto('/loans');
  await expect(page.getByText('People owe me').locator('..')).toContainText('300.00');
  await expect(page.getByText('I owe', { exact: true }).locator('..')).toContainText('1,000.00');
  await page.screenshot({ path: `${SHOTS}/budget-loans-list.png`, fullPage: true });
  await page.getByRole('tab', { name: 'I took' }).click();
  await expect(page.getByRole('link', { name: /Ibrahim/ })).toBeVisible();

  // Home: Ali's return date is today, so the reminder shows; "Later" hides it until tomorrow.
  await page.goto('/');
  await expect(page.getByText(/Owes you: Ali/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remind Ali' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-loans-reminder.png`, fullPage: true });
  await page.getByRole('button', { name: 'Later' }).click();
  await expect(page.getByText(/Owes you: Ali/)).toHaveCount(0);

  // Loans are not counted as spending.
  await expect(page.getByText('Left to spend this month')).toBeVisible();

  // Super Admin turns it off again: the tab goes.
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Loans' })).toHaveCount(0);
});
