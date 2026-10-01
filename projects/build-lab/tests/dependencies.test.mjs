import test from "node:test";
import assert from "node:assert/strict";
import { applyAttributeChange } from "../src/engine/dependencies.js";
// Synthetic A/B/C fixtures validate the solver, not NBA 2K27 game accuracy.
const rules = [
  {
    id: "a-b",
    source: "a",
    target: "b",
    steps: [
      [70, 50],
      [85, 65],
    ],
  },
  { id: "b-c", source: "b", target: "c", steps: [[60, 45]] },
];
const caps = { a: 99, b: 99, c: 99 };
test("raising a rating propagates minimums transitively and reports every adjustment", () => {
  const result = applyAttributeChange({
    ratings: { a: 25, b: 25, c: 25 },
    caps,
    rules,
    attribute: "a",
    value: 85,
  });
  assert.deepEqual(result.ratings, { a: 85, b: 65, c: 45 });
  assert.deepEqual(
    result.adjustments.map((r) => r.id),
    ["b", "c"],
  );
  assert.equal(result.adjustments[1].linkedTo, "b");
});
test("lowering a prerequisite lowers dependent ratings, not unrelated invested ratings", () => {
  const result = applyAttributeChange({
    ratings: { a: 85, b: 65, c: 45, d: 90 },
    caps: { ...caps, d: 99 },
    rules,
    attribute: "c",
    value: 40,
  });
  assert.deepEqual(result.ratings, { a: 84, b: 59, c: 40, d: 90 });
});
test("a linked hard cap limits the requested source rating", () => {
  const result = applyAttributeChange({
    ratings: { a: 25, b: 25, c: 25 },
    caps: { ...caps, b: 60 },
    rules,
    attribute: "a",
    value: 95,
  });
  assert.deepEqual(result.ratings, { a: 84, b: 50, c: 25 });
  assert.equal(result.constrained, true);
});
test("monotonic cycles converge without erasing user investment", () => {
  const result = applyAttributeChange({
    ratings: { a: 25, b: 25 },
    caps: { a: 99, b: 99 },
    rules: [
      { source: "a", target: "b", steps: [[60, 60]] },
      { source: "b", target: "a", steps: [[60, 60]] },
    ],
    attribute: "a",
    value: 70,
  });
  assert.deepEqual(result.ratings, { a: 70, b: 60 });
});
test("lowering a driver does not unnecessarily lower its already allocated prerequisites", () => {
  const result = applyAttributeChange({
    ratings: { a: 85, b: 65, c: 45 },
    caps,
    rules,
    attribute: "a",
    value: 50,
  });
  assert.deepEqual(result.ratings, { a: 50, b: 65, c: 45 });
});
test("invalid or decreasing rule tables are rejected", () => {
  assert.throws(
    () =>
      applyAttributeChange({
        ratings: { a: 25, b: 25 },
        caps: { a: 99, b: 99 },
        rules: [
          {
            source: "a",
            target: "b",
            steps: [
              [60, 70],
              [80, 50],
            ],
          },
        ],
        attribute: "a",
        value: 70,
      }),
    /monotonic/,
  );
});
