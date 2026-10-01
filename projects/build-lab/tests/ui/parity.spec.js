import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("a constrained edit displays the accepted value even when the build does not change", async ({
  page,
}) => {
  await page.route("**/src/engine/ruleset*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const rulesetStatus='synthetic-test';export const dependencyRules=[{source:'dunk',target:'layup',steps:[[90,99]]}];`,
    }),
  );
  await page.goto("/?b=SF.81.185.84." + Array(21).fill(25).join("-"));
  const dunk = page.getByRole("spinbutton", { name: "Driving Dunk rating", exact: true });
  await dunk.fill("89");
  await dunk.press("Enter");
  await dunk.fill("90");
  await dunk.press("Enter");
  await expect(dunk).toHaveValue("89");
  await expect(page.getByRole("slider", { name: "Driving Dunk slider", exact: true })).toHaveValue(
    "89",
  );
});

test("a corrupt snapshot does not discard valid snapshots or the draft", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("build-lab-v1"));
    raw.saved = [
      { id: "good", date: "2026-09-07", build: { ...raw.current, name: "Keep this build" } },
      { id: "bad", build: {} },
    ];
    localStorage.setItem("build-lab-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.getByRole("button", { name: /Saved builds/ }).click();
  await expect(page.locator(".saved-list h2")).toHaveText("Keep this build");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("build-lab-v1")).saved.length),
  ).toBe(1);
});

test("view modes, stepper preference, and reset preserve saved context", async ({ page }) => {
  await page.goto("/");
  const views = page.getByRole("group", { name: "Editor view" });
  await expect(views.getByRole("button")).toHaveText(["Combined", "Cap breakers"]);
  await page.getByLabel("+/- on hover", { exact: true }).uncheck();
  await expect(
    page.getByRole("button", { name: "Decrease Driving Dunk", exact: true }),
  ).toBeVisible();
  await views.getByRole("button", { name: "Cap breakers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Driving Dunk cap allocation 1", exact: true }),
  ).toBeVisible();
  await views.getByRole("button", { name: "Combined", exact: true }).click();
  await page.getByRole("button", { name: "Reset build", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset attributes", exact: true })
    .click();
  const ratings = await page
    .locator(".rating")
    .evaluateAll((inputs) => inputs.map((i) => Number(i.value)));
  expect(ratings).toHaveLength(21);
  expect(ratings.every((n) => n === 25)).toBeTruthy();
  await expect(page.locator(".body-controls")).toContainText("PositionSF");
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Driving Dunk rating", exact: true }),
  ).toHaveValue("87");
});

test("URL updates as ratings change and the original b format imports", async ({ page }) => {
  await page.goto("/?b=SF.81.185.84." + Array(21).fill(25).join("-"));
  const rating = page.getByRole("spinbutton", { name: "Driving Dunk rating", exact: true });
  await rating.fill("90");
  await rating.press("Enter");
  await expect(page).toHaveURL(/#build=/);
  await expect
    .poll(() => JSON.parse(decodeURIComponent(new URL(page.url()).hash.slice(7))).ratings.dunk)
    .toBe(90);
  const code = "SF.81.185.81." + Array(21).fill(25).join("-");
  await page.goto("/?b=" + code);
  await expect(rating).toHaveValue("25");
  const body = page.locator(".body-controls");
  await expect(body).toContainText("Wingspan6′9″");
  await page.getByRole("button", { name: "Share build", exact: true }).click();
  await page.getByRole("button", { name: "Import a build", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Build link", exact: true })
    .fill(
      "https://www.lockercodes.io/nba-2k/myplayer-builder?b=" +
        code.replace(".81.185.81.", ".80.190.83."),
    );
  await page.getByRole("button", { name: "Import build", exact: true }).click();
  await expect(body).toContainText("Height6′8″");
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(body).toContainText("Height6′9″");
});

test("production rules cascade up and down, and undo restores all linked ratings", async ({
  page,
}) => {
  await page.goto("/?b=SF.81.185.84." + Array(21).fill(25).join("-"));
  const agility = page.getByRole("spinbutton", { name: "Agility rating", exact: true });
  const speed = page.getByRole("spinbutton", { name: "Speed rating", exact: true });
  await agility.fill("83");
  await agility.press("Enter");
  await expect(speed).toHaveValue("73");
  await expect(page.locator(".adjustment-notice, .auto-adjusted")).toHaveCount(0);
  const before = await page.locator(".rating").evaluateAll((nodes) => nodes.map((n) => n.value));
  await speed.fill("60");
  await speed.press("Enter");
  await expect(agility).toHaveValue("70");
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  expect(await page.locator(".rating").evaluateAll((nodes) => nodes.map((n) => n.value))).toEqual(
    before,
  );
});

test("body edits update legal ranges, caps, and dependent ratings in one undo step", async ({
  page,
}) => {
  await page.goto("/?b=SF.81.185.84." + Array(21).fill(25).join("-"));
  await page.getByRole("button", { name: "Body & badge potential" }).click();
  await page.getByRole("combobox", { name: "Preview position" }).selectOption("C");
  const weight = page.getByRole("combobox", { name: "Preview weight" });
  await expect(weight).toHaveValue("215");
  await expect(weight.locator("option").first()).toHaveAttribute("value", "215");
  const height = page.getByRole("combobox", { name: "Preview height" });
  await expect(height.locator("option")).toHaveCount(10);
  await height.selectOption("88");
  await expect(page.getByRole("combobox", { name: "Preview wingspan" })).toHaveValue("88");
  await page.getByRole("button", { name: "Apply body" }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Speed rating", exact: true }),
  ).not.toHaveAttribute("max", "86");
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(page.locator(".body-controls")).toContainText("Height6′9″");
});

test("measured cap steps project cumulatively and removal preserves base ratings", async ({
  page,
}) => {
  await page.goto("/?b=SF.81.185.84." + Array(21).fill(25).join("-"));
  await page
    .locator(".header-actions")
    .getByRole("button", { name: /^Cap breakers/ })
    .click();
  const modal = page.getByRole("dialog");
  const row = modal.locator(".caps-list>div").filter({ hasText: "Free Throw" });
  await expect(row).toContainText("+13 / +12 / +10 / +8 / +6");
  for (let i = 0; i < 5; i++)
    await modal.getByRole("button", { name: "Add Free Throw cap breaker", exact: true }).click();
  await expect(row).toContainText("Base 25");
  await expect(row).toContainText("74");
  await modal.getByRole("button", { name: "Remove Free Throw cap breaker", exact: true }).click();
  await expect(row).toContainText("68");
  await modal.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Free Throw rating", exact: true }),
  ).toHaveValue("25");
});

test("all catalogs are searchable and badge tiers show their own requirements", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Unlocks", exact: true }).click();
  await expect(page.locator(".unlock-row")).toHaveCount(53);
  await page.getByRole("textbox", { name: "Search unlocks", exact: true }).fill("Posterizer");
  await page.locator(".unlock-row").click();
  const hof = page.locator(".badge-tier-card").filter({ hasText: "HOF" });
  await hof.click();
  await expect(hof).toHaveAttribute("aria-pressed", "true");
  await expect(hof).toContainText("99 Driving Dunk");
  await page.getByRole("button", { name: "animations", exact: true }).click();
  await expect(page.locator(".unlock-list .show-more")).toContainText("2854 remaining");
  await page.getByRole("textbox", { name: "Search unlocks", exact: true }).fill("Kareem");
  await expect(page.locator(".animation-card").first()).toContainText("Kareem");
  await page.getByRole("button", { name: "takeovers", exact: true }).click();
  await expect(page.locator(".unlock-row")).toHaveCount(24);
});

test("takeovers display their discipline icons", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Unlocks", exact: true }).click();
  await page.getByRole("button", { name: "takeovers", exact: true }).click();
  await expect(page.locator(".unlock-list .unlock-row .takeover-icon")).toHaveCount(24);
  await expect(page.locator(".unlock-list .unlock-row .badge-icon")).toHaveCount(0);
});

test("PNG export produces valid landscape and portrait images at requested dimensions", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByRole("button", { name: "Share build", exact: true }).click();
  for (const [format, width, height] of [
    ["landscape", 1200, 675],
    ["portrait", 1080, 1350],
  ]) {
    await page.getByRole("combobox", { name: "Image format", exact: true }).selectOption(format);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG", exact: true }).click();
    const file = await download;
    const bytes = await readFile(await file.path());
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(height);
    expect(bytes.length).toBeGreaterThan(20000);
    await file.saveAs(`design/export-${format}.png`);
    await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  }
});

test("synthetic dependency fixture propagates in the UI and undo restores the whole transaction", async ({
  page,
}) => {
  // TEST-ONLY relationships; no claim that these thresholds match NBA 2K27.
  await page.route("**/src/engine/ruleset*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const rulesetStatus='synthetic-test';export const dependencyRules=[{id:'fixture',source:'dunk',target:'layup',steps:[[90,75]]},{id:'fixture-chain',source:'layup',target:'strength',steps:[[75,74]]}];`,
    }),
  );
  await page.goto("/?b=SF.81.185.84." + Array(21).fill(25).join("-"));
  const dunk = page.getByRole("spinbutton", { name: "Driving Dunk rating", exact: true });
  await dunk.fill("90");
  await dunk.press("Enter");
  await expect(
    page.getByRole("spinbutton", { name: "Driving Layup rating", exact: true }),
  ).toHaveValue("75");
  await expect(page.getByRole("spinbutton", { name: "Strength rating", exact: true })).toHaveValue(
    "74",
  );
  await expect(page.locator(".auto-adjusted")).toHaveCount(0);
  await expect(page.locator(".adjustment-notice")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(dunk).toHaveValue("25");
  await expect(
    page.getByRole("spinbutton", { name: "Driving Layup rating", exact: true }),
  ).toHaveValue("25");
  await expect(page.getByRole("spinbutton", { name: "Strength rating", exact: true })).toHaveValue(
    "25",
  );
});
