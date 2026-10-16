import { expect, test } from '@playwright/test';

const SHOTS = 'e2e/screenshots';

/**
 * Gravity Budget on a phone: a person signs up (24-hour trial), sets up categories with limits and this month's
 * income, writes down spending, sees what is left and the safe amount per day, gets advice when a limit is passed,
 * adds and pays a monthly bill, saves into a goal, and opens the month's PDF report.
 */
test('budget: sign up → set up → spending & limits → bill → goal → PDF report', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const run = Date.now().toString(36);
  await page.goto('/budget');
  await expect(page).toHaveURL(/\/budget\/register$/);
  await expect(page.getByRole('heading', { name: 'Start your free trial' })).toBeVisible();
  // A person, not a business: no business name or type.
  await expect(page.getByLabel('Business type')).toHaveCount(0);
  await expect(page.getByLabel(/business name/i)).toHaveCount(0);
  await page.getByRole('textbox', { name: /^Your name\*?$/ }).fill('Aminath Rasheed');
  await page.getByLabel('Email').fill(`budget-${run}@budget.test`);
  await page.getByLabel('Password').fill('Budget-Pass-1234');
  await page.screenshot({ path: `${SHOTS}/budget-register.png`, fullPage: true });
  await page.getByRole('button', { name: 'Start my free trial' }).click();

  // First time: set up.
  await expect(page.getByRole('heading', { name: "Let's set up your budget" })).toBeVisible();
  await page.getByLabel(/^Income this month/).fill('15000');
  await page.getByLabel('Monthly limit for Food & groceries').fill('3000');
  await page.getByLabel('Monthly limit for Eating out & coffee').fill('500');
  await page.getByRole('button', { name: 'Fun & outings' }).click(); // not needed
  await page.screenshot({ path: `${SHOTS}/budget-setup.png`, fullPage: true });
  await page.getByRole('button', { name: 'Start my budget' }).click();

  // Home: everything still to spend.
  await expect(page.getByText('Left to spend this month')).toBeVisible();
  await expect(page.getByText('15,000.00').first()).toBeVisible();
  await expect(page.getByText(/You can spend (about )?.* (a day|today)/)).toBeVisible();

  // Spending: groceries by card, then coffee over its limit.
  // One "+ Add" button: amount, a category icon, and (optional) more details.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount').fill('1250.50');
  await dialog.getByRole('radio', { name: /Food & groceries/ }).click();
  await dialog.getByRole('button', { name: /More details/ }).click();
  await dialog.getByRole('button', { name: 'Card' }).click();
  await dialog.getByLabel(/^Note/).fill(`Weekly shopping ${run}`);
  await page.screenshot({ path: `${SHOTS}/budget-add.png` });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount').fill('620');
  await dialog.getByRole('radio', { name: /Eating out/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // Left = 15000 − 1250.50 − 620; advice says coffee is over its limit.
  await expect(page.getByText('13,129.50').first()).toBeVisible();
  await expect(page.getByText(/Eating out & coffee is .*120\.00\W* over its limit/)).toBeVisible();
  // Only the main tip shows; the rest are one tap away.
  await page.getByRole('button', { name: /more tip/ }).click();
  await expect(page.getByText(/120\.00\W* over the limit/)).toBeVisible();
  await expect(page.getByText(`Weekly shopping ${run}`)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-home.png`, fullPage: true });

  // My budget: a monthly bill.
  await page.getByRole('link', { name: 'My budget' }).last().click();
  await expect(page.getByRole('heading', { name: 'My budget', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Add' }).nth(1).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bill').fill('Dhiraagu');
  await dialog.getByLabel(/^Usual amount/).fill('450');
  await dialog.getByLabel('Due day').selectOption('28');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Every month on day 28')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-plan.png`, fullPage: true });

  // Home: the bill is waiting; pay it.
  await page.goto('/');
  await expect(page.getByText('Bills to pay')).toBeVisible();
  await expect(page.getByText(/Dhiraagu · .*450\.00/)).toBeVisible();
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Mark as paid' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Bills to pay')).toHaveCount(0);
  await expect(page.getByText('12,679.50').first()).toBeVisible();

  // Goals: save for a phone.
  await page.getByRole('link', { name: 'Goals' }).last().click();
  await expect(page.getByText('No goals yet')).toBeVisible();
  await page.getByRole('button', { name: 'New goal' }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '📱' }).click();
  await dialog.getByLabel('Goal').fill('New phone');
  await dialog.getByLabel(/^Amount needed/).fill('12000');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Put in' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Amount/).fill('2000');
  await dialog.getByRole('button', { name: 'Put in' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('2,000.00').first()).toBeVisible();
  await expect(page.getByText(/10,000\.00\W* still needed/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-goals.png`, fullPage: true });

  // Saved money is kept aside: left goes down by 2000.
  await page.goto('/');
  await expect(page.getByText('10,679.50').first()).toBeVisible();
  await page.getByRole('button', { name: /more tip/ }).click();
  await expect(page.getByText(/2,000\.00\W* put into your goals/)).toBeVisible();

  // The month's report (PDF).
  // Months: download this month as PDF.
  await page.goto('/history');
  await page.getByRole('link', { name: /Download .* as PDF/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Monthly money report' })).toBeVisible();
  await expect(page.getByText(`Weekly shopping ${run}`)).toBeVisible();
  await expect(page.getByText('Dhiraagu').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  await page.setViewportSize({ width: 1000, height: 1400 });
  await page.locator('article').screenshot({ path: `${SHOTS}/budget-report.png` });
});

/** Super Admin makes a Budget account for a person (no business details), and the person signs in. */
test('budget: Super Admin creates an account for a person', async ({ page, browser }) => {
  const { SA_EMAIL, SA_PASSWORD } = await import('./global-setup');
  const run = Date.now().toString(36);
  await page.goto('/superadmin/login');
  await page.getByLabel('Email').fill(SA_EMAIL);
  await page.getByLabel('Password').fill(SA_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/superadmin\/hub$/);
  await page.goto('/superadmin/budget/accounts');
  await page.getByRole('button', { name: 'New Budget account' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/Business name/)).toHaveCount(0);
  await expect(dialog.getByLabel(/Address/)).toHaveCount(0);
  await dialog.getByLabel(/^Full name/).fill(`Hawwa Ali ${run}`);
  await dialog.getByLabel(/^Email \(to sign in\)/).fill(`hawwa-${run}@budget.test`);
  await dialog.getByLabel('Phone').fill('7771234');
  const password = await dialog.getByLabel(/First password/).inputValue();
  await page.screenshot({ path: `${SHOTS}/budget-sa-create.png` });
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await dialog.getByRole('button', { name: 'Open account' }).click();
  await expect(page.getByText('Person', { exact: true })).toBeVisible();
  await expect(page.getByText(`Hawwa Ali ${run}`).first()).toBeVisible();

  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('/budget/login');
  await p.getByLabel('Email').fill(`hawwa-${run}@budget.test`);
  await p.getByLabel('Password').fill(password);
  await p.getByRole('button', { name: 'Sign in' }).click();
  // The first password is changed on first sign-in, then set-up starts.
  await expect(p.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await p.getByLabel(/^Current password/).fill(password);
  await p.getByLabel(/^New password/).fill('Hawwa-Budget-2026');
  await p.getByLabel(/^Confirm password/).fill('Hawwa-Budget-2026');
  await p.getByRole('button', { name: 'Change password' }).click();
  await expect(p.getByRole('heading', { name: "Let's set up your budget" })).toBeVisible();
  await ctx.close();
});
