import { expect, test } from '@playwright/test';

const SHOTS = 'e2e/screenshots';

/**
 * A small takeaway shop: sells at the POS, then closes the day — the cash that should be in the drawer,
 * counted (a little short), the float kept for tomorrow, the printed closing, and the closings list.
 */
test('takeaway shop: sell, close the day, count the cash, see over / short', async ({ page }) => {
  const run = Date.now().toString(36);
  await page.goto('/register');
  await page.getByLabel('Business type').selectOption('takeaway');
  await page.getByLabel('Business name').fill(`Burger Box ${run}`);
  await page.getByLabel('Your name').fill('Ibrahim');
  await page.getByLabel('Email').fill(`burger-${run}@takeaway.test`);
  await page.getByLabel('Password').fill('Burger-Box-1234');
  await page.getByRole('button', { name: 'Create my business' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ibrahim');
  await expect(page.locator('aside').first().getByRole('link', { name: 'Day closing' })).toBeVisible();

  await page.goto('/products');
  await page.getByRole('button', { name: 'New item' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Name\s*\*?$/).fill('Chicken Burger');
  await dialog.getByLabel('Selling price').fill('45');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('table').getByText('Chicken Burger')).toBeVisible();

  await expect(page.locator('aside').first().getByRole('link', { name: 'Tables' })).toHaveCount(0);

  // Two burgers, paid in cash. A takeaway shop has no dine-in or tables.
  await page.goto('/pos');
  await expect(page.getByRole('radio', { name: 'Takeaway' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Dine-in' })).toHaveCount(0);
  await expect(page.getByLabel('Table')).toHaveCount(0);
  const tile = page.getByRole('button', { name: /Chicken Burger/ });
  await tile.click();
  await tile.click();
  const pay = page.getByRole('button', { name: /^Pay/ });
  await expect(pay).toContainText('90.00');
  await pay.click();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await expect(page.getByRole('dialog').getByText('Sale complete')).toBeVisible();
  await page.getByRole('button', { name: 'New sale' }).click();

  // Close the day from the POS: 90 should be in the drawer; 85 counted → 5 short; 20 stays for tomorrow.
  await page.getByRole('button', { name: 'Close day' }).click();
  const close = page.getByRole('dialog');
  await expect(close.getByText('Cash that should be in the drawer')).toBeVisible();
  await expect(close.getByText(/90\.00/).first()).toBeVisible();
  await close.getByLabel('Cash counted').fill('85');
  await expect(close.getByText(/5\.00\W* short/)).toBeVisible();
  await close.getByLabel('Float left for tomorrow').fill('20');
  await page.screenshot({ path: `${SHOTS}/close-day.png` });
  const printed = page.waitForEvent('popup');
  await close.getByRole('button', { name: 'Close the day' }).click();
  const print = await printed;
  await expect(print.getByText('Day closing #1')).toBeVisible();
  await expect(print.getByText(/5\.00\W* short/)).toBeVisible();
  await print.close();

  // The list: closing #1, 5 short; the next day starts with the 20 float.
  await page.goto('/closings');
  await expect(page.getByText(/^#1 ·/)).toBeVisible();
  await expect(page.getByText(/5\.00\W* short/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/closings.png`, fullPage: true });
  await page.getByRole('button', { name: 'Close the day' }).click();
  await expect(page.getByRole('dialog').getByText('Float from last closing').locator('..')).toContainText('20.00');
});
