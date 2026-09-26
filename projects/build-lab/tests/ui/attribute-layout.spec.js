import {test,expect} from '@playwright/test';

test('attribute categories use the requested two-column order',async({page})=>{
  await page.goto('/');
  const columns=page.locator('.attribute-columns>div');
  await expect(columns.nth(0).locator('.attribute-group h2')).toHaveText(['Finishing','Playmaking','Rebounding']);
  await expect(columns.nth(1).locator('.attribute-group h2')).toHaveText(['Shooting','Defense','Physicals']);
});
