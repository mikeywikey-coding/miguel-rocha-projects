import assert from "node:assert/strict";
import { test } from "node:test";

// state.js restores from localStorage when it is imported, so seed storage first.
const saved = {
  reonboard: 1,
  blockStart: "2026-01-05",
  profile: { gender: "male", split: "five" },
  active: {
    exercises: [
      {
        key: "backSquat",
        sets: [{ warmup: true }, { done: true }, { done: false }, { done: false }, { done: false }],
      },
    ],
  },
  sessions: [
    {
      date: "2026-02-02",
      day: "A",
      exercises: [
        {
          name: "Back Squat",
          key: "backSquat",
          sets: [
            { done: true, weight: 100, reps: 5 },
            { done: true, weight: 110, reps: 1 },
            { done: true, warmup: true, weight: 140, reps: 1 },
            { done: false, weight: 150, reps: 1 },
          ],
        },
      ],
    },
  ],
};
const store = new Map([["gymTracker", JSON.stringify(saved)]]);
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
};

const { state, blockNumber, weekInBlock, weekMonIso, fmtWeight, esc, parseNum } =
  await import("../app/js/state.js");
const { e1rm, bestFor } = await import("../app/js/stats.js");

test("old saves migrate to the current profile shape", () => {
  assert.equal(state.profile.style, "ul");
  assert.equal(state.profile.days, 5);
  assert.equal(state.profile.level, "beginner");
  assert.deepEqual(state.extras, {});
});

test("an in-progress workout is trimmed to three working sets, keeping logged ones", () => {
  const sets = state.active.exercises[0].sets;
  assert.equal(sets.filter((s) => !s.warmup).length, 3);
  assert.equal(sets.filter((s) => s.done).length, 1);
});

test("training weeks roll into 8-week blocks", () => {
  assert.equal(blockNumber(1), 1);
  assert.equal(weekInBlock(8), 8);
  assert.equal(blockNumber(9), 2);
  assert.equal(weekInBlock(9), 1);
});

test("weeks are keyed by their Monday", () => {
  assert.equal(weekMonIso(new Date(2026, 8, 27)), "2026-09-21"); // Sunday
  assert.equal(weekMonIso(new Date(2026, 8, 28)), "2026-09-28"); // Monday
});

test("formatting helpers", () => {
  assert.equal(fmtWeight(80), "80 kg");
  assert.equal(fmtWeight(82.25), "82.3 kg");
  assert.equal(parseNum("42,5"), 42.5);
  assert.equal(esc('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
});

test("estimated 1RM rises with reps and a single is taken as measured", () => {
  assert.equal(e1rm(100, 1), 100);
  assert.ok(e1rm(100, 5) < e1rm(100, 10));
  assert.ok(e1rm(100, 30) === e1rm(100, 50));
});

test("bests ignore warm-ups and unfinished sets", () => {
  const best = bestFor("Back Squat");
  assert.equal(best.topWeight, 110);
  assert.equal(best.weight, 100);
  assert.equal(best.reps, 5);
});
