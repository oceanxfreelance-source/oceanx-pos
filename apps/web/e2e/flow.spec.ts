import { expect, test } from '@playwright/test';

const SHOTS = 'e2e/screenshots';

/**
 * Gravity Flow: a small business signs up, adds income and expenses, sees today's profit on the home page and
 * each day's and the month's profit on Months,
 * goes back to last month (a loss), sees every month, and finds and changes a record. Phone and PC.
 */
test('flow: sign up → income & expenses → daily and monthly profit → past months', async ({ page }) => {
  const run = Date.now().toString(36);
  await page.goto('/flow');
  await expect(page).toHaveURL(/\/flow\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your Gravity Flow account' })).toBeVisible();
  await expect(page.getByLabel('Business type')).toHaveCount(0);
  await page.getByLabel('Your business or your name').fill(`Ibrahim Fish ${run}`);
  await page.getByRole('textbox', { name: /^Your name\*?$/ }).fill('Ibrahim');
  await page.getByLabel('Email').fill(`flow-${run}@flow.test`);
  await page.getByLabel('Password').fill('Flow-Pass-1234');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Home: today only, nothing yet. Only Flow things in the menu.
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expect(page.getByText('Nothing recorded today yet.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Profit of each day this month' })).toBeVisible();
  const nav = page.locator('aside').first();
  await expect(nav.getByRole('link', { name: 'Transactions' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Months' })).toBeVisible();
  await expect(nav.getByRole('link', { name: /POS|Quotations|Invoices/ })).toHaveCount(0);

  // Income and an expense today (exact decimals).
  await page.getByRole('button', { name: 'Add income' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Amount/).fill('1500');
  await dialog.getByLabel('Category').selectOption({ label: 'Sales' });
  await dialog.getByLabel(/^Note/).fill(`Fish sold ${run}`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Add expense' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Amount/).fill('400.50');
  // A new category right in the form.
  await dialog.getByLabel('Category').selectOption({ label: '+ New category' });
  await dialog.getByLabel('New category').fill(`Boat fuel ${run}`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // Today's profit = income − expenses, with today's records.
  await expect(page.getByText('1,099.50').first()).toBeVisible();
  await expect(page.getByText(`Fish sold ${run}`)).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${SHOTS}/flow-home.png`, fullPage: true });

  // Months: this month's graphs; margin = profit ÷ income; every day of the month has a place on the daily graph.
  await nav.getByRole('link', { name: 'Months' }).click();
  await expect(page.getByRole('heading', { name: 'Months', level: 1 })).toBeVisible();
  await expect(page.getByText('73.3%').first()).toBeVisible();
  const daysInMonth = await page.evaluate(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  });
  await expect(page.getByRole('img', { name: 'Profit of each day this month' }).locator('g.cursor-pointer')).toHaveCount(daysInMonth);

  // Last month: an expense only → a loss, shown in red; "This month" brings the current month back.
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('button', { name: 'This month' })).toBeVisible();
  await page.getByRole('button', { name: 'Add expense' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Amount/).fill('200');
  await dialog.getByLabel(/^Note/).fill(`Net repair ${run}`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Loss', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'This month', exact: true }).click();
  await expect(page.getByText('1,099.50').first()).toBeVisible();

  // Every month, newest first.
  await expect(page.getByRole('button', { name: /This month/ }).last()).toContainText('1,099.50');
  await expect(page.getByRole('button', { name: /200\.00/ }).first()).toBeVisible();

  // The home page: today, and this month (last month's loss is not on it).
  await nav.getByRole('link', { name: /Home|Dashboard/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expect(page.getByText(`Net repair ${run}`)).toHaveCount(0);

  // Find a record and change it: the totals follow.
  await nav.getByRole('link', { name: 'Transactions' }).click();
  await page.getByLabel('Search notes or categories').fill(`Fish sold ${run}`);
  await expect(page.getByRole('button', { name: new RegExp(`Fish sold ${run}`) })).toHaveCount(1);
  await page.getByRole('button', { name: new RegExp(`Fish sold ${run}`) }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Amount/).fill('2000');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('1,599.50').first()).toBeVisible();

  // Phones: everything fits, with the Flow tab bar.
  await page.setViewportSize({ width: 390, height: 844 });
  const fits = () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const [path, shot] of [
    ['/', 'home'],
    ['/transactions', 'transactions'],
    ['/months', 'months'],
  ] as const) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await fits();
    await page.screenshot({ path: `${SHOTS}/flow-phone-${shot}.png`, fullPage: true });
  }
  const tabs = page.getByRole('navigation', { name: 'Menu' }).last();
  await expect(tabs.getByRole('link', { name: 'Transactions' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Months' })).toBeVisible();

  // Dark mode on the phone, from the top bar (navy, like the logo).
  await page.goto('/');
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('menuitem', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/flow-phone-home-dark.png`, fullPage: true });
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('menuitem', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});
