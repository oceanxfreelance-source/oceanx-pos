import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';
const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://oceanx:oceanx_dev@localhost:5432/oceanx_e2e';
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
    // Receipts print on A4 like every other document, not on a narrow thermal strip.
    await expect(doc).not.toHaveClass(/doc-receipt/);
    expect(await doc.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(700);
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
    await expect(sap).toHaveURL(/superadmin\/hub$/);
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
    // Bought in bulk: 12 packets for MVR 300 in total — the cost per packet is worked out.
    await d.getByLabel('Opening stock').fill('12');
    await d.getByLabel(/^Total paid/).fill('300');
    await expect(d.getByLabel('Cost per unit')).toHaveValue('25');
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
    // The POS console lives in the OceanX POS project.
    await sap.locator('aside').first().getByRole('link', { name: 'OceanX POS' }).click();
    await sap.locator('aside').first().getByRole('link', { name: 'Restaurants' }).click();
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

    // 4. The customer pays half of the due at the POS; the cashier records it and prints a receipt.
    await page.goto('/pos');
    await page.getByPlaceholder('Search name, phone or email…').fill('Aish');
    await page.getByRole('button', { name: /Aishath Shifa/ }).click();
    await page.getByRole('button', { name: 'Receive payment' }).click();
    const payDlg = page.getByRole('dialog');
    await payDlg.getByRole('button', { name: 'Half' }).click();
    await expect(payDlg.getByText('Remaining after this payment')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/due-part-payment.png` });
    await payDlg.getByRole('button', { name: 'Record payment' }).click();
    await expect(payDlg.getByText('Paid now')).toBeVisible();
    await expect(payDlg.getByText('Still due')).toBeVisible();
    const receiptPromise = page.waitForEvent('popup');
    await payDlg.getByRole('button', { name: 'Print receipt' }).click();
    const receipt = await receiptPromise;
    await expect(receipt.locator('article')).toContainText('Aishath Shifa');
    // Printed in the business's document language (Dhivehi for this restaurant).
    await expect(receipt.locator('article')).toHaveAttribute('lang', 'dv');
    await expect(receipt.locator('article')).toContainText('ދެއްކި އަދަދު');
    await receipt.screenshot({ path: `${SHOTS}/due-payment-receipt.png`, fullPage: true });
    await payDlg.getByRole('button', { name: 'Done' }).click();
    // The POS now shows the smaller remaining due.
    await expect(page.getByText(/^Due:/)).toBeVisible();
  });

  test('QR menu: table cards PDF and the customer menu shows the table', async ({ page, browser }) => {
    const sa = await browser.newContext();
    const sap = await sa.newPage();
    await sap.goto('/superadmin/login');
    await sap.getByLabel('Email').fill(SA_EMAIL);
    await sap.getByLabel('Password').fill(SA_PASSWORD);
    await sap.getByRole('button', { name: 'Sign in' }).click();
    await expect(sap).toHaveURL(/superadmin\/hub$/);
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
  test('payroll and duty rota: requested add-ons, salary sheet with PDF, weekly rota with PDF', async ({ page, browser }) => {
    await login(page);
    // The restaurant asks for the add-on from its Add-ons page.
    await page.goto('/addons');
    const card = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Payroll (Salary Sheet)' }) })
      .filter({ has: page.getByRole('button', { name: 'Request' }) })
      .last();
    await card.getByRole('button', { name: 'Request' }).click();
    await expect(page.getByText('Request sent. The platform team will switch it on.')).toBeVisible();
    await expect(page.getByText(/^Requested /).first()).toBeVisible();

    // Super Admin sees the request and switches both add-ons on.
    const sa = await browser.newContext();
    const sap = await sa.newPage();
    await sap.goto('/superadmin/login');
    await sap.getByLabel('Email').fill(SA_EMAIL);
    await sap.getByLabel('Password').fill(SA_PASSWORD);
    await sap.getByRole('button', { name: 'Sign in' }).click();
    await expect(sap).toHaveURL(/superadmin\/hub$/);
    await sap.goto('/superadmin/businesses');
    await expect(sap.getByText('1 add-on requested').filter({ visible: true }).first()).toBeVisible();
    const csrf = await sap.evaluate(async () => (await (await fetch('/api/superadmin/auth/session')).json()).csrfToken as string);
    const biz = await sap.evaluate(async () => (await (await fetch('/api/superadmin/businesses?q=Reef')).json()).items[0].id as string);
    for (const code of ['payroll', 'staff_rota']) {
      const status = await sap.evaluate(
        async ([id, token, c]) => (await fetch(`/api/superadmin/businesses/${id}/addons/${c}/grant`, { method: 'POST', headers: { 'x-csrf-token': token!, 'content-type': 'application/json' }, body: '{}' })).status,
        [biz, csrf, code],
      );
      expect(status).toBe(200);
    }
    await sa.close();

    // Staff list.
    await page.goto('/payroll?tab=staff');
    for (const [name, position, pay] of [
      ['Ali Hassan', 'Chef', '8000'],
      ['Sara Ahmed', 'Cashier', '6000'],
    ] as const) {
      await page.getByRole('button', { name: 'Add staff' }).click();
      const d = page.getByRole('dialog');
      await d.getByLabel(/^Name\s*\*?$/).fill(name);
      await d.getByLabel('Position').fill(position);
      await d.getByLabel('Basic salary (monthly)').fill(pay);
      await d.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText(name)).toBeVisible();
    }

    // Salary sheet for a month: starts from basic pay; overtime and advance change net pay.
    await page.getByRole('tab', { name: 'Salary sheets' }).click();
    await page.getByRole('button', { name: 'New salary sheet' }).click();
    await page.getByRole('dialog').getByLabel('Month').fill('2026-09');
    await page.getByRole('dialog').getByRole('button', { name: 'Create sheet' }).click();
    await expect(page.getByRole('heading', { name: /Salary sheet — September 2026/ })).toBeVisible();
    await page.getByLabel('Ali Hassan Overtime').fill('500');
    await page.getByLabel('Ali Hassan Advance').fill('1000');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Changes saved').first()).toBeVisible();
    // 8000 + 500 − 1000 = 7500 for Ali; total 7500 + 6000.
    await expect(page.locator('tfoot')).toContainText('13,500.00');
    await page.screenshot({ path: `${SHOTS}/payroll-sheet.png`, fullPage: true });
    await page.getByRole('button', { name: 'Finalize' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Finalize' }).click();
    await expect(page.getByText('This sheet is finalized and locked. The total was added to expenses as Salaries.')).toBeVisible();
    await expect(page.getByLabel('Ali Hassan Overtime')).toHaveCount(0);
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    const popup = await popupPromise;
    const download = await popup.waitForEvent('download', { timeout: 30000 });
    const { readFileSync } = await import('node:fs');
    expect(readFileSync((await download.path())!).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(popup.locator('article')).toContainText('Salary sheet');
    await expect(popup.locator('article')).toContainText('Signature');
    await popup.screenshot({ path: `${SHOTS}/payroll-print.png`, fullPage: true });

    // Duty rota: shifts, then a week.
    await page.goto('/rota?tab=shifts');
    await page.getByRole('button', { name: /Morning \(08:00–16:00\)/ }).click();
    // Then a custom shift of our own.
    await page.getByRole('button', { name: 'Add shift' }).click();
    const sd = page.getByRole('dialog');
    await sd.getByLabel(/^Name\s*\*?$/).fill('Evening');
    await sd.getByLabel('Starts').fill('16:00');
    await sd.getByLabel('Ends').fill('23:30');
    await sd.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('16:00 – 23:30')).toBeVisible();
    await page.getByRole('tab', { name: 'Rota' }).click();
    const firstDay = page.locator('thead th').nth(1);
    await expect(firstDay).toBeVisible();
    const aliMonday = page.getByRole('combobox').first();
    await aliMonday.selectOption({ label: 'Morning (08:00–16:00)' });
    await page.getByRole('combobox').nth(7).selectOption({ label: 'Off' });
    await page.getByRole('combobox').nth(8).selectOption({ label: 'Leave' });
    await page.reload();
    await expect(page.getByRole('combobox').first()).toHaveValue(/[0-9a-f-]{36}/);
    await expect(page.getByRole('combobox').nth(7)).toHaveValue('off');
    await page.screenshot({ path: `${SHOTS}/rota-week.png`, fullPage: true });
    const rotaPopupP = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    const rotaPopup = await rotaPopupP;
    const rotaPdf = await rotaPopup.waitForEvent('download', { timeout: 30000 });
    expect(readFileSync((await rotaPdf.path())!).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(rotaPopup.locator('article')).toContainText('Ali Hassan');
    await expect(rotaPopup.locator('article')).toContainText('Morning');
    await rotaPopup.screenshot({ path: `${SHOTS}/rota-print.png`, fullPage: true });
  });
  test('signature and company stamp appear on invoices and salary sheets', async ({ page }) => {
    await login(page);
    // Draw a signature on the pad.
    await page.goto('/account');
    const pad = page.getByLabel('Signature pad');
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height * 0.6);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + 30 + i * 18, box.y + box.height * (0.6 - Math.sin(i / 3) * 0.3));
    await page.mouse.up();
    await page.getByRole('button', { name: 'Save signature' }).click();
    await expect(page.getByText('Changes saved').first()).toBeVisible();
    await expect(page.locator('img[src*="/signature"]')).toBeVisible();

    // Upload a stamp photo (dark ink on white paper).
    const stampPng = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 300;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 300, 300);
      g.strokeStyle = '#1d3a8a';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(150, 150, 120, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#1d3a8a';
      g.font = 'bold 36px sans-serif';
      g.fillText('REEF', 105, 165);
      return c.toDataURL('image/png').split(',')[1]!;
    });
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Stamp & signature' }).click();
    // No stamp image yet: one click makes a round stamp from the business name.
    await page.getByRole('button', { name: 'Create stamp from business name' }).click();
    await expect(page.locator('img[src*="/api/settings/stamp"]')).toBeVisible();
    expect(await page.locator('img[src*="/api/settings/stamp"]').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth >= 500)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/stamp-generated.png`, fullPage: true });
    await page.locator('input[type=file]').setInputFiles({ name: 'stamp.png', mimeType: 'image/png', buffer: Buffer.from(stampPng, 'base64') });
    await expect(page.locator('img[src*="/api/settings/stamp"]')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/stamp-settings.png`, fullPage: true });

    // A new invoice prepared by this user prints with the stamp and the signature.
    const inv = await page.evaluate(async () => {
      const token = (await (await fetch('/api/auth/session')).json()).csrfToken as string;
      const h = { 'x-csrf-token': token, 'content-type': 'application/json' };
      const c = (await (await fetch('/api/customers?q=Aishath')).json()).items[0].id as string;
      const r = await fetch('/api/invoices', { method: 'POST', headers: h, body: JSON.stringify({ customerId: c, invoiceDate: '2026-10-08', dueDate: '2026-10-31', items: [{ name: 'Catering', quantity: 1, unitPrice: 500 }] }) });
      return (await r.json()).id as string;
    });
    await page.goto(`/print/invoice/${inv}`);
    const stamp = page.locator('article img[src="/api/settings/stamp"]');
    const sign = page.locator('article img[src*="/signature"]');
    await expect(stamp).toBeVisible();
    await expect(sign).toBeVisible();
    expect(await stamp.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    expect(await sign.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    // Kept small on the page: the signature stays under ~1.3 cm tall and the stamp under ~2.2 cm.
    expect((await sign.boundingBox())!.height).toBeLessThanOrEqual(48);
    expect(await stamp.evaluate((i: HTMLImageElement) => i.offsetHeight)).toBeLessThanOrEqual(80);
    await page.screenshot({ path: `${SHOTS}/invoice-stamp-signature.png`, fullPage: true });

    // A fully paid invoice gets a big PAID stamp; a part-paid one does not.
    const ids = await page.evaluate(async (invId) => {
      const token = (await (await fetch('/api/auth/session')).json()).csrfToken as string;
      const h = { 'x-csrf-token': token, 'content-type': 'application/json' };
      const post = (u: string, b: unknown = {}) => fetch(u, { method: 'POST', headers: h, body: JSON.stringify(b) });
      await post(`/api/invoices/${invId}/issue`);
      const due = (await (await fetch(`/api/invoices/${invId}`)).json()).invoice.balanceDue as number;
      await post(`/api/invoices/${invId}/payments`, { method: 'card', amount: 100, reference: '', notes: '' });
      const partial = invId;
      const c = (await (await fetch('/api/customers?q=Aishath')).json()).items[0].id as string;
      const inv2 = (await (await post('/api/invoices', { customerId: c, invoiceDate: '2026-10-08', dueDate: '2026-10-31', items: [{ name: 'Snacks', quantity: 1, unitPrice: 50 }] })).json()).id as string;
      await post(`/api/invoices/${inv2}/issue`);
      const due2 = (await (await fetch(`/api/invoices/${inv2}`)).json()).invoice.balanceDue as number;
      await post(`/api/invoices/${inv2}/payments`, { method: 'cash', amount: due2 / 100, reference: '', notes: '' });
      const q = (await (await post('/api/quotations', { customerId: c, quotationDate: '2026-10-08', validUntil: '2026-10-31', items: [{ name: 'Party platter', quantity: 1, unitPrice: 300 }] })).json()).id as string;
      await post(`/api/quotations/${q}/reject`);
      return { partial, paid: inv2, rejected: q, due };
    }, inv);
    await page.goto(`/print/invoice/${ids.partial}`);
    await expect(page.locator('article')).toBeVisible();
    await expect(page.locator('img[data-stamp]')).toHaveCount(0);
    await page.goto(`/print/invoice/${ids.paid}`);
    const paidStamp = page.locator('article img[data-stamp="paid"]');
    await expect(paidStamp).toBeVisible();
    expect(await paidStamp.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().width > 300)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/invoice-paid-stamp.png`, fullPage: true });
    await page.goto(`/print/quotation/${ids.rejected}`);
    const rejStamp = page.locator('article img[data-stamp="rejected"]');
    await expect(rejStamp).toBeVisible();
    expect(await rejStamp.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/quotation-rejected-stamp.png`, fullPage: true });

    // Salary sheet print shows them too.
    const runId = await page.evaluate(async () => (await (await fetch('/api/payroll')).json()).items[0].id as string);
    await page.goto(`/print/payroll/${runId}`);
    await expect(page.locator('article img[src="/api/settings/stamp"]')).toBeVisible();
    await expect(page.locator('article img[src*="/signature"]')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/payroll-stamp-signature.png`, fullPage: true });

    // Each person gets their own A4 payslip to print or send as a PDF.
    const line = await page.evaluate(async (rid) => (await (await fetch(`/api/payroll/${rid}`)).json()).lines[0] as { id: string; name: string }, runId);
    await page.goto(`/print/payroll/${runId}/slip/${line.id}`);
    const slip = page.locator('article');
    await expect(slip).toContainText('Payslip');
    await expect(slip).toContainText(line.name);
    await expect(slip).toContainText('Employee signature');
    await expect(slip.locator('img[src*="/signature"]')).toBeVisible();
    expect(await slip.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(700);
    await page.screenshot({ path: `${SHOTS}/payslip.png`, fullPage: true });
  });

  test('billing: plan ends → owner pays by bank transfer slip → team rejects, then approves → business active', async ({ page, browser }) => {
    // The OceanX team sets the bank details shown to businesses.
    const sa = await browser.newContext();
    const sap = await sa.newPage();
    await sap.goto('/superadmin/login');
    await sap.getByLabel('Email').fill(SA_EMAIL);
    await sap.getByLabel('Password').fill(SA_PASSWORD);
    await sap.getByRole('button', { name: 'Sign in' }).click();
    await expect(sap).toHaveURL(/superadmin\/hub/);
    await sap.goto('/superadmin/settings');
    await sap.getByLabel('Bank details for payments').fill('Bank of Maldives\nOceanX Pvt Ltd\nMVR 7730000012345');
    await sap.getByRole('button', { name: 'Save changes' }).click();
    await expect(sap.getByText('Saved').first()).toBeVisible();

    // Reef Kitchen's plan ends: the owner is stopped by the payment screen.
    execSync(`psql "${E2E_DB}" -c "UPDATE subscriptions SET current_period_end = now() - interval '1 day' FROM businesses b WHERE b.id = subscriptions.business_id AND b.name = 'Reef Kitchen'"`);
    await login(page).catch(() => {});
    await page.goto('/');
    await expect(page.getByText('Choose a plan')).toBeVisible();
    await expect(page.getByText('MVR 7730000012345')).toBeVisible();
    await page.getByRole('button', { name: /^Pro/ }).click();
    await page.getByRole('button', { name: '3 months' }).click();
    await expect(page.getByText('USD 177.00')).toBeVisible();
    await page.getByLabel('Transfer reference (optional)').fill('BML-998877');
    await page.locator('input[type=file]').setInputFiles('e2e/fixtures/dish.jpg');
    await page.screenshot({ path: `${SHOTS}/billing-pay-screen.png`, fullPage: true });
    await page.getByRole('button', { name: 'Send slip for review' }).click();
    await expect(page.getByText('Payment under review')).toBeVisible();

    // The team opens Payments, sees the slip and rejects it with a reason.
    await sap.goto('/superadmin/payments');
    const row = sap.getByRole('row', { name: /Reef Kitchen/ });
    await expect(row).toContainText('USD 177.00');
    await expect(row).toContainText('BML-998877');
    await expect(row.getByRole('link', { name: 'View slip' })).toHaveAttribute('href', /\/api\/superadmin\/billing\/payments\/.+\/slip/);
    await sap.screenshot({ path: `${SHOTS}/billing-sa-pending.png`, fullPage: true });
    await row.getByRole('button', { name: 'Reject' }).click();
    await sap.getByLabel('Reason').fill('Amount not received yet');
    await sap.getByRole('dialog').getByRole('button', { name: 'Reject' }).click();
    await expect(sap.getByText('Payment rejected')).toBeVisible();

    // The owner sees why and sends the slip again; this time the team approves.
    await page.reload();
    await expect(page.getByText('Amount not received yet')).toBeVisible();
    await expect(page.getByText('USD 177.00')).toBeVisible(); // same plan and months as before
    await page.locator('input[type=file]').setInputFiles('e2e/fixtures/dish.jpg');
    await page.getByRole('button', { name: 'Send slip for review' }).click();
    await expect(page.getByText('Payment under review')).toBeVisible();
    await sap.reload();
    await sap.getByRole('row', { name: /Reef Kitchen/ }).getByRole('button', { name: 'Approve' }).click();
    await sap.getByRole('dialog').getByRole('button', { name: /Confirm|Approve/ }).click();
    await expect(sap.getByText('Payment approved')).toBeVisible();

    // Back in business: the dashboard opens and Billing shows the receipt.
    await page.reload();
    await expect(page.getByText('Choose a plan')).toHaveCount(0);
    await page.goto('/billing');
    await expect(page.getByText(/OXR-\d{4}-\d{5}/)).toBeVisible();
    await expect(page.getByText('Approved').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/billing-page.png`, fullPage: true });
    await sa.close();
  });

  test('retail shop: no restaurant screens; stock check by barcode; scan into the POS', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Business type').selectOption('supermarket');
    await page.getByLabel('Business name').fill('Corner Mart');
    await page.getByLabel('Your name').fill('Ibrahim Shareef');
    await page.getByLabel('Email').fill('owner@cornermart.test');
    await page.getByLabel('Password').fill('Corner-Mart-123');
    await page.getByRole('button', { name: 'Create my business' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ibrahim');
    const nav = page.locator('aside').first();
    await expect(nav.getByRole('link', { name: 'Stock check' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Products', exact: true })).toBeVisible();
    for (const food of ['Kitchen', 'Tables', 'QR Menu']) await expect(nav.getByRole('link', { name: food })).toHaveCount(0);

    // Two products with barcodes and stock.
    await page.evaluate(async () => {
      const token = (await (await fetch('/api/auth/session')).json()).csrfToken as string;
      const h = { 'x-csrf-token': token, 'content-type': 'application/json' };
      for (const [name, sku, qty] of [['Coconut Oil 1L', '8901234567891', 3], ['Basmati Rice 5kg', '8901234567892', 30]] as const) {
        const p = await (await fetch('/api/products', { method: 'POST', headers: h, body: JSON.stringify({ name, sku, sellingPrice: 45, trackStock: true, minStock: 5, unit: 'pcs' }) })).json();
        await fetch('/api/inventory/adjust', { method: 'POST', headers: h, body: JSON.stringify({ productId: p.id, mode: 'add', quantity: qty, reason: 'opening' }) });
      }
    });

    // The shopkeeper scans a barcode: low stock, 3 left.
    await page.goto('/stock-check');
    await page.getByLabel('Scan barcode or type product name…').fill('8901234567891');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Coconut Oil 1L')).toBeVisible();
    await expect(page.getByText('Low stock')).toBeVisible();
    await expect(page.getByText('3 pcs')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/retail-stock-check.png`, fullPage: true });

    // The POS has no dine-in; a scanned barcode goes straight into the cart.
    await page.goto('/pos');
    await expect(page.getByRole('radio', { name: 'Dine-in' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'In store' })).toBeVisible();
    const search = page.getByPlaceholder('Scan barcode or search…');
    await search.fill('8901234567892');
    await search.press('Enter');
    await expect(page.getByText('Basmati Rice 5kg').last()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pay/ }).last()).toContainText('45');
    await page.screenshot({ path: `${SHOTS}/retail-pos.png`, fullPage: true });

    // The sidebar shows the shop's own brand, never the OceanX icon: its first letter until a logo is uploaded...
    await page.goto('/');
    const side = page.locator('aside').first();
    await expect(side.getByText('C', { exact: true })).toBeVisible();
    await expect(side.locator('img[src^="/brand/"]')).toHaveCount(0);
    // ...then the logo itself.
    const status = await page.evaluate(async () => {
      const token = (await (await fetch('/api/auth/session')).json()).csrfToken as string;
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
      return (await fetch('/api/settings/logo', { method: 'PUT', headers: { 'x-csrf-token': token, 'content-type': 'image/png' }, body: png })).status;
    });
    expect(status).toBe(200);
    await page.reload();
    await expect(side.locator('img[src^="/api/settings/logo"]')).toBeVisible();
  });

  test('Super Admin creates a shop and gives the owner a first password; the owner must change it', async ({ page, browser }) => {
    const sa = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const sap = await sa.newPage();
    await sap.goto('/superadmin/login');
    await sap.getByLabel('Email').fill(SA_EMAIL);
    await sap.getByLabel('Password').fill(SA_PASSWORD);
    await sap.getByRole('button', { name: 'Sign in' }).click();
    await expect(sap).toHaveURL(/superadmin\/hub/);
    await sap.goto('/superadmin/retail');
    await sap.getByRole('button', { name: 'New business' }).click();
    const d = sap.getByRole('dialog');
    await d.getByLabel(/^Business name/).fill('Island Mart');
    await expect(d.getByLabel('Business type')).toHaveValue('retail_shop');
    await d.getByLabel(/^Name/).fill('Aminath Shiuna');
    await d.getByLabel(/^Email/).last().fill('owner@islandmart.test');
    await d.getByLabel('First password').fill('Island-First-2026');
    await d.getByRole('button', { name: 'New business' }).click();
    await expect(d.getByText('Sign-in details to give the owner')).toBeVisible();
    await expect(d.getByText('Island-First-2026')).toBeVisible();
    await sap.screenshot({ path: `${SHOTS}/sa-owner-credentials.png`, fullPage: true });
    await d.getByRole('button', { name: 'Copy details' }).click();
    expect(await sap.evaluate(() => navigator.clipboard.readText())).toContain('owner@islandmart.test');

    // The owner signs in with it and has to choose their own password first.
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@islandmart.test');
    await page.getByLabel('Password').fill('Island-First-2026');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Set a new password')).toBeVisible();
    await page.getByLabel('Current password').fill('Island-First-2026');
    await page.getByLabel('New password').fill('Shiuna-Own-Pass-1');
    await page.getByLabel('Confirm password').fill('Shiuna-Own-Pass-1');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('link', { name: 'Stock check' })).toBeVisible();
    await sa.close();
  });

  test('shop stock: store and rack, refill the rack, low-on-rack alert and report', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@cornermart.test');
    await page.getByLabel('Password').fill('Corner-Mart-123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/);

    // A new product that comes 12 to a case: 2 cases in the store, 6 on the rack, alert when 15 or fewer on the rack.
    await page.goto('/inventory');
    await page.getByRole('button', { name: 'Add product' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel(/^Name/).fill('Sunflower Oil 2L');
    await d.getByLabel('Barcode / SKU').fill('8901234567899');
    await d.getByLabel(/^Selling price/).fill('89');
    await d.getByLabel(/^Cost price/).fill('60');
    await d.getByLabel('Pieces per case').fill('12');
    await d.getByLabel('Cases', { exact: true }).fill('2');
    await d.getByLabel('Stock on rack now').fill('6');
    await d.getByLabel('Rack alert level').fill('15');
    await d.getByLabel('Store alert level (cases)').fill('1');
    await d.getByRole('button', { name: 'Save' }).click();
    const row = page.getByRole('row', { name: /Sunflower Oil 2L/ });
    await expect(row).toContainText('6 pcs');
    await expect(row).toContainText('2 cases');

    // Refill the rack by opening a case from the store.
    await row.getByRole('button', { name: 'Refill rack' }).click();
    await page.getByLabel('Cases to open').fill('1');
    await page.getByRole('dialog').getByRole('button', { name: 'Refill rack' }).click();
    await expect(page.getByText(/Rack refilled: 18 pcs on rack, 1 case left in store/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/shop-inventory.png`, fullPage: true });

    // Sell 6 at the POS: 12 left on the rack, which is below the alert level.
    await page.goto('/pos');
    const search = page.getByPlaceholder('Scan barcode or search…');
    await search.fill('8901234567899');
    await search.press('Enter');
    await page.getByLabel('Quantity').first().fill('6');
    await page.getByRole('button', { name: /^Pay/ }).last().click();
    await page.getByRole('button', { name: 'Complete sale' }).click();
    await expect(page.getByText('Sale complete')).toBeVisible();

    await page.goto('/reports');
    await page.getByLabel('Report').selectOption('rack-low');
    const r = page.getByRole('row', { name: /Sunflower Oil 2L/ });
    await expect(r).toContainText('12');
    await page.screenshot({ path: `${SHOTS}/shop-rack-low-report.png`, fullPage: true });

    await page.goto('/stock-check');
    await page.getByLabel('Scan barcode or type product name…').fill('8901234567899');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Low stock', { exact: true })).toBeVisible();
    await expect(page.getByText('In store · Low stock')).toBeVisible();
    await expect(page.getByText('1 case', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/shop-stock-check.png`, fullPage: true });
  });

  test('shop till: the rack limits what can be sold; a new pay-later customer buys on credit and pays back at the till', async ({ page, browser }) => {
    // The platform team switches on Credit (pay later) for Corner Mart.
    const sa = await browser.newContext();
    const sap = await sa.newPage();
    await sap.goto('/superadmin/login');
    await sap.getByLabel('Email').fill(SA_EMAIL);
    await sap.getByLabel('Password').fill(SA_PASSWORD);
    await sap.getByRole('button', { name: 'Sign in' }).click();
    await expect(sap).toHaveURL(/superadmin\/hub$/);
    const csrf = await sap.evaluate(async () => (await (await fetch('/api/superadmin/auth/session')).json()).csrfToken as string);
    const biz = await sap.evaluate(async () => (await (await fetch('/api/superadmin/businesses?q=Corner')).json()).items[0].id as string);
    const status = await sap.evaluate(
      async ([id, token]) => (await fetch(`/api/superadmin/businesses/${id}/addons/credit/grant`, { method: 'POST', headers: { 'x-csrf-token': token!, 'content-type': 'application/json' }, body: '{}' })).status,
      [biz, csrf],
    );
    expect(status).toBe(200);
    await sa.close();

    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@cornermart.test');
    await page.getByLabel('Password').fill('Corner-Mart-123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/pos');
    const search = page.getByPlaceholder('Scan barcode or search…');

    // Only 3 Coconut Oil on the rack: the 4th can't be added.
    for (let i = 0; i < 4; i++) {
      await search.fill('8901234567891');
      await search.press('Enter');
    }
    await expect(page.getByText('Only 3 Coconut Oil 1L left on the rack.')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).first().click();

    // A new customer with a pay-later account, made right at the till.
    await page.getByRole('button', { name: 'New customer' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel(/^Name/).fill('Aminath Rasheed');
    await d.getByLabel('Phone').fill('7654321');
    await d.getByLabel('Allow pay later (credit)').click();
    await d.getByLabel('Credit limit').fill('100');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Available credit\W*Rf 100\.00/)).toBeVisible();

    // Two bags of rice (90) on credit.
    await search.fill('8901234567892');
    await search.press('Enter');
    await search.fill('8901234567892');
    await search.press('Enter');
    await page.getByRole('button', { name: /^Pay/ }).last().click();
    await page.getByRole('button', { name: 'Credit (pay later)' }).click();
    await page.getByRole('button', { name: 'Complete sale' }).click();
    await expect(page.getByRole('dialog').getByText('Sale complete')).toBeVisible();
    await page.keyboard.press('Escape');

    // She comes back and pays 40 at the till.
    await page.getByPlaceholder('Search name, phone or email…').fill('Aminath');
    await page.getByRole('button', { name: /Aminath Rasheed/ }).click();
    await expect(page.getByText(/Rf 90\.00/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Receive payment' }).click();
    await page.getByLabel('Amount paid').fill('40');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText('Payment recorded').first()).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText(/Available credit\W*Rf 50\.00/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/shop-pos-credit.png`, fullPage: true });
  });

  test('shop sells to a council on invoice: government customer, PO added after issue, printed PO number, PV payment', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@cornermart.test');
    await page.getByLabel('Password').fill('Corner-Mart-123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Add the council as a government office.
    await page.goto('/customers');
    await page.getByRole('button', { name: 'New customer' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Customer type').selectOption('government');
    await d.getByLabel(/^Name of company or office/).fill('Male City Council');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('row', { name: /Male City Council/ })).toContainText('Government office');
    await page.getByLabel('Customer type').selectOption('government');
    await expect(page.getByRole('row')).toHaveCount(2);

    // Accepted quotation turned into an issued invoice (set up through the API).
    const invoiceId = await page.evaluate(async () => {
      const token = (await (await fetch('/api/auth/session')).json()).csrfToken as string;
      const h = { 'x-csrf-token': token, 'content-type': 'application/json' };
      const council = (await (await fetch('/api/customers?kind=government')).json()).items[0];
      const q = await (
        await fetch('/api/quotations', { method: 'POST', headers: h, body: JSON.stringify({ customerId: council.id, quotationDate: '2026-10-01', validUntil: '2026-10-31', customerRef: 'RFQ/2026/118', items: [{ name: 'A4 paper (box)', quantity: 10, unitPrice: 250 }] }) })
      ).json();
      await fetch(`/api/quotations/${q.id}/accept`, { method: 'POST', headers: h, body: '{}' });
      const inv = await (await fetch(`/api/quotations/${q.id}/convert`, { method: 'POST', headers: h, body: '{}' })).json();
      await fetch(`/api/invoices/${inv.id}/issue`, { method: 'POST', headers: h, body: '{}' });
      return inv.id as string;
    });

    // The PO arrives later: add it to the issued invoice.
    await page.goto(`/invoices/${invoiceId}`);
    await expect(page.getByText('RFQ/2026/118')).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).last().click();
    await page.getByRole('dialog').getByLabel('PO / reference no.').fill('PO-MCC-2026-0457');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('PO-MCC-2026-0457')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/shop-invoice-po.png`, fullPage: true });

    // Printed invoice shows the PO number.
    await page.goto(`/print/invoice/${invoiceId}`);
    await expect(page.getByText('PO No.')).toBeVisible();
    await expect(page.getByText('PO-MCC-2026-0457')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/shop-invoice-po-print.png`, fullPage: true });

    // Paid by payment voucher.
    await page.goto(`/invoices/${invoiceId}`);
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText('Payment voucher (PV), cheque or transfer number.')).toBeVisible();
    await page.getByRole('dialog').getByLabel('Reference').fill('PV-2026-3391');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/PV-2026-3391/)).toBeVisible();
    await expect(page.getByText('Paid').first()).toBeVisible();
  });

  test('tablet app start: signed out → sign in → straight into the POS', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/start');
    await expect(page).toHaveURL(/\/login\?next=%2Fstart$/);
    await page.getByLabel('Email').fill(OWNER.email);
    await page.getByLabel('Password').fill(OWNER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/pos$/);
    // A link to another site is never followed after sign-in.
    await page.goto('/login?next=//evil.example');
    await expect(page).toHaveURL(/\/$/);
  });

  test('tablet app is the POS only: back office screens return to the POS; sign out asks first', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(() => {
      (window as unknown as { OceanXAndroid: object }).OceanXAndroid = { print() {}, saveFile() {} };
    });
    const page = await ctx.newPage();
    await page.goto('/start');
    await page.getByLabel('Email').fill(OWNER.email);
    await page.getByLabel('Password').fill(OWNER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/pos$/);
    for (const path of ['/', '/settings', '/reports']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/pos$/);
    }
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fstart$/);
    await ctx.close();
  });

  test('in a normal browser the POS keeps its back arrow to the dashboard', async ({ page }) => {
    await login(page);
    await page.goto('/pos');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });
});

