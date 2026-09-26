import { test, expect } from '@playwright/test';
const empty='/?b=SF.81.185.84.'+Array(21).fill(25).join('-');

test('edits preserve focus, clamp numeric values, update requirements, and undo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(empty);
  const dunk = page.getByRole('spinbutton', { name: 'Driving Dunk rating', exact: true });
  await dunk.fill('88');
  await dunk.press('Enter');
  await expect(dunk).toHaveValue('88');
  const goldPosterizer = page.locator('.badge-tier-card').filter({ hasText: 'Gold' });
  await expect(goldPosterizer).toContainText('93 Driving Dunk (88)');
  await expect(goldPosterizer.locator('.badge-tier-status')).toHaveClass(/locked/);
  const slider = page.getByRole('slider', { name: 'Driving Dunk slider', exact: true });
  await slider.focus();
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  await expect(dunk).toHaveValue('90');
  await expect(slider).toBeFocused();
  await dunk.fill('9999');
  await dunk.press('Tab');
  await expect(dunk).toHaveValue('93');
  await dunk.fill('9999');
  await dunk.press('Tab');
  await expect(dunk).toHaveValue('93');
  await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
  await expect(dunk).toHaveValue('90');
  await expect(goldPosterizer).toContainText('93 Driving Dunk (90)');
  expect(errors).toEqual([]);
});

test('save and reload a build, compare a draft, and revert safely', async ({ page }) => {
  await page.goto(empty);
  const initialThree=page.getByRole('spinbutton',{name:'Three-Point Shot rating',exact:true});
  await initialThree.fill('75');await initialThree.press('Enter');
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Build name' }).fill('Wing experiment');
  await dialog.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('0 unsaved changes');
  const three = page.getByRole('spinbutton', { name: 'Three-Point Shot rating', exact: true });
  await three.fill('80'); await three.press('Enter');
  await page.reload();
  await expect(three).toHaveValue('80');
  await page.getByRole('button', { name: /Saved builds/ }).click();
  await expect(page.locator('.saved-list h2')).toHaveText('Wing experiment');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.change-list')).toContainText('+5');
  await page.getByRole('button', { name: 'Revert changes', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revert changes', exact: true }).click();
  await expect(three).toHaveValue('75');
  await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
  await expect(three).toHaveValue('80');
});

test('unlock search and all/either requirements respond to actual ratings', async ({ page }) => {
  await page.goto(empty);
  const perimeter = page.getByRole('spinbutton', { name: 'Perimeter Defense rating', exact:true });
  await perimeter.fill('80');await perimeter.press('Enter');
  await page.getByRole('tab', { name: 'Unlocks', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search unlocks' }).fill('Off-Ball Pest');
  await page.getByLabel('Unlock status', {exact:true}).selectOption('met');
  await expect(page.locator('.unlock-row')).toHaveCount(1);
  await expect(page.locator('.unlock-row small')).toHaveText('Gold');
  await perimeter.fill('79'); await perimeter.press('Enter');
  await expect(page.locator('.unlock-row small')).toHaveText('Silver');
  const interior = page.getByRole('spinbutton', { name:'Interior Defense rating',exact:true });
  await interior.fill('85'); await interior.press('Enter');
  await expect(page.locator('.unlock-row')).toHaveCount(1);
  await expect(page.locator('.unlock-row small')).toHaveText('Gold');
  await page.getByRole('button', {name:'animations',exact:true}).click();
  await expect(page.locator('.animation-card').first()).toBeVisible();
  await expect(page.locator('.animation-requirement').first()).toContainText('Requires');
  await expect(page.locator('.animation-status').first()).toBeVisible();
});

test('cap plans preserve physical caps and shared links round-trip', async ({ page, context }) => {
  await page.goto('/');
  await page.locator('.header-actions').getByRole('button', {name:/^Cap breakers/}).click();
  const modal = page.getByRole('dialog');
  for(let i=0;i<2;i++) await modal.getByRole('button',{name:'Add Driving Dunk cap breaker',exact:true}).click();
  await expect(modal.getByRole('button',{name:'Add Driving Dunk cap breaker',exact:true})).toBeDisabled();
  await modal.getByRole('button',{name:'Done',exact:true}).click();
  const dunk = page.getByRole('spinbutton',{name:'Driving Dunk rating',exact:true});
  await expect(dunk).toHaveValue('87');
  await expect(dunk).toHaveAttribute('max','93');
  await page.getByRole('button',{name:'Share build',exact:true}).click();
  const url = await page.getByRole('textbox',{name:'Build link',exact:true}).inputValue();
  const shared = await context.newPage();
  await shared.goto(url);
  await expect(shared.getByRole('spinbutton',{name:'Driving Dunk rating',exact:true})).toHaveValue('87');
  await expect(shared.locator('.count')).toHaveText('2');
});

test('mobile has no horizontal overflow and exposes cap breakers and sharing', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(empty);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('navigation').getByRole('button',{name:'Cap breakers',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('navigation').getByRole('button',{name:'Share',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Build link',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('spinbutton',{name:'Driving Dunk rating',exact:true}).fill('90');
  await page.getByRole('spinbutton',{name:'Driving Dunk rating',exact:true}).press('Enter');
  await page.getByRole('tab',{name:/Changes/}).scrollIntoViewIfNeeded();
  await expect(page.locator('.change-list')).toContainText('+65');
});

test('invalid shared payload fails gracefully without losing the local draft', async ({ page }) => {
  await page.goto(empty);
  const close = page.getByRole('spinbutton',{name:'Close Shot rating',exact:true});
  await close.fill('81'); await close.press('Enter');
  await page.goto('/#build=%7Bbad');
  await page.reload();
  await expect(close).toHaveValue('81');
  await expect(page.getByRole('status')).toContainText('could not be read');
});

test('body controls open the body potential planner and reset clears locked ratings', async ({ page }) => {
  await page.goto(empty);
  await page.getByRole('button', { name: 'Lock Driving Dunk', exact: true }).click();
  await page.getByText('Height', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Body & badge potential' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reset build', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset attributes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lock Driving Dunk', exact: true })).toBeVisible();
});

test('saving a duplicate name offers replacement and saved builds can be renamed', async ({ page }) => {
  await page.goto(empty);
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Build name' }).fill('Rename me');
  await page.getByRole('dialog').getByRole('button', { name: 'Save build', exact: true }).click();
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Build name' }).fill('Rename me');
  await page.getByRole('dialog').getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Replace saved build?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace build', exact: true }).click();
  await page.getByRole('button', { name: /Saved builds/ }).click();
  await page.getByRole('button', { name: 'Rename Rename me', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Build name' }).fill('Renamed');
  await page.getByRole('dialog').getByRole('button', { name: 'Update name', exact: true }).click();
  await expect(page.locator('.saved-list h2')).toHaveText('Renamed');
});
