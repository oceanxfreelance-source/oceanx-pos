import { expect, test } from '@playwright/test';

const SHOTS = 'e2e/screenshots';

/** Gravity Budget: the person turns on loan repayment from salary, adds a loan, and the next salary pays it. */
test('budget: loan repayment is cut from the salary automatically', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const run = Date.now().toString(36);
  await page.goto('/budget/register');
  await page.getByRole('textbox', { name: /^Your name\*?$/ }).fill('Ahmed Ali');
  await page.getByLabel('Email').fill(`salaryloan-${run}@budget.test`);
  await page.getByLabel('Password').fill('Budget-Pass-1234');
  await page.getByRole('button', { name: 'Start my free trial' }).click();
  await page.getByRole('button', { name: 'Start my budget' }).click();
  await expect(page.getByText('Left to spend this month')).toBeVisible();

  // Off by default: the person turns it on in My budget and writes the loan.
  await page.getByRole('link', { name: 'My budget' }).last().click();
  const sw = page.getByRole('switch', { name: /Loan repayment from salary/ });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add loan' })).toBeVisible();
  await dialog.getByLabel(/^Loan/).fill('BML loan');
  await dialog.getByLabel(/^Still owed/).fill('7000');
  await dialog.getByLabel(/^Monthly repayment/).fill('3000');
  await page.screenshot({ path: `${SHOTS}/budget-salary-loan-add.png` });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/3,000\.00\W* a month · 3 months left/)).toBeVisible();
  await expect(page.getByText(/Cut from each salary: .*3,000\.00/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/budget-salary-loans.png`, fullPage: true });

  // Salary in: the repayment is ticked and cut.
  await page.goto('/');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const add = page.getByRole('dialog');
  await add.getByRole('tab', { name: 'Income' }).click();
  await add.getByLabel('Amount').fill('15000');
  await add.getByRole('radio', { name: /Salary/ }).click();
  const cut = add.getByRole('checkbox', { name: /Cut loan repayments from this/ });
  await expect(cut).toBeChecked();
  await page.screenshot({ path: `${SHOTS}/budget-salary-loan-cut.png` });
  await add.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Saved\. .*3,000\.00\W* cut for your loan\./)).toBeVisible();
  await expect(page.getByText('BML loan').first()).toBeVisible();

  // My budget: 4,000 still owed, 2 months left.
  await page.getByRole('link', { name: 'My budget' }).last().click();
  await expect(page.getByText(/4,000\.00/).first()).toBeVisible();
  await expect(page.getByText(/3,000\.00\W* a month · 2 months left/)).toBeVisible();
});
