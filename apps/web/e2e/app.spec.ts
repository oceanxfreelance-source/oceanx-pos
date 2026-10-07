import { expect, test, type Page } from '@playwright/test';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';
const OWNER = { email: 'owner@lagoon.test', password: 'Lagoon-Pass-123' };

async function registerBusiness(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Business type').selectOption('cafe');
  await page.getByLabel('Business name').fill('Lagoon Café');
  await page.getByLabel('Your name').fill('Mariyam Ali');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Create my business' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mariyam');
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main h1')).toBeVisible();
}

test.describe.serial('OceanX phase 1', () => {
  test('business login page never links to the Super Admin console', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    const hrefs = await page.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.some((h) => h.includes('superadmin'))).toBe(false);
    await page.screenshot({ path: `${SHOTS}/login-desktop.png`, fullPage: true });
  });

  test('owner registers a café and lands on a permission-driven dashboard', async ({ page }) => {
    await registerBusiness(page);
    const nav = page.locator('aside').first();
    for (const item of ['Dashboard', 'Users', 'Roles & permissions', 'Activity log', 'Settings']) await expect(nav.getByRole('link', { name: item })).toBeVisible();
    // Outlets requires the multi-outlet add-on, which is not granted.
    await expect(nav.getByRole('link', { name: 'Outlets' })).toHaveCount(0);
    await expect(page.getByText('Lagoon Café').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/dashboard-desktop.png`, fullPage: true });
  });

  test('Dhivehi switches the whole UI to RTL and uses the Faruma font', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('menuitem', { name: 'ދިވެހި' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'dv');
    await expect(page.getByRole('link', { name: 'ބޭނުންކުރާ ފަރާތްތައް' })).toBeVisible();
    // Faruma is bundled: it loads, and no "font missing" warning is shown.
    expect(await page.evaluate(async () => (await document.fonts.load('16px Faruma', 'ދިވެހި')).some((f) => f.status === 'loaded'))).toBe(true);
    await expect(page.getByRole('alert').filter({ hasText: 'Faruma font file is required' })).toHaveCount(0);
    // Sidebar sits on the right in RTL.
    const box = await page.locator('aside').first().boundingBox();
    expect(box!.x).toBeGreaterThan(600);
    await page.screenshot({ path: `${SHOTS}/dashboard-dv-desktop.png`, fullPage: true });
    await page.goto('/users');
    await expect(page.getByRole('table')).toBeVisible();
    // No English fallbacks (e.g. Intl relative time) leak into the Dhivehi UI.
    await expect(page.locator('main').getByText(/\bago\b|seconds|minutes/)).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/users-dv-desktop.png`, fullPage: true });
    // Preference is stored per user on the server: reload keeps Dhivehi.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // Switch back to English for the following tests.
    await page.getByRole('button', { name: 'ބަސް' }).click();
    await page.getByRole('menuitem', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('owner creates a cashier; cashier sees only cashier navigation', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto('/users');
    await page.getByRole('button', { name: 'Add user' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Name\s*\*?$/).fill('Ahmed Cashier');
    await dialog.getByLabel('Email').fill('cashier@lagoon.test');
    await dialog.getByLabel('Initial password').fill('Cashier-Pass-1');
    await dialog.getByLabel('Cashier').check();
    await dialog.getByRole('switch').click(); // no forced password change for the test
    await dialog.getByRole('button', { name: 'Add user' }).click();
    await expect(page.getByRole('table').getByText('Ahmed Cashier')).toBeVisible();

    await page.context().clearCookies();
    await login(page, 'cashier@lagoon.test', 'Cashier-Pass-1');
    const nav = page.locator('aside').first();
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0);
    // URL manipulation does not help: the API refuses.
    const res = await page.request.get('/api/users');
    expect(res.status()).toBe(403);
  });

  test('signing out goes to the sign-in page and stays signed out', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.locator('header').getByRole('button').filter({ hasText: /\w/ }).last().click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Password')).toBeVisible();
    // The old session is gone on the server too: reloading or going back does not sign in again.
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get('/api/auth/session')).status()).toBe(401);
  });

  test('business users cannot reach the Super Admin console', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/superadmin/dashboard');
    await expect(page).toHaveURL(/\/superadmin\/login$/);
    expect((await page.request.get('/api/superadmin/businesses')).status()).toBe(401);
  });

  test('Super Admin signs in, sees the platform dashboard and the new café', async ({ page }) => {
    await page.goto('/superadmin/login');
    await page.getByLabel('Email').fill(SA_EMAIL);
    await page.getByLabel('Password').fill(SA_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Platform dashboard' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/sa-dashboard-desktop.png`, fullPage: true });
    await page.getByRole('link', { name: 'Cafés' }).click();
    await expect(page.getByText('Lagoon Café').first()).toBeVisible();
    await page.getByText('Lagoon Café').first().click();
    await expect(page.getByRole('heading', { name: 'Lagoon Café' })).toBeVisible();
    // Grant the multi-outlet add-on from the console.
    const row = page.locator('li').filter({ hasText: 'Multiple Outlets' });
    await row.getByRole('button', { name: 'Grant' }).click();
    await expect(row.getByRole('button', { name: 'Revoke' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/sa-business-detail.png`, fullPage: true });
  });

  test('granted add-on appears in business navigation', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await expect(page.locator('aside').first().getByRole('link', { name: 'Outlets' })).toBeVisible();
  });

  for (const vp of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 820, height: 1180 },
  ]) {
    test(`responsive layout: ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await login(page, OWNER.email, OWNER.password);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Below lg the sidebar is replaced by a drawer opened from the menu button.
      await expect(page.locator('aside').first()).toBeHidden();
      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
      await page.getByRole('link', { name: 'Users' }).click();
      // Drawer closes after navigation; tables become stacked cards on small screens.
      await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0);
      await expect(page.getByText('Ahmed Cashier').filter({ visible: true }).first()).toBeVisible();
      const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(noHScroll).toBe(true);
      await page.screenshot({ path: `${SHOTS}/users-${vp.name}.png`, fullPage: true });
    });
  }
});
