import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getRules,
  getCaps,
  normalizeBody,
  legalBodies,
  getOverall,
  attributeIds,
} from "../src/engine/gameRules.js";
import { applyAttributeChange } from "../src/engine/dependencies.js";
const source = (file) =>
  JSON.parse(
    readFileSync(new URL(`../research/nba2k27-builder-dataset/${file}.json`, import.meta.url)),
  ).data;
const vector = (values) => Object.fromEntries(attributeIds.map((id, i) => [id, values[i]]));
test("all 21 reference physical caps match captured engine outputs", () => {
  const caps = getCaps({ position: "PG", height: 75, weight: 198, wingspan: 78 });
  assert.deepEqual(
    attributeIds.map((id) => caps[id]),
    source("bodies/attribute_caps_sample").map((row) => row.cap),
  );
});
test("the SF tuning discrepancy is explicit: 18 match and three differ from the website", () => {
  const caps = getCaps({ position: "SF", height: 81, weight: 185, wingspan: 84 });
  const screenshot = [
    99, 98, 93, 99, 98, 89, 86, 95, 99, 80, 75, 88, 89, 84, 91, 78, 80, 86, 86, 75, 95,
  ];
  assert.deepEqual(
    attributeIds.flatMap((id, i) =>
      caps[id] === screenshot[i] ? [] : [[id, screenshot[i], caps[id]]],
    ),
    [
      ["dunk", 93, 95],
      ["perimeter", 89, 92],
      ["block", 91, 92],
    ],
  );
});
test("legal bodies clamp height first, then its dependent physical ranges", () => {
  assert.equal(legalBodies.length, 5);
  assert.deepEqual(normalizeBody({ position: "PG", height: 100, weight: 1, wingspan: 100 }), {
    position: "PG",
    height: 79,
    weight: 180,
    wingspan: 85,
  });
  assert.equal(getCaps({ position: "PG", height: 69, weight: 165, wingspan: 72 }).standing, null);
});
test("the only cap gaps across all legal body rows are the documented short-body Standing Dunk values", () => {
  const gaps = [];
  for (const position of legalBodies)
    for (const body of position.bodies) {
      const caps = getCaps({
        position: position.position,
        height: body.height_inches,
        weight: body.default_weight_lb,
        wingspan: body.default_wingspan_inches,
      });
      for (const [id, cap] of Object.entries(caps)) {
        if (cap === null) gaps.push([position.position, body.height_inches, id]);
        else assert(Number.isInteger(cap) && cap >= 25 && cap <= 99);
      }
    }
  assert.deepEqual(gaps, [
    ["PG", 69, "standing"],
    ["PG", 70, "standing"],
    ["PG", 71, "standing"],
    ["PG", 72, "standing"],
    ["SG", 72, "standing"],
  ]);
});
test("positive delta links drive real raises and reverse prerequisite reductions", () => {
  const ratings = vector(Array(21).fill(25));
  const caps = vector(Array(21).fill(99));
  const rules = getRules(75);
  assert(rules.some((rule) => rule.source === "swb" && rule.target === "speed"));
  const up = applyAttributeChange({ ratings, caps, rules, attribute: "agility", value: 85 });
  assert.equal(up.ratings.speed, 75);
  assert(up.adjustments.length > 0);
  const down = applyAttributeChange({
    ratings: up.ratings,
    caps,
    rules,
    attribute: "speed",
    value: 60,
  });
  assert.equal(down.ratings.agility, 70);
  assert.notDeepEqual(getRules(69), getRules(88));
});
test("OVR reproduces all 256 full-vector engine samples and winning archetypes", () => {
  for (const row of source("overall/mixed_vectors")) {
    const actual = getOverall(vector(row.values), 75);
    for (const key of ["detailed", "best", "uncapped"])
      assert(
        Math.abs(actual[key] - row[key]) < 1e-4,
        `sample ${row.sample} ${key}: ${actual[key]} vs ${row[key]}`,
      );
    assert.equal(actual.playerType, row.player_type, `sample ${row.sample} player type`);
    assert.equal(actual.bestPlayerType, row.best_player_type);
    assert.equal(actual.overall, row.overall);
  }
});
test("OVR reproduces all 75 uniform vectors, including the saturation edge", () => {
  for (const row of source("overall/uniform_ratings")) {
    const actual = getOverall(vector(Array(21).fill(row.rating)), 75);
    for (const key of ["detailed", "best"])
      assert(Math.abs(actual[key] - row[key]) < 1e-4, `rating ${row.rating} ${key}`);
    assert.equal(actual.overall, row.overall, `rating ${row.rating}`);
  }
});
