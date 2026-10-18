import { expect, test } from '@playwright/test';
import { SA_EMAIL, SA_PASSWORD } from './global-setup';

const SHOTS = 'e2e/screenshots';

/**
 * Reviews: Super Admin asks POS users for a review; the owner sees a popup a few seconds after opening the
 * app, puts it off with "Later", then writes a review on their own from the user menu. Super Admin reads it.
 */
test('reviews: ask from Super Admin, popup with Later, write a review, read it in Super Admin', async ({ browser }) => {
  test.setTimeout(90_000);
  const run = Date.now().toString(36);
  const owner = await (await browser.newContext()).newPage();
  await owner.goto('/register');
  await owner.getByLabel('Business type').selectOption('takeaway');
  await owner.getByLabel('Business name').fill(`Review Cafe ${run}`);
  await owner.getByLabel('Your name').fill('Hawwa');
  await owner.getByLabel('Email').fill(`review-${run}@takeaway.test`);
  await owner.getByLabel('Password').fill('Review-Cafe-1234');
  await owner.getByRole('button', { name: 'Create my business' }).click();
  await expect(owner.getByRole('heading', { level: 1 })).toContainText('Hawwa');

  // Super Admin asks POS users.
  const sa = await (await browser.newContext()).newPage();
  await sa.goto('/superadmin/login');
  await sa.getByLabel('Email').fill(SA_EMAIL);
  await sa.getByLabel('Password').fill(SA_PASSWORD);
  await sa.getByRole('button', { name: 'Sign in' }).click();
  await expect(sa).toHaveURL(/superadmin\/hub$/);
  await sa.getByRole('link', { name: 'Reviews' }).first().click();
  await expect(sa.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible();
  await sa.getByLabel('App').first().selectOption('pos');
  await sa.getByLabel('Message (optional)').fill(`How is the POS working for your shop? ${run}`);
  await sa.getByRole('button', { name: 'Send request' }).click();
  await expect(sa.getByText('Review request sent')).toBeVisible();
  await expect(sa.getByText('Asking now').first()).toBeVisible();

  // The owner opens the app: the popup comes after a few seconds. "Later" closes it.
  await owner.reload();
  const popup = owner.getByRole('dialog');
  await expect(popup.getByText(`How is the POS working for your shop? ${run}`)).toBeVisible({ timeout: 15_000 });
  await expect(popup.getByRole('heading', { name: 'How do you like OceanX POS?' })).toBeVisible();
  await owner.screenshot({ path: `${SHOTS}/review-popup.png` });
  await popup.getByRole('button', { name: 'Later' }).click();
  await expect(popup).toHaveCount(0);
  await owner.reload();
  await owner.waitForTimeout(8000);
  await expect(owner.getByRole('dialog')).toHaveCount(0);

  // Writing a review on their own, from the user menu.
  await owner.getByRole('button', { name: /Hawwa/ }).last().click();
  await owner.getByRole('menuitem', { name: 'Write a review' }).click();
  const write = owner.getByRole('dialog');
  await expect(write.getByRole('button', { name: 'Send review' })).toBeDisabled();
  await write.getByRole('radio', { name: '4 stars' }).click();
  await expect(write.getByText('Very good')).toBeVisible();
  await write.getByLabel('Tell us more (optional)').fill(`Fast and easy at the counter ${run}`);
  await write.getByRole('button', { name: 'Send review' }).click();
  await expect(owner.getByText('Thank you for your review!')).toBeVisible();

  // Super Admin reads it.
  await sa.reload();
  await expect(sa.getByText(`Fast and easy at the counter ${run}`)).toBeVisible();
  const item = sa.locator('li').filter({ hasText: `Fast and easy at the counter ${run}` });
  await expect(item.getByText(`Hawwa · Review Cafe ${run}`)).toBeVisible();
  await expect(item.getByText('Written on their own')).toBeVisible();
  await expect(sa.locator('li').filter({ hasText: `How is the POS working for your shop? ${run}` }).getByText('1 said later')).toBeVisible();
  await sa.screenshot({ path: `${SHOTS}/sa-reviews.png`, fullPage: true });

  // Stop asking.
  await sa.locator('li').filter({ hasText: `How is the POS working for your shop? ${run}` }).getByRole('button', { name: 'Stop asking' }).click();
  await sa.getByRole('dialog').getByRole('button', { name: 'Stop asking' }).click();
  await expect(sa.locator('li').filter({ hasText: `How is the POS working for your shop? ${run}` }).getByText('Stopped')).toBeVisible();
});
