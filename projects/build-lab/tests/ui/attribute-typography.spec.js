import { test, expect } from "@playwright/test";

test("attribute rows keep a readable type scale without horizontal overflow", async ({ page }) => {
  await page.goto(
    "/?b=SF.81.185.84.80-89-90-94-75-60-70-62-70-53-45-83-85-77-88-65-75-75-83-71-73",
  );
  const row = page.locator(".attribute-row").first();
  const size = (selector) =>
    row
      .locator(selector)
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(await size(".attribute-name")).toBeGreaterThanOrEqual(13);
  expect(await size(".rating")).toBeGreaterThanOrEqual(18);
  expect(await size(".cap")).toBeGreaterThanOrEqual(14);
  expect(await size(".bar-cap-steps button")).toBeGreaterThanOrEqual(10);
  expect(await size(".attribute-hint")).toBeGreaterThanOrEqual(12);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
