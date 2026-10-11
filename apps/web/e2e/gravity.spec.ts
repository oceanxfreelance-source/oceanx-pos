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
  // A clean home: what you are owed and the two main actions, no greeting.
  await expect(page.getByRole('link', { name: /Owed to you/ })).toContainText('0.00');
  await expect(page.getByRole('link', { name: 'New invoice' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New quotation' })).toBeVisible();
  await expect(page.getByText(/^Hello/)).toHaveCount(0);
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
  await page.getByRole('link', { name: /Add your logo and payment details/ }).click();
  await page.getByLabel('Payment details').fill('Bank of Maldives 7730000123456\nAisha Ibrahim');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved').first()).toBeVisible();

  // Company stamp from a coloured logo, turned into a blue ink stamp.
  await page.goto('/settings?tab=branding');
  await page.locator('input[type=file]').first().setInputFiles('e2e/fixtures/colour-logo.png');
  await expect(page.getByText('Choose how your stamp looks')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Original colours' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Red ink' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/gravity-stamp-picker.png`, fullPage: true });
  await page.getByRole('button', { name: 'Blue ink' }).click();
  await expect(page.getByText('Choose how your stamp looks')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();

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
  // One person: no salesperson line on Gravity documents.
  await expect(doc).not.toContainText('Salesperson');
  // No small status line under the number (the PAID stamp says it).
  await expect(doc.locator('header')).not.toContainText(/paid/i);
  await expect(doc.locator('img[data-stamp="paid"]')).toBeVisible();
  await expect(doc.locator('img[src="/api/settings/stamp"]')).toBeVisible();
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
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main .animate-pulse')).toHaveCount(0);
    await fits();
    await page.screenshot({ path: `${SHOTS}/gravity-phone-${shot}.png`, fullPage: true });
  }
  const tabs = page.getByRole('navigation', { name: 'Menu' }).last();
  await expect(tabs.getByRole('link', { name: 'Quotations' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Invoices' })).toBeVisible();
  // The printed invoice on a phone: the whole A4 page, made smaller; the PAID stamp stays on the page.
  await page.goto(`/print/invoice/${invoiceUrl.split('/').pop()}`);
  await expect(doc.locator('img[data-stamp="paid"]')).toBeVisible();
  await fits();
  const inside = await page.evaluate(() => {
    const sheet = document.querySelector('article')!.getBoundingClientRect();
    const stamp = document.querySelector('img[data-stamp="paid"]')!.getBoundingClientRect();
    return sheet.left >= 0 && sheet.right <= window.innerWidth + 1 && stamp.right <= window.innerWidth + 1 && stamp.left >= 0;
  });
  expect(inside).toBe(true);
  // The app in Dhivehi (right to left) with an English document: the stamp still sits on the page.
  await page.evaluate(() => (document.documentElement.dir = 'rtl'));
  const onSheet = await page.evaluate(() => {
    const sheet = document.querySelector('article')!.getBoundingClientRect();
    const stamp = document.querySelector('img[data-stamp="paid"]')!.getBoundingClientRect();
    return stamp.left >= sheet.left && stamp.right <= sheet.right;
  });
  expect(onSheet).toBe(true);
  await page.evaluate(() => (document.documentElement.dir = 'ltr'));
  await page.screenshot({ path: `${SHOTS}/gravity-phone-invoice-print.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  // Signing out goes back to Gravity's sign-in.
  await page.goto('/');
  await page.locator('header').getByRole('button').filter({ hasText: /\w/ }).last().click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/gravity\/login$/);
  await expect(page.getByText('Quotations & invoices').first()).toBeVisible();
});

/**
 * When the free trial ends, a Gravity user is stopped by the payment screen (as in the POS):
 * the plan's MVR price, how to pay, and the slip upload.
 */
test('gravity: trial ends → the payment screen pops up', async ({ browser }) => {
  test.setTimeout(150_000);
  const run = Date.now().toString(36);
  const { SA_EMAIL, SA_PASSWORD } = await import('./global-setup');
  const sa = await browser.newPage();
  const setPlan = async (trial: string, unit: string) => {
    await sa.goto('/superadmin/gravity/plans');
    await sa.getByLabel(/^Monthly price \(MVR\)/).fill('150');
    await sa.getByLabel(/^Free trial/).fill(trial);
    await sa.getByLabel('Unit').selectOption(unit);
    await sa.getByRole('button', { name: 'Save' }).click();
    await expect(sa.getByText('MVR 150.00')).toBeVisible();
  };
  await sa.goto('/superadmin/login');
  await sa.getByLabel('Email').fill(SA_EMAIL);
  await sa.getByLabel('Password').fill(SA_PASSWORD);
  await sa.getByRole('button', { name: 'Sign in' }).click();
  await expect(sa).toHaveURL(/superadmin\/hub$/);
  await setPlan('1', 'minutes');

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await phone.newPage();
  try {
    await page.goto('/gravity/register');
    await page.getByLabel('Your name or business name').fill(`Short Trial ${run}`);
    await page.getByRole('textbox', { name: /^Your name\*?$/ }).fill('Mariyam');
    await page.getByLabel('Email').fill(`short-${run}@gravity.test`);
    await page.getByLabel('Password').fill('Gravity-Pass-123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('link', { name: 'New invoice' })).toBeVisible();
    // Less than a day left: the reminder says how much time.
    await expect(page.getByText(/Your free trial ends in \d+ min/)).toBeVisible();

    // The minute passes: everything is blocked by the payment screen.
    await page.waitForTimeout(62_000);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your free trial has ended' })).toBeVisible();
    await expect(page.getByText(/MVR\s*150/).first()).toBeVisible();
    await expect(page.getByText('Upload the transfer slip')).toBeVisible();
    await expect(page.getByRole('link', { name: 'New invoice' })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/gravity-phone-trial-ended.png`, fullPage: true });
  } finally {
    // Back to the usual 14 days for everyone else.
    await setPlan('14', 'days');
    await phone.close();
    await sa.close();
  }
});
