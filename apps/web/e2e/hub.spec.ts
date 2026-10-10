import { expect, test } from '@playwright/test';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

/**
 * OceanX Hub (the team's main office): service → lead → client → quotation → invoice → payment,
 * plus a support ticket and a task.
 */
test('hub: lead becomes a client, is quoted, invoiced and pays', async ({ page }) => {
  const run = Date.now().toString(36);
  const SERVICE = `Hub E2E website ${run}`;
  const CLIENT = `Aminath Hub ${run}`;
  const TICKET = `Receipt printer offline ${run}`;
  const TASK = `Call Aminath about the domain ${run}`;
  await page.goto('/superadmin/login');
  await page.getByLabel('Email').fill(SA_EMAIL);
  await page.getByLabel('Password').fill(SA_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/superadmin\/hub$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome');
  await expect(page.getByRole('link', { name: 'Leads', exact: true })).toBeVisible();

  // Every OceanX project is listed; OceanX POS is built in and opens with its own menu (POS console + its work).
  await page.locator('aside').first().getByRole('link', { name: 'OceanX POS' }).click();
  await expect(page).toHaveURL(/superadmin\/p\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('OceanX POS');
  await expect(page.locator('aside').first().getByRole('link', { name: 'All businesses' })).toBeVisible();
  await expect(page.locator('aside').first().getByRole('link', { name: 'Main office' })).toBeVisible();

  // A new project (business line) gets its own space: a lead added inside it stays inside it.
  const PROJECT = `Websites ${run}`;
  await page.goto('/superadmin/hub');
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill(PROJECT);
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: `Open ${PROJECT}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(PROJECT);
  await expect(page.locator('aside').first().getByRole('link', { name: 'All businesses' })).toHaveCount(0);
  const projectUrl = page.url();
  await page.locator('aside').first().getByRole('link', { name: 'Leads', exact: true }).click();
  await page.getByRole('button', { name: 'New lead' }).click();
  await expect(page.getByRole('dialog').getByLabel('Project')).toHaveValue(projectUrl.split('/').pop()!);
  await page.getByRole('dialog').getByLabel('Name').fill(`Site lead ${run}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('row', { name: new RegExp(`Site lead ${run}`) })).toBeVisible();
  // The main office sees it too, tagged with the project.
  await page.goto('/superadmin/hub/leads');
  await expect(page.getByRole('row', { name: new RegExp(`Site lead ${run}`) })).toContainText(PROJECT);

  // A service with a standard price.
  await page.goto('/superadmin/hub/services');
  await page.getByRole('button', { name: 'New service' }).click();
  const svc = page.getByRole('dialog');
  await svc.getByLabel('Name').fill(SERVICE);
  await svc.getByLabel('Category').selectOption('websites');
  await svc.getByLabel('Price').fill('5000');
  await svc.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('row', { name: new RegExp(SERVICE) })).toBeVisible();

  // A lead from TikTok, then made into a client.
  await page.goto('/superadmin/hub/leads');
  await page.getByRole('button', { name: 'New lead' }).click();
  const lead = page.getByRole('dialog');
  await lead.getByLabel('Name').fill(CLIENT);
  await lead.getByLabel('Company').fill('Hub Trading');
  await lead.getByLabel('Source').selectOption('tiktok');
  await lead.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('row', { name: new RegExp(CLIENT) }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Make client' }).click();
  await expect(page).toHaveURL(/hub\/clients$/);
  await expect(page.getByRole('row', { name: new RegExp(CLIENT) })).toBeVisible();

  // Quotation priced from the service (server-side), sent, accepted, made into an invoice.
  await page.goto('/superadmin/hub/quotes');
  await page.getByRole('button', { name: 'New quotation' }).click();
  const q = page.getByRole('dialog');
  await q.getByLabel('Client').selectOption({ label: `${CLIENT} · Hub Trading` });
  await q.getByLabel('Service').selectOption({ label: SERVICE });
  await expect(q.getByLabel('Price')).toHaveValue('5000');
  await q.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/hub\/documents\//);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('OXQ-');
  await page.getByRole('button', { name: 'Mark sent' }).click();
  await page.getByRole('button', { name: 'Accepted' }).click();
  await page.getByRole('button', { name: 'Make invoice' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('OXI-');
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  const pay = page.getByRole('dialog');
  await expect(pay.getByLabel('Amount')).toHaveValue('5000.00');
  await pay.getByLabel('Amount').fill('2000');
  await pay.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Part paid')).toBeVisible();
  await page.getByRole('button', { name: 'Record payment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Paid', { exact: true })).toBeVisible();

  // The printed invoice carries OceanX's details and the client.
  const id = page.url().split('/').pop();
  await page.goto(`/superadmin/hub/print/${id}`);
  await expect(page.getByText(SERVICE)).toBeVisible();
  await expect(page.getByText(CLIENT).first()).toBeVisible();

  // Support ticket and a task.
  await page.goto('/superadmin/hub/tickets');
  await page.getByRole('button', { name: 'New ticket' }).click();
  const tk = page.getByRole('dialog');
  await tk.getByLabel('Subject').fill(TICKET);
  await tk.getByLabel('Priority').selectOption('urgent');
  await tk.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('row', { name: new RegExp(TICKET) })).toContainText('OXT-');

  await page.goto('/superadmin/hub/tasks');
  await page.getByLabel('Add', { exact: true }).fill(TASK);
  await page.getByLabel('Add', { exact: true }).press('Enter');
  const box = page.getByRole('checkbox', { name: TASK });
  await expect(box).toBeVisible();
  // Ticking it off moves it out of my open list and into Everyone's tasks as done.
  await box.click();
  await expect(box).toBeHidden();
  await page.getByRole('tab', { name: "Everyone's tasks" }).click();
  await expect(page.getByRole('checkbox', { name: TASK })).toBeChecked();
});
