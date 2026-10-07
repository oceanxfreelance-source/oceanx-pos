import { expect, test, type Page } from '@playwright/test';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';
const OWNER = { email: 'owner@reef.test', password: 'Reef-Kitchen-123' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/**
 * End-to-end operations: menu → POS sale → sales list, and
 * quotation → accept → convert → issue invoice → payment → print in the document language.
 */
test.describe.serial('OceanX operations', () => {
  test('restaurant owner registers and sets up a menu item and a customer', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Business type').selectOption('restaurant');
    await page.getByLabel('Business name').fill('Reef Kitchen');
    await page.getByLabel('Your name').fill('Hassan Reef');
    await page.getByLabel('Email').fill(OWNER.email);
    await page.getByLabel('Password').fill(OWNER.password);
    await page.getByRole('button', { name: 'Create my business' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hassan');
    const nav = page.locator('aside').first();
    for (const item of ['POS', 'Sales', 'Kitchen', 'Customers', 'Quotations', 'Invoices', 'Reports']) await expect(nav.getByRole('link', { name: item })).toBeVisible();

    await page.goto('/products');
    await page.getByRole('button', { name: 'New item' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Name\s*\*?$/).fill('Grilled Reef Fish');
    await dialog.getByLabel('Selling price').fill('120');
    await dialog.getByLabel('Cost price').fill('55');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('table').getByText('Grilled Reef Fish')).toBeVisible();

    await page.goto('/customers');
    await page.getByRole('button', { name: 'New customer' }).click();
    const c = page.getByRole('dialog');
    await c.getByLabel(/^Name\s*\*?$/).fill('Aishath Shifa');
    await c.getByLabel('Email').fill('aishath@reef.test');
    await c.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('table').getByText('Aishath Shifa')).toBeVisible();
  });

  test('cashier flow: POS sale is priced by the server and appears in sales', async ({ page }) => {
    await login(page);
    await page.goto('/pos');
    const tile = page.getByRole('button', { name: /Grilled Reef Fish/ });
    await tile.click();
    await tile.click();
    // 2 × 120.00 — the total shown comes from the server quote.
    const pay = page.getByRole('button', { name: /^Pay/ });
    await expect(pay).toContainText('240.00');
    await page.screenshot({ path: `${SHOTS}/pos-desktop.png`, fullPage: true });
    await pay.click();
    await page.getByRole('button', { name: 'Complete sale' }).click();
    await expect(page.getByRole('dialog').getByText('Sale complete')).toBeVisible();
    await page.getByRole('button', { name: 'New sale' }).click();

    await page.goto('/sales');
    const row = page.getByRole('table').locator('tbody tr').first();
    await expect(row).toContainText('240.00');
    await expect(row).toContainText('Completed');
  });

  test('quotation → invoice → payment → printed invoice', async ({ page }) => {
    await login(page);
    await page.goto('/quotations/new');
    await page.getByPlaceholder('Search name, phone or email…').fill('Aish');
    await page.getByRole('button', { name: /Aishath Shifa/ }).click();
    await page.getByPlaceholder('Add a product…').fill('Grilled');
    await page.getByRole('button', { name: /Grilled Reef Fish/ }).click();
    await page.getByRole('spinbutton', { name: 'Qty' }).fill('3');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/quotations\/[0-9a-f-]{36}$/);
    await expect(page.locator('main')).toContainText('360.00');

    await page.getByRole('button', { name: 'Accept' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('main h1')).toContainText('Accepted');

    await page.getByRole('button', { name: 'Convert to invoice' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
    await expect(page.getByText('Created from quotation')).toBeVisible();

    await page.getByRole('button', { name: 'Issue invoice' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('main h1')).toContainText('Issued');

    await page.getByRole('button', { name: 'Record payment' }).click();
    const payDialog = page.getByRole('dialog');
    await expect(payDialog.getByLabel('Amount')).toHaveValue('360.00');
    await payDialog.getByLabel('Amount').fill('400');
    await payDialog.getByRole('button', { name: 'Save' }).click();
    // Overpayment is refused by the server.
    await expect(payDialog.getByText('The payment is more than the balance due.')).toBeVisible();
    await payDialog.getByLabel('Amount').fill('360');
    await payDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('main h1')).toContainText('Paid');
    await page.screenshot({
      path: `${SHOTS}/invoice-detail.png`,
      fullPage: true,
    });

    const invoiceId = page.url().split('/').pop();
    await page.goto(`/print/invoice/${invoiceId}`);
    const doc = page.locator('article');
    await expect(doc).toContainText('Invoice');
    await expect(doc).toContainText('Aishath Shifa');
    await expect(doc).toContainText(/INV-\d{4}-00001/);
    await page.screenshot({
      path: `${SHOTS}/invoice-print.png`,
      fullPage: true,
    });
  });

  test('documents print in the document language, not the UI language', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Regional' }).click();
    await page.getByLabel('Default document language').selectOption('dv');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved')).toBeVisible();
    const saleId = await page.request.get('/api/sales').then(async (r) => (await r.json()).items[0].id as string);
    await page.goto(`/print/receipt/${saleId}`);
    const doc = page.locator('article');
    await expect(doc).toHaveAttribute('dir', 'rtl');
    await expect(doc).toHaveAttribute('lang', 'dv');
    // The UI around the document stays English.
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
  });

  test('tenant isolation: another business cannot read this invoice', async ({ page, browser }) => {
    await login(page);
    const inv = await page.request.get('/api/invoices').then(async (r) => (await r.json()).items[0].id as string);
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto('/login');
    await p2.getByLabel('Email').fill('owner@lagoon.test');
    await p2.getByLabel('Password').fill('Lagoon-Pass-123');
    await p2.getByRole('button', { name: 'Sign in' }).click();
    await expect(p2).toHaveURL(/\/$/);
    expect((await p2.request.get(`/api/invoices/${inv}`)).status()).toBe(404);
    await other.close();
  });

  test('manager adds an item with a photo; POS shows it; dark mode switch', async ({ page }) => {
    await login(page);
    await page.goto('/products?new=1');
    const d = page.getByRole('dialog');
    await d.getByLabel(/^Name\s*\*?$/).fill('Tuna sashimi');
    await d.getByLabel('Selling price').fill('150');
    await d.locator('input[type=file]').setInputFiles('e2e/fixtures/dish.jpg');
    await expect(d.locator('img').first()).toBeVisible();
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('table').getByText('Tuna sashimi')).toBeVisible();

    await page.goto('/pos');
    const tile = page.getByRole('button', { name: /Tuna sashimi/ });
    const img = tile.locator('img');
    await expect(img).toBeVisible();
    // The photo really loaded (served from storage), not a broken image.
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Appearance' }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.screenshot({ path: `${SHOTS}/pos-dark.png` });
    // Saved to the user's profile: survives a reload.
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Appearance' }).click();
    await page.getByRole('menuitem', { name: 'Light' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('manager downloads a customer due statement and a report as PDF', async ({ page, browser }) => {
    // Super Admin grants the credit add-on to Reef Kitchen.
    const sa = await browser.newContext();
    const sap = await sa.newPage();
    await sap.goto('/superadmin/login');
    await sap.getByLabel('Email').fill(SA_EMAIL);
    await sap.getByLabel('Password').fill(SA_PASSWORD);
    await sap.getByRole('button', { name: 'Sign in' }).click();
    await expect(sap.getByRole('heading', { name: 'Platform dashboard' })).toBeVisible();
    const csrf = await sap.evaluate(async () => (await (await fetch('/api/superadmin/auth/session')).json()).csrfToken as string);
    const biz = await sap.evaluate(async () => (await (await fetch('/api/superadmin/businesses?q=Reef')).json()).items[0].id as string);
    const granted = await sap.evaluate(
      async ([id, token]) =>
        (
          await fetch(`/api/superadmin/businesses/${id}/addons/credit/grant`, {
            method: 'POST',
            headers: {
              'x-csrf-token': token!,
              'content-type': 'application/json',
            },
            body: '{}',
          })
        ).status,
      [biz, csrf],
    );
    expect([200, 201, 409]).toContain(granted);
    await sa.close();

    await login(page);
    // A sale on credit for Aishath creates a due.
    const customers = await page.request.get('/api/customers?q=Aishath');
    const customerId = (await customers.json()).items[0].id as string;
    const catalog = await (await page.request.get('/api/pos/catalog')).json();
    const fish = catalog.products.find((p: { name: string }) => p.name === 'Grilled Reef Fish');
    const session = await (await page.request.get('/api/auth/session')).json();
    const sale = await page.request.post('/api/pos/orders', {
      headers: { 'x-csrf-token': session.csrfToken },
      data: {
        customerId,
        orderType: 'takeaway',
        items: [{ productId: fish.id, quantity: 1 }],
        payments: [{ method: 'credit', amount: 120 }],
      },
    });
    expect(sale.status()).toBe(201);

    // Statement tab → Download PDF for the selected dates.
    await page.goto('/customers');
    await page.getByRole('table').getByText('Aishath Shifa').click();
    await page.getByRole('tab', { name: 'Statement' }).click();
    await expect(page.getByText('Closing balance').first()).toBeVisible();
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    const popup = await popupPromise;
    const download = await popup.waitForEvent('download', { timeout: 30000 });
    expect(download.suggestedFilename()).toMatch(/^statement_Aishath-Shifa_.*\.pdf$/);
    const file = await download.path();
    const { readFileSync } = await import('node:fs');
    const pdf = readFileSync(file!);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
    // Reef Kitchen prints customer documents in Dhivehi (set earlier): the statement follows the document language.
    await expect(popup.locator('article')).toHaveAttribute('lang', 'dv');
    await expect(popup.locator('article')).toHaveAttribute('dir', 'rtl');
    await expect(popup.locator('article')).toContainText('120.00');
    await popup.screenshot({
      path: `${SHOTS}/statement-print.png`,
      fullPage: true,
    });
    await popup.close();

    // Reports → Download PDF.
    await page.goto('/reports');
    await expect(page.getByRole('table')).toBeVisible();
    const rp = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    const reportTab = await rp;
    const rd = await reportTab.waitForEvent('download', { timeout: 30000 });
    expect(rd.suggestedFilename()).toMatch(/Daily-sales.*\.pdf$/);
    expect(
      readFileSync((await rd.path())!)
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    await reportTab.screenshot({
      path: `${SHOTS}/report-print.png`,
      fullPage: true,
    });
  });

  test('stock items, Credit page with dues PDF, and optional Viber credit messages', async ({ page, browser }) => {
    await login(page);
    // 1. Add something used but not sold.
    await page.goto('/inventory');
    await page.getByRole('button', { name: 'Add stock item' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel(/^Name\s*\*?$/).fill('Milk powder packet');
    await d.getByLabel('Unit', { exact: true }).fill('pkt');
    await d.getByLabel('Cost per unit').fill('25');
    await d.getByLabel('Opening stock').fill('12');
    await d.getByRole('button', { name: 'Save' }).click();
    await page.getByLabel('Show').selectOption('supplies');
    await expect(page.getByRole('table').getByText('Milk powder packet')).toBeVisible();
    await expect(page.getByRole('table')).toContainText('12 pkt');
    // Never offered for sale on the POS.
    const cat = await (await page.request.get('/api/pos/catalog')).json();
    expect(cat.products.some((p: { name: string }) => p.name === 'Milk powder packet')).toBe(false);

    // 2. Viber: not available until the platform enables it; manager requests it.
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Viber' }).click();
    await expect(page.getByText('Not enabled for your business')).toBeVisible();
    await page.getByRole('button', { name: 'Request this feature' }).click();
    await expect(page.getByText(/Requested on/)).toBeVisible();

    const sa = await browser.newContext();
    const sap = await sa.newPage();
    await sap.goto('/superadmin/login');
    await sap.getByLabel('Email').fill(SA_EMAIL);
    await sap.getByLabel('Password').fill(SA_PASSWORD);
    await sap.getByRole('button', { name: 'Sign in' }).click();
    await sap.getByRole('link', { name: 'Restaurants' }).click();
    await expect(sap.getByText('Viber requested').filter({ visible: true }).first()).toBeVisible();
    await sap.getByText('Reef Kitchen').first().click();
    await sap.getByRole('button', { name: 'Enable' }).click();
    await expect(sap.getByText('Manager: OFF')).toBeVisible();
    await sap.screenshot({
      path: `${SHOTS}/sa-viber-feature.png`,
      fullPage: true,
    });
    await sa.close();

    await page.reload();
    await page.getByRole('tab', { name: 'Viber' }).click();
    await expect(page.getByText('Viber notifications are disabled. Credit transactions will continue normally.')).toBeVisible();
    await page.getByLabel('Country code').fill('960');
    await page.getByRole('radio', { name: 'ON' }).click();
    await expect(page.getByText('Viber notifications will be sent for Credit (Pay Later) transactions when the customer has a registered Viber number.')).toBeVisible();

    // Register Aishath's Viber number, then a credit sale in the POS.
    await page.goto('/customers');
    await page.getByRole('table').getByText('Aishath Shifa').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('dialog').getByLabel('Viber number').fill('7771234');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

    await page.goto('/pos');
    await page.getByPlaceholder('Search name, phone or email…').fill('Aish');
    await page.getByRole('button', { name: /Aishath Shifa/ }).click();
    await page.getByRole('button', { name: /Grilled Reef Fish/ }).click();
    await page.getByRole('button', { name: /^Pay/ }).click();
    await page.getByRole('button', { name: 'Credit (pay later)' }).click();
    await expect(page.getByText('Viber “Total” message will be sent to 7771234')).toBeVisible();
    await page.getByRole('button', { name: 'Complete sale' }).click();
    await expect(page.getByRole('dialog').getByText('Sale complete')).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Viber' }).click();
    await expect(page.getByText('Total: 120/-').last()).toBeVisible();
    await expect(page.getByText('+9607771234')).toBeVisible();
    await page.screenshot({
      path: `${SHOTS}/viber-settings.png`,
      fullPage: true,
    });

    // 3. Credit page: who owes, total due, dues PDF.
    await page.goto('/credit');
    await expect(page.getByRole('table').getByText('Aishath Shifa')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/credit-page.png`, fullPage: true });
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Dues report PDF' }).click();
    const popup = await popupPromise;
    const download = await popup.waitForEvent('download', { timeout: 30000 });
    const { readFileSync } = await import('node:fs');
    expect(
      readFileSync((await download.path())!)
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    await expect(popup.locator('article')).toContainText('Customer dues report');
    await expect(popup.locator('article')).toContainText('Grand total');
    await popup.screenshot({
      path: `${SHOTS}/credit-dues-print.png`,
      fullPage: true,
    });
  });

  test('QR menu: table cards PDF and the customer menu shows the table', async ({ page, browser }) => {
    const sa = await browser.newContext();
    const sap = await sa.newPage();
    await sap.goto('/superadmin/login');
    await sap.getByLabel('Email').fill(SA_EMAIL);
    await sap.getByLabel('Password').fill(SA_PASSWORD);
    await sap.getByRole('button', { name: 'Sign in' }).click();
    await expect(sap.getByRole('heading', { name: 'Platform dashboard' })).toBeVisible();
    const csrf = await sap.evaluate(async () => (await (await fetch('/api/superadmin/auth/session')).json()).csrfToken as string);
    const biz = await sap.evaluate(async () => (await (await fetch('/api/superadmin/businesses?q=Reef')).json()).items[0].id as string);
    const granted = await sap.evaluate(
      async ([id, token]) =>
        (
          await fetch(`/api/superadmin/businesses/${id}/addons/qr_menu/grant`, {
            method: 'POST',
            headers: {
              'x-csrf-token': token!,
              'content-type': 'application/json',
            },
            body: '{}',
          })
        ).status,
      [biz, csrf],
    );
    expect([200, 201, 409]).toContain(granted);
    await sa.close();

    await login(page);
    const created = await page.evaluate(async () => {
      const token = (await (await fetch('/api/auth/session')).json()).csrfToken as string;
      return (
        await fetch('/api/tables', {
          method: 'POST',
          headers: {
            'x-csrf-token': token,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: 'T1', area: 'Terrace' }),
        })
      ).status;
    });
    expect([200, 201, 409]).toContain(created);

    await page.goto('/qr-menu');
    await expect(page.getByRole('heading', { name: 'QR Menu' })).toBeVisible();
    await page.getByRole('tab', { name: 'QR code & settings' }).click();
    await expect(page.getByRole('switch', { name: 'Publish menu' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Menu only. Customers browse the menu and your staff take the order.')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/qr-menu.png`, fullPage: true });

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: /Download 1 cards/ }).click();
    const popup = await popupPromise;
    const download = await popup.waitForEvent('download', { timeout: 30000 });
    const { readFileSync } = await import('node:fs');
    expect(
      readFileSync((await download.path())!)
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    await expect(popup.getByText('Scan for menu')).toBeVisible();
    await expect(popup.getByText('Table T1')).toBeVisible();
    await popup.screenshot({ path: `${SHOTS}/qr-cards.png`, fullPage: true });

    const slug = await page.evaluate(async () => (await (await fetch('/api/auth/session')).json()).business.slug as string);
    // Menu items tab: the manager adds the Dhivehi name and hides one dish from the customer menu.
    await page.goto('/qr-menu');
    await expect(page.getByText('No Dhivehi name yet').first()).toBeVisible();
    await page.getByRole('button', { name: /^Grilled Reef Fish/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Name in ދިވެހި').fill('ގްރިލްކުރި ފަރުމަސް');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('ގްރިލްކުރި ފަރުމަސް')).toBeVisible();
    const tuna = page.getByRole('listitem').filter({ hasText: 'Tuna sashimi' });
    await tuna.getByRole('switch').click();
    await expect(tuna.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/qr-menu-items.png`, fullPage: true });

    const guest = await browser.newPage();
    await guest.goto(`/menu/${slug}?table=T1`);
    await expect(guest.getByText('Table T1')).toBeVisible();
    await expect(guest.getByText('Grilled Reef Fish')).toBeVisible();
    await expect(guest.getByText('Tuna sashimi')).toHaveCount(0);
    await guest.screenshot({
      path: `${SHOTS}/qr-public-menu.png`,
      fullPage: true,
    });
    // The customer switches the menu to Dhivehi: the item shows its Dhivehi name.
    await guest.getByRole('button', { name: 'Language' }).click();
    await guest.getByRole('menuitem', { name: 'ދިވެހި' }).click();
    await expect(guest.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(guest.getByText('ގްރިލްކުރި ފަރުމަސް')).toBeVisible();
    await expect(guest.getByText('Grilled Reef Fish')).toHaveCount(0);
    await guest.screenshot({ path: `${SHOTS}/qr-public-menu-dv.png`, fullPage: true });
  });
});
