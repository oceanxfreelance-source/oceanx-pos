import { expect, test } from '@playwright/test';

const SHOTS = 'e2e/screenshots';

/**
 * Gravity: a freelancer signs up, sets payment details, makes a quotation with typed lines (English or Dhivehi),
 * turns it into an invoice, sees who owes what, gets paid, and prints the invoice with the PAID stamp.
 */
test('gravity: sign up → quotation → invoice → who owes → paid', async ({ page }) => {
  const run = Date.now().toString(36);
  await page.goto('/gravity');
  await expect(page).toHaveURL(/\/gravity\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your Gravity account' })).toBeVisible();
  await expect(page.getByLabel('Business type')).toHaveCount(0);
  await page.getByLabel('Your name or business name').fill(`Aisha Designs ${run}`);
  await page.getByRole('textbox', { name: /^Your name\*?$/ }).fill('Aisha Ibrahim');
  await page.getByLabel('Email').fill(`aisha-${run}@gravity.test`);
  await page.getByLabel('Password').fill('Gravity-Pass-123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Gravity home: no POS anywhere.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello, Aisha');
  const nav = page.locator('aside').first();
  await expect(nav.getByRole('link', { name: 'Quotations' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Invoices' })).toBeVisible();
  await expect(nav.getByRole('link', { name: /POS/ })).toHaveCount(0);
  // One person: no team or roles pages.
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /Roles/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open POS' })).toHaveCount(0);
  await expect(page.getByText('Nobody owes you')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/gravity-home-empty.png`, fullPage: true });

  // Payment details, printed on every invoice.
  await page.getByRole('button', { name: 'Add payment details' }).click();
  await page.getByLabel('Payment details').fill('Bank of Maldives 7730000123456\nAisha Ibrahim');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved').first()).toBeVisible();

  // Quotation: new customer from the editor, typed lines, English or Dhivehi only.
  await page.goto('/quotations/new');
  const lang = page.getByLabel('Document language');
  await expect(lang.locator('option')).toHaveText([/default/i, 'English', 'ދިވެހި']);
  await page.getByRole('button', { name: 'New customer' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Customer type').selectOption('government');
  await dlg.getByLabel('Name').fill(`Male City Council ${run}`);
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByPlaceholder('Add a product…')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Item', exact: true }).fill('Logo design');
  await page.getByRole('spinbutton', { name: 'Unit price' }).fill('1500');
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByRole('textbox', { name: 'Item', exact: true }).nth(1).fill('Business cards (box)');
  await page.getByRole('spinbutton', { name: 'Qty' }).nth(1).fill('2');
  await page.getByRole('spinbutton', { name: 'Unit price' }).nth(1).fill('250');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/quotations\/[0-9a-f-]{36}$/);
  await expect(page.locator('main')).toContainText('2,000.00');

  await page.getByRole('button', { name: 'Accept' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await page.getByRole('button', { name: 'Convert to invoice' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('main h1')).toContainText('Issued');
  const invoiceUrl = page.url();

  // Home: who owes how much.
  await page.goto('/');
  const owes = page.getByRole('link', { name: new RegExp(`Male City Council ${run}`) }).first();
  await expect(owes).toContainText('2,000.00');
  await page.screenshot({ path: `${SHOTS}/gravity-home-owed.png`, fullPage: true });
  await owes.click();
  await expect(page).toHaveURL(/\/invoices\?status=unpaid&customerId=/);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);

  // Paid → the printed invoice carries the payment details and the big PAID stamp.
  await page.goto(invoiceUrl);
  await page.getByRole('button', { name: 'Record payment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main h1')).toContainText('Paid');
  await page.goto(`/print/invoice/${invoiceUrl.split('/').pop()}`);
  const doc = page.locator('article');
  await expect(doc).toContainText('Bank of Maldives 7730000123456');
  await expect(doc.locator('img[data-stamp="paid"]')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/gravity-invoice-print.png`, fullPage: true });

  // Phones first: every Gravity screen fits a phone without sideways scrolling, with a bottom tab bar.
  await page.setViewportSize({ width: 390, height: 844 });
  // Settled layout (entrance animations can briefly slide content in from the side).
  const fits = () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const [path, shot] of [
    ['/', 'home'],
    ['/quotations/new', 'quotation-editor'],
    [new URL(invoiceUrl).pathname, 'invoice'],
    ['/invoices', 'invoices'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await fits();
    await page.screenshot({ path: `${SHOTS}/gravity-phone-${shot}.png`, fullPage: true });
  }
  const tabs = page.getByRole('navigation', { name: 'Menu' }).last();
  await expect(tabs.getByRole('link', { name: 'Quotations' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Invoices' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });

  // Signing out goes back to Gravity's sign-in.
  await page.goto('/');
  await page.locator('header').getByRole('button').filter({ hasText: /\w/ }).last().click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/gravity\/login$/);
  await expect(page.getByText('Quotations & invoices').first()).toBeVisible();
});
