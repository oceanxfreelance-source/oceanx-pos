import { expect, test, type Page } from '@playwright/test';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';

/** Super Admin turns an add-on on for a business (through the real API). */
async function grant(page: Page, businessId: string, addons: string[]) {
  const sa = await page.context().browser()!.newContext();
  const p = await sa.newPage();
  await p.goto('/superadmin/login');
  await p.getByLabel('Email').fill(SA_EMAIL);
  await p.getByLabel('Password').fill(SA_PASSWORD);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await expect(p).toHaveURL(/superadmin\/hub$/);
  for (const a of addons) {
    const status = await p.evaluate(
      async ([id, code]) => {
        const s = await (await fetch('/api/superadmin/auth/session')).json();
        return (await fetch(`/api/superadmin/businesses/${id}/addons/${code}/grant`, { method: 'POST', headers: { 'x-csrf-token': s.csrfToken, 'content-type': 'application/json' }, body: '{}' })).status;
      },
      [businessId, a],
    );
    expect(status).toBe(200);
  }
  await sa.close();
}

/**
 * The add-ons that close the gap with other POS systems: import products from Excel/CSV,
 * refund part of a bill (stock back, money back), and the MIRA GST report with input tax.
 */
test('add-ons: import from Excel, refund a bill, GST report', async ({ page }) => {
  test.setTimeout(120_000);
  const run = Date.now().toString(36);
  await page.goto('/register');
  await page.getByLabel('Business type').selectOption('cafe');
  await page.getByLabel('Business name').fill(`Lagoon Cafe ${run}`);
  await page.getByLabel('Your name').fill('Mariyam Lagoon');
  await page.getByLabel('Email').fill(`lagoon-${run}@addons.test`);
  await page.getByLabel('Password').fill('Lagoon-Cafe-123');
  await page.getByRole('button', { name: 'Create my business' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mariyam');
  const nav = page.locator('aside').first();
  // Off until Super Admin turns them on.
  await expect(nav.getByRole('link', { name: 'Import' })).toHaveCount(0);
  const businessId = await page.evaluate(async () => (await (await fetch('/api/auth/session')).json()).business.id as string);
  await grant(page, businessId, ['data_import', 'refunds', 'gst_report']);

  // Tax: 8% GST on top.
  await page.evaluate(async () => {
    const s = await (await fetch('/api/auth/session')).json();
    await fetch('/api/settings/tax', {
      method: 'PATCH',
      headers: { 'x-csrf-token': s.csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ taxEnabled: true, taxName: 'GST', taxRate: 8, pricesIncludeTax: false, taxNumber: '1000123GST501', serviceChargeEnabled: false, serviceChargeRate: 0 }),
    });
  });

  // 1. Import: cells pasted from Excel (tab separated), headings like another POS export.
  await page.reload();
  await nav.getByRole('link', { name: 'Import' }).click();
  await expect(page).toHaveURL(/\/import$/);
  await page.getByLabel('Or paste from Excel').fill('Item Name\tBarcode\tCategory\tSelling Price\tCost\tStock\nIced Latte\t4791234\tDrinks\tMVR 45.00\t15\t\nTuna Sandwich\t\tFood\t55\t20\t30\n');
  await expect(page.getByText('2 rows found. Tell us which column is which.')).toBeVisible();
  await expect(page.getByLabel('Selling price')).toHaveValue('3');
  await page.getByRole('button', { name: 'Check the file' }).click();
  await expect(page.getByText('Checked. Nothing is saved yet.')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/addon-import-preview.png`, fullPage: true });
  await page.getByRole('button', { name: 'Import 2 rows' }).click();
  await expect(page.getByText('Imported and saved.')).toBeVisible();
  await page.goto('/products');
  await expect(page.getByRole('table').getByText('Tuna Sandwich')).toBeVisible();

  // 2. Sell 2 sandwiches, then refund 1 (back in stock).
  await page.goto('/pos');
  const tile = page.getByRole('button', { name: /Tuna Sandwich/ });
  await tile.click();
  await tile.click();
  await page.getByRole('button', { name: /^Pay/ }).click();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await expect(page.getByRole('dialog').getByText('Sale complete')).toBeVisible();
  await page.getByRole('button', { name: 'New sale' }).click();
  await page.goto('/sales');
  await page.getByRole('table').locator('tbody tr').first().click();
  const sale = page.getByRole('dialog');
  await sale.getByRole('button', { name: 'Refund' }).click();
  const refund = page.getByRole('dialog').filter({ hasText: 'Refund items' });
  await refund.getByLabel('Quantity to refund: Tuna Sandwich').fill('1');
  await refund.getByLabel('Reason').fill('Customer changed their mind');
  await page.screenshot({ path: `${SHOTS}/addon-refund-dialog.png` });
  await refund.getByRole('button', { name: /^Refund about/ }).click();
  await expect(sale.getByText(/RF-\d{4}-00001/)).toBeVisible();
  await expect(sale.getByText('Customer changed their mind')).toBeVisible();
  await expect(sale.getByText('Partly refunded')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/addon-refunded-sale.png` });
  await page.keyboard.press('Escape');
  await page.goto('/inventory');
  await expect(page.getByRole('row', { name: /Tuna Sandwich/ })).toContainText('29');

  // 3. An electricity bill with GST, then the GST return summary.
  await page.goto('/expenses');
  await page.getByRole('button', { name: /New expense|Add expense/ }).first().click();
  const exp = page.getByRole('dialog');
  await exp.getByLabel('Category').selectOption('electricity');
  await exp.getByLabel('Amount').fill('108');
  await exp.getByLabel('GST in this bill (input tax)').fill('8');
  await exp.getByRole('button', { name: 'Save' }).click();
  await page.goto('/reports');
  await page.getByLabel('Report').selectOption('gst');
  await expect(page.getByText('Use these figures to fill your MIRA GST return')).toBeVisible();
  // Output tax 8.80 on the sale, less 4.40 refunded = 4.40; input tax 8.00 from the bill.
  const main = page.locator('main');
  await expect(main.getByText('Output tax', { exact: true }).first()).toBeVisible();
  await expect(main.getByText('Input tax', { exact: true }).first()).toBeVisible();
  await expect(main.getByText('GST to pay', { exact: true })).toBeVisible();
  await expect(main.getByRole('row', { name: /Refunds/ })).toContainText('-4.40');
  await page.screenshot({ path: `${SHOTS}/addon-gst-report.png`, fullPage: true });
});
