import { test, expect } from "@playwright/test";

const headings = (page, lane) =>
  page.locator(".attribute-columns>div").nth(lane).locator(".attribute-group h2");

test("attribute categories follow the in-game lane order", async ({ page }) => {
  await page.goto("/");
  await expect(headings(page, 0)).toHaveText(["Finishing", "Rebounding"]);
  await expect(headings(page, 1)).toHaveText(["Shooting", "Defense"]);
  await expect(headings(page, 2)).toHaveText(["Playmaking", "Physicals"]);
});

test("attribute rows never spill into the neighbouring lane", async ({ page }) => {
  for (const width of [1200, 1487, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const overlaps = await page.evaluate(
      () =>
        [...document.querySelectorAll(".attribute-label, .rating, .cap")].filter((element) => {
          const lane = element.closest(".attribute-group").getBoundingClientRect();
          return element.getBoundingClientRect().right > lane.right + 1;
        }).length,
    );
    expect(overlaps, `viewport ${width}px`).toBe(0);
  }
});
