import { test, expect } from '@playwright/test';
import { attributes } from '../../src/data.js';

test('attribute-related badge highlights keep every badge row aligned', async ({ page }) => {
  await page.goto('/');
  await page.locator('.attribute-name').filter({ hasText: /^Driving Dunk$/ }).click();

  const rows = page.locator('.unlock-row');
  const related = rows.filter({ has: page.locator('[data-related="true"]') });
  const positions = await rows.evaluateAll((elements) =>
    elements.map((row) => Math.round(row.querySelector('img.badge-icon').getBoundingClientRect().left)),
  );

  expect(await rows.count()).toBeGreaterThan(1);
  await expect(page.locator('.unlock-row[data-related="true"]').first()).toBeVisible();
  expect(new Set(positions).size).toBe(1);
});

test('attribute-related badges are grouped at the top and remain alphabetical', async ({ page }) => {
  await page.goto('/');
  await page.locator('.attribute-name').filter({ hasText: /^Driving Dunk$/ }).click();

  const rows = page.locator('.unlock-row');
  const listed = await rows.evaluateAll((elements) => elements.map((row) => ({
    name: row.querySelector('strong').textContent.trim(),
    related: row.dataset.related === 'true',
  })));
  const related = listed.filter((item) => item.related);
  const remaining = listed.filter((item) => !item.related);

  expect(related.length).toBeGreaterThan(1);
  expect(remaining.length).toBeGreaterThan(0);
  expect(listed).toEqual([...related, ...remaining]);
  expect(related.map((item) => item.name)).toEqual(
    related.map((item) => item.name).sort((a, b) => a.localeCompare(b, 'en')),
  );
  expect(remaining.map((item) => item.name)).toEqual(
    remaining.map((item) => item.name).sort((a, b) => a.localeCompare(b, 'en')),
  );
});

test('unmet related badges follow attainable related badges before unrelated badges', async ({ page }) => {
  const build={
    name:'Strength badge order',
    body:{position:'SF',height:78,weight:240,wingspan:83},
    ratings:Object.fromEntries(attributes.map(({id})=>[id,id==='strength'?85:25])),
    breakers:{},
  };
  await page.goto(`/#build=${encodeURIComponent(JSON.stringify(build))}`);
  await page.locator('.attribute-name').filter({ hasText: /^Strength$/ }).click();

  const names=await page.locator('.unlock-row').evaluateAll(rows=>rows.map(row=>row.querySelector('strong').textContent.trim()));
  expect(names.indexOf('Work Horse')).toBeLessThan(names.indexOf('Post Powerhouse'));
  expect(names.indexOf('Post Powerhouse')).toBeLessThan(names.indexOf('Flash'));
});

test('selected attribute badge detail shows every tier, cumulative costs, and live status', async ({ page }) => {
  await page.goto('/');
  const rating = page.getByLabel('Three-Point Shot rating');
  await rating.fill('60');
  await rating.blur();
  await page.locator('.attribute-name').filter({ hasText: /^Three-Point Shot$/ }).click();

  const rows = page.locator('.unlock-row');
  await expect(rows.locator('img.badge-icon')).toHaveCount(await rows.count());
  await rows.filter({ hasText: 'Set And Fire' }).click();

  const detail = page.locator('.badge-detail');
  await expect(detail.getByRole('heading', { name: 'Set And Fire' })).toBeVisible();
  await expect(detail.locator('.badge-description')).toContainText('three-point');
  const cards = detail.locator('.badge-tier-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.locator('img.badge-icon')).toHaveCount(4);
  await expect(cards.nth(0).locator('img.badge-icon')).toHaveAttribute('src', '/images/badges/53-bronze.webp');
  await expect(cards.nth(3).locator('img.badge-icon')).toHaveAttribute('src', '/images/badges/53-hall_of_fame.webp');
  expect(await cards.locator('.badge-tier-cost').allTextContents()).toEqual(['2', '4', '5', '6']);
  await expect(cards.filter({ has: page.locator('.badge-tier-status.met') })).toHaveCount(1);
  await expect(cards.filter({ has: page.locator('.badge-tier-status.locked') })).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('60 Three-Point Shot (60)');
  await expect(cards.nth(1)).toContainText('78 Three-Point Shot (60)');
});

test('the unlock panel grows with its badge list instead of adding nested scrollbars', async ({ page }) => {
  await page.goto('/');
  await page.locator('.attribute-name').filter({ hasText: /^Three-Point Shot$/ }).click();

  const overflow = await page.evaluate(() => {
    const inspector = getComputedStyle(document.querySelector('.inspector'));
    const list = getComputedStyle(document.querySelector('.unlock-list'));
    return {
      inspector: inspector.overflowY,
      inspectorMaxHeight: inspector.maxHeight,
      list: list.overflowY,
      listMaxHeight: list.maxHeight,
    };
  });

  expect(overflow).toEqual({
    inspector: 'visible',
    inspectorMaxHeight: 'none',
    list: 'visible',
    listMaxHeight: 'none',
  });
});

test('game category artwork is used throughout the builder', async ({ page }) => {
  await page.goto('/');

  const ids = ['fin', 'sht', 'plm', 'def', 'reb', 'phy'];
  for (const id of ids) {
    await expect(page.locator(`.attribute-group[data-category="${id}"] img.category-icon`))
      .toHaveAttribute('src', `/images/categories/${id}.png`);
    await expect(page.locator(`.token-strip button[data-category="${id}"] img.category-icon`))
      .toHaveAttribute('src', `/images/categories/${id}.png`);
  }

  const bottomRuns = await page.evaluate(async (categoryIds) => Promise.all(categoryIds.map(async (id) => {
    const image = new Image();
    image.src = `/images/categories/${id}.png`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let longest = 0;
    for (let y = Math.floor(canvas.height * .75); y < canvas.height; y += 1) {
      let run = 0;
      for (let x = 0; x < canvas.width; x += 1) {
        run = pixels[(y * canvas.width + x) * 4 + 3] > 48 ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
    }
    return { id, longest };
  })), ids);
  expect(bottomRuns.every(({ longest }) => longest <= 25), JSON.stringify(bottomRuns)).toBe(true);

  await page.getByRole('button', { name: 'Body & badge potential' }).click();
  await expect(page.locator('.body-badge-groups img.category-icon')).toHaveCount(6);
});
