import { test, expect } from "@playwright/test";

test("attributes grey out only while their next point cannot fit the overall budget", async ({
  page,
}) => {
  await page.goto(
    "/?b=SF.81.185.84.80-89-90-94-75-62-72-69-70-53-45-83-85-77-88-65-75-75-83-71-73",
  );
  const closeRow = page
    .locator(".attribute-row")
    .filter({ has: page.getByRole("spinbutton", { name: "Close Shot rating", exact: true }) });
  const postRow = page
    .locator(".attribute-row")
    .filter({ has: page.getByRole("spinbutton", { name: "Post Control rating", exact: true }) });
  await expect(closeRow).toHaveClass(/attribute-budget-blocked/);
  await expect(postRow).not.toHaveClass(/attribute-budget-blocked/);
  await expect(closeRow.locator('button[aria-label="Increase Close Shot"]')).toBeDisabled();
  const opacity = Number(
    await closeRow
      .locator(".attribute-label")
      .evaluate((element) => getComputedStyle(element).opacity),
  );
  expect(opacity).toBe(1);
  const free = page.getByRole("spinbutton", { name: "Free Throw rating", exact: true });
  await free.fill("25");
  await free.press("Enter");
  await expect(closeRow).not.toHaveClass(/attribute-budget-blocked/);
  await expect(closeRow.locator('button[aria-label="Increase Close Shot"]')).toBeEnabled();
});

test("99 OVR keeps unavailable slider fills in their attribute category colors", async ({
  page,
}) => {
  const build = {
    name: "Complete build",
    body: { position: "SF", height: 81, weight: 185, wingspan: 84 },
    ratings: {
      close: 77,
      layup: 68,
      dunk: 87,
      standing: 52,
      post: 42,
      mid: 87,
      three: 78,
      free: 62,
      pass: 70,
      handle: 70,
      swb: 70,
      interior: 84,
      perimeter: 85,
      steal: 77,
      block: 88,
      oreb: 70,
      dreb: 75,
      speed: 83,
      agility: 83,
      strength: 71,
      vertical: 75,
    },
    breakers: {},
  };
  await page.goto(`/#build=${encodeURIComponent(JSON.stringify(build))}`);
  await expect(page.getByText("99 OVR", { exact: true })).toBeVisible();
  const blockedFill = page.locator(".attribute-budget-blocked .slider-track>span").first();
  await expect(blockedFill).toBeVisible();
  await expect(blockedFill).not.toHaveCSS("background-color", "rgb(125, 137, 140)");
});
