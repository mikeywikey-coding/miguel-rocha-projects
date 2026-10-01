import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { baseline, attributes } from "../src/data.js";
import {
  capProjection,
  capSequence,
  capDisplayValue,
  projectedRatings,
} from "../src/engine/capProjections.js";
import { buildCaps } from "../src/engine/buildModel.js";
import { exactBodyCaps, exactCapBreakerLadders } from "../src/engine/capBreakerEngine.js";
test("saved HTML cap steps accumulate and keep physical ceilings intact", () => {
  const build = {
    ...baseline,
    ratings: Object.fromEntries(attributes.map((a) => [a.id, 25])),
    breakers: { free: 5 },
  };
  assert.deepEqual(capSequence(build, "free"), [13, 12, 10, 8, 6]);
  assert.equal(projectedRatings(build).ratings.free, 74);
});

test("cap endpoint starts at the full five-breaker potential and follows the selected allocation", () => {
  const build = { ...baseline, ratings: { ...baseline.ratings, dunk: 90 }, breakers: { dunk: 0 } };
  const gains = capSequence(build, "dunk");
  assert.equal(capDisplayValue(build, "dunk"), 90 + gains.reduce((sum, gain) => sum + gain, 0));
  build.breakers.dunk = 1;
  assert.equal(capDisplayValue(build, "dunk"), 90 + gains[0]);
});
test("uncaptured builds use the deterministic cap-breaker calculation", () => {
  const build = { ...baseline, ratings: { ...baseline.ratings, free: 63 }, breakers: { dunk: 1 } };
  const result = capProjection(build, "dunk");
  assert.equal(result.confidence, "exact");
  assert.equal(result.gains.length, 5);
  assert.ok(result.gains.every(Number.isInteger));
  assert.ok(result.gains.every((n) => n >= 0));
  assert.equal(projectedRatings(build).ratings.dunk, 87 + result.gains[0]);
  assert.equal(projectedRatings(build).estimated, false);
});
test("calculated sequences stop exactly at the selected body cap", () => {
  const build = {
    ...baseline,
    ratings: { ...baseline.ratings, block: 90 },
    breakers: { block: 5 },
  };
  const result = capProjection(build, "block");
  assert.deepEqual(result.gains, [1, 0, 0, 0, 0]);
  assert.equal(projectedRatings(build).ratings.block, 91);
});
test("downloaded-page sequences are reproduced by the deterministic calculation", () => {
  const build = {
    ...baseline,
    ratings: Object.fromEntries(attributes.map((a) => [a.id, 25])),
    breakers: {},
  };
  assert.equal(capProjection(build, "free").confidence, "exact");
});

test("in-game 6'9 SF screenshot uses its exact measured cap-breaker sequences", () => {
  const values = [
    80, 89, 90, 94, 76, 62, 72, 69, 70, 53, 45, 83, 85, 77, 88, 65, 75, 75, 83, 71, 73,
  ];
  const expected = [
    [3, 3, 2, 2, 2],
    [2, 2, 2, 2, 1],
    [2, 1, 0, 0, 0],
    [1, 1, 1, 1, 1],
    [6, 5, 4, 3, 2],
    [1, 1, 1, 1, 1],
    [2, 2, 2, 1, 1],
    [6, 5, 5, 4, 3],
    [3, 3, 3, 2, 2],
    [8, 7, 5, 5, 2],
    [11, 9, 7, 3, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 0, 0],
    [3, 3, 3, 3, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 0, 0],
    [1, 1, 1, 1, 0],
    [2, 2, 2, 1, 1],
  ];
  const build = {
    ...baseline,
    body: { position: "SF", height: 81, weight: 185, wingspan: 84 },
    ratings: Object.fromEntries(
      attributes.map((attribute, index) => [attribute.id, values[index]]),
    ),
    breakers: {},
  };
  attributes.forEach((attribute, index) => {
    const projection = capProjection(build, attribute.id);
    assert.deepEqual(projection.gains, expected[index], attribute.name);
    assert.equal(projection.confidence, "exact", attribute.name);
  });
});

test("shared Locker Codes build is reproduced by the cap-breaker engine", () => {
  const values = [
    86, 67, 87, 47, 45, 83, 77, 60, 55, 80, 60, 63, 91, 87, 78, 75, 82, 88, 88, 56, 67,
  ];
  const expected = [
    [2, 2, 2, 2, 1],
    [4, 4, 3, 3, 3],
    [1, 1, 1, 1, 1],
    [8, 7, 6, 5, 4],
    [11, 9, 7, 7, 5],
    [2, 1, 1, 0, 0],
    [2, 1, 1, 1, 1],
    [8, 6, 5, 5, 4],
    [5, 5, 4, 4, 3],
    [3, 3, 0, 0, 0],
    [6, 6, 5, 3, 0],
    [3, 3, 3, 3, 2],
    [1, 1, 1, 0, 0],
    [1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2],
    [2, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [3, 3, 2, 2, 2],
    [2, 2, 2, 2, 2],
  ];
  const build = {
    ...baseline,
    body: { position: "SF", height: 81, weight: 185, wingspan: 85 },
    ratings: Object.fromEntries(
      attributes.map((attribute, index) => [attribute.id, values[index]]),
    ),
    breakers: {},
  };
  assert.deepEqual(
    Object.values(buildCaps(build.body)),
    [99, 99, 95, 99, 98, 87, 84, 95, 99, 80, 75, 88, 90, 86, 94, 80, 82, 86, 86, 74, 95],
  );
  attributes.forEach((attribute, index) => {
    const projection = capProjection(build, attribute.id);
    assert.deepEqual(projection.gains, expected[index], attribute.name);
    assert.equal(projection.confidence, "verified", attribute.name);
  });
});

test("recovered calculation reproduces every native cap-breaker probe row", () => {
  const probe = JSON.parse(
    fs.readFileSync(
      new URL(
        "../research/nba2k27-builder-dataset/cap_breakers/gains_by_rating.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const body = { height: 75, weight: 198, wingspan: 78 };
  const caps = Object.values(exactBodyCaps(body));
  for (const row of probe.data) {
    const ratings = row.scenario === "isolated" ? Array(21).fill(25) : caps.slice();
    ratings[row.attribute] = row.rating;
    const actual = exactCapBreakerLadders(ratings, body).ladders[row.attribute][row.application];
    assert.equal(
      actual,
      row.gain,
      `${row.scenario} ${row.name} at ${row.rating}, application ${row.application + 1}`,
    );
  }
});
