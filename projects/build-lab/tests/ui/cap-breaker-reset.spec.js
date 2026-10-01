import { test, expect } from "@playwright/test";

test("reset icon clears one attribute and Undo restores it", async ({ page }) => {
  await page.goto("/?b=SF.81.185.84." + Array(21).fill(25).join("-"));
  await page.getByRole("button", { name: "Close Shot cap allocation 5", exact: true }).click();
  await page.getByRole("button", { name: "Driving Layup cap allocation 2", exact: true }).click();

  await expect(page.getByText("Clear", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reset all Close Shot cap breakers", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close Shot cap allocation 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Driving Layup cap allocation 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Close Shot cap allocation 5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("edited builds show numeric cap-breaker gains", async ({ page }) => {
  await page.goto(
    "/?b=SF.81.185.84.80-89-93-94-75-60-70-62-70-53-45-83-85-77-88-65-75-75-83-71-73",
  );
  const steps = page.locator('.bar-cap-steps button[aria-label*="cap allocation"]');
  await expect(steps).toHaveCount(105);
  await expect(steps.filter({ hasText: "?" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Close Shot cap allocation 1", exact: true }),
  ).toHaveAttribute("title", /cap breaker 1: \+\d+/i);
  expect(
    await steps.evaluateAll((elements) => [
      ...new Set(elements.map((element) => getComputedStyle(element).textDecorationLine)),
    ]),
  ).toEqual(["none"]);
});

test("cap-breaker numbers stay upright inside the angled cells", async ({ page }) => {
  await page.goto(
    "/?b=SF.81.185.84.80-89-93-94-75-60-70-62-70-53-45-83-85-77-88-65-75-75-83-71-73",
  );
  await page.getByRole("button", { name: "Cap breakers", exact: true }).click();
  const values = page.locator(
    '.bar-cap-steps > button[aria-label*="cap allocation"] > .cap-step-value',
  );
  await expect(values).toHaveCount(105);
  await expect(page.locator(".bar-cap-total > .cap-step-value")).toHaveCount(21);
});
