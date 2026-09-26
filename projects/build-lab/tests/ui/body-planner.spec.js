import { test, expect } from '@playwright/test';

test('body planner previews badge availability and applies a body once', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Body & badge potential' }).click();

  const planner = page.locator('.body-planner');
  await expect(planner).toBeVisible();
  await expect(page.locator('.body-badge-tile')).toHaveCount(53);
  await expect(page.locator('.body-badge-tile.available').first()).toBeVisible();
  await expect(page.locator('.body-badge-tile.locked').first()).toBeVisible();

  const dialog = page.getByRole('dialog', { name: 'Body & badge potential' });
  expect((await dialog.boundingBox()).width).toBeGreaterThan(1000);
  expect(await planner.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).not.toBe('none');

  await page.getByRole('combobox', { name: 'Preview position' }).selectOption('PG');
  await page.getByRole('combobox', { name: 'Preview height' }).selectOption('75');
  await page.getByRole('button', { name: 'Apply body' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Position', exact: true })).toHaveValue('PG');
  await expect(page.getByRole('combobox', { name: 'Height', exact: true })).toHaveValue('75');
});

