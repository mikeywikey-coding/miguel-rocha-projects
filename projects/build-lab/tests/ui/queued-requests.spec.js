import { test, expect } from "@playwright/test";

const blank = "/?b=SF.81.185.84." + Array(21).fill(25).join("-");
const attributeIds = [
  "close",
  "layup",
  "dunk",
  "standing",
  "post",
  "mid",
  "three",
  "free",
  "pass",
  "handle",
  "swb",
  "interior",
  "perimeter",
  "steal",
  "block",
  "oreb",
  "dreb",
  "speed",
  "agility",
  "strength",
  "vertical",
];
test("last selected cap clears that attribute and can be undone in both modes", async ({
  page,
}) => {
  await page.goto(blank);
  for (const mode of ["Combined", "Cap breakers"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    const fifth = page.getByRole("button", { name: "Close Shot cap allocation 5", exact: true });
    await fifth.click();
    await expect(fifth).toHaveAttribute("aria-pressed", "true");
    const other = page.getByRole("button", { name: "Driving Layup cap allocation 2", exact: true });
    await other.click();
    await fifth.click();
    await expect(
      page.getByRole("button", { name: "Close Shot cap allocation 1", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(other).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Undo last change", exact: true }).click();
    await expect(fifth).toHaveAttribute("aria-pressed", "true");
    await fifth.click();
    await other.click();
  }
});
test("last available cap also clears when body permits fewer than five", async ({ page }) => {
  await page.goto(
    "/?b=SF.81.185.84.80-89-90-94-76-62-72-69-70-53-45-83-85-77-88-65-75-75-83-71-73",
  );
  const last = page.getByRole("button", { name: "Driving Dunk cap allocation 2", exact: true });
  await last.click();
  await expect(last).toHaveAttribute("aria-pressed", "true");
  await last.click();
  await expect(
    page.getByRole("button", { name: "Driving Dunk cap allocation 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("rating edits keep selected badge and tier while a different attribute opens its badges", async ({
  page,
}) => {
  await page.goto(blank);
  await page.getByRole("button", { name: "Driving Dunk", exact: true }).click();
  await page.locator(".unlock-row").filter({ hasText: "Posterizer" }).click();
  await page.locator(".badge-tier-card").nth(2).click();
  const detail = page.locator(".badge-detail");
  const slider = page.getByRole("slider", { name: "Driving Dunk slider", exact: true });
  await slider.focus();
  await slider.press("ArrowRight");
  await page.getByRole("button", { name: "Increase Driving Dunk", exact: true }).click();
  await page.getByRole("button", { name: "Decrease Driving Dunk", exact: true }).click();
  await expect(detail.getByRole("heading")).toHaveText("Posterizer");
  await expect(detail.locator(".badge-tier-card").nth(2)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Driving Dunk cap allocation 2", exact: true }).click();
  await expect(detail.getByRole("heading")).toHaveText("Posterizer");
  await expect(detail.locator(".badge-tier-card").nth(2)).toHaveAttribute("aria-pressed", "true");
  const shooting = page.getByRole("slider", { name: "Three-Point Shot slider", exact: true });
  await shooting.focus();
  await shooting.press("ArrowRight");
  await expect(page.getByLabel("Unlock category")).toHaveValue("sht");
  await expect(page.locator(".unlock-row").filter({ hasText: "Set And Fire" })).toBeVisible();
});
test("reachable badges are grey without ineligible labels, impossible tiers explain body limit", async ({
  page,
}) => {
  await page.goto(blank);
  await page.getByRole("button", { name: "Driving Dunk", exact: true }).click();
  const poster = page.locator(".unlock-row").filter({ hasText: "Posterizer" });
  await expect(poster).toHaveClass(/badge-unavailable/);
  await expect(poster.locator(".unlock-availability")).toHaveCount(0);
  await poster.click();
  const tiers = page.locator(".badge-tier-card");
  await expect(tiers.nth(0).locator(".unlock-availability")).toHaveCount(0);
  await expect(tiers.nth(3).locator(".unlock-availability")).toHaveText("Not eligible");
  await expect(page.locator(".bronze-unavailable-note")).toHaveCount(0);
  await page.getByLabel("Unlock category").selectOption("all");
  const mini = page.locator(".unlock-row").filter({ hasText: "Mini Marksman" });
  await expect(mini.locator(".unlock-availability")).toHaveText("Not eligible");
});
test("selected cost panel follows attribute and explains linked costs and locks", async ({
  page,
}) => {
  await page.goto(blank);
  await page.getByRole("button", { name: "Driving Dunk", exact: true }).click();
  await page.getByLabel("Driving Dunk rating", { exact: true }).fill("87");
  await page.getByLabel("Driving Dunk rating", { exact: true }).blur();
  const panel = page.getByRole("region", { name: "Attribute increase cost" });
  await expect(panel).toContainText("87 → 88");
  await expect(panel).toContainText("OVR");
  await expect(panel.getByRole("meter")).toBeVisible();
  await page.getByRole("button", { name: "Lock Driving Dunk", exact: true }).click();
  await expect(panel).toContainText("Unlock Driving Dunk");
});

test("saved library survives when a draft record is absent", async ({ page }) => {
  const snapshot = {
    id: "saved-only",
    date: "2026-09-13T00:00:00.000Z",
    build: {
      name: "Keep me",
      body: { position: "SF", height: 81, weight: 185, wingspan: 84 },
      ratings: Object.fromEntries(
        [
          "close",
          "layup",
          "dunk",
          "standing",
          "post",
          "mid",
          "three",
          "free",
          "pass",
          "handle",
          "swb",
          "interior",
          "perimeter",
          "steal",
          "block",
          "oreb",
          "dreb",
          "speed",
          "agility",
          "strength",
          "vertical",
        ].map((id) => [id, 25]),
      ),
      breakers: {},
      locks: {},
    },
  };
  await page.addInitScript((item) => {
    localStorage.removeItem("build-lab-v1");
    localStorage.setItem("build-lab-saved-builds", JSON.stringify({ version: 1, saved: [item] }));
  }, snapshot);
  await page.goto(blank);
  await page.getByRole("button", { name: "Saved builds" }).click();
  await expect(page.getByText("Keep me", { exact: true })).toBeVisible();
});

test("planned cap breakers do not unlock badges on the current build", async ({ page }) => {
  const build = {
    name: "Badge cap check",
    body: { position: "SF", height: 81, weight: 185, wingspan: 84 },
    ratings: Object.fromEntries(attributeIds.map((id) => [id, id === "handle" ? 70 : 25])),
    breakers: { handle: 1 },
  };
  await page.goto(`/#build=${encodeURIComponent(JSON.stringify(build))}`);
  await page.getByRole("button", { name: "Ball Handle", exact: true }).click();
  await expect(page.locator(".unlock-row").filter({ hasText: "Handles For Days" })).toHaveClass(
    /badge-unavailable/,
  );
});

test("cap endpoint shows maximum potential before and selected potential after allocation", async ({
  page,
}) => {
  const build = {
    name: "Cap endpoint check",
    body: { position: "SF", height: 81, weight: 185, wingspan: 84 },
    ratings: Object.fromEntries(attributeIds.map((id) => [id, id === "dunk" ? 90 : 25])),
    breakers: {},
  };
  await page.goto(`/#build=${encodeURIComponent(JSON.stringify(build))}`);
  await page.getByRole("button", { name: "Cap breakers", exact: true }).click();
  const endpoint = page.locator('[aria-label="Driving Dunk cap breakers"] .bar-cap-total');
  await expect(endpoint).toHaveText("93");
  await page.getByRole("button", { name: "Driving Dunk cap allocation 1", exact: true }).click();
  await expect(endpoint).toHaveText("91");
  await page.getByRole("button", { name: "Driving Dunk cap allocation 3", exact: true }).click();
  await expect(endpoint).toHaveText("93");
});

test("category lock toggles every attribute in that category", async ({ page }) => {
  await page.goto(blank);
  const categoryLock = page.getByRole("button", { name: "Lock Finishing category", exact: true });
  await categoryLock.click();
  await expect(page.getByRole("button", { name: "Unlock Close Shot", exact: true })).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Driving Dunk slider", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Unlock Finishing category", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lock Close Shot", exact: true })).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Driving Dunk slider", exact: true }),
  ).toBeEnabled();
});
