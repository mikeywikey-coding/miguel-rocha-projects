import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EQUIPMENT,
  LEVELS,
  LIB,
  STYLES,
  dayKeys,
  overrideKey,
  programFor,
} from "../app/js/program.js";

// Every profile the onboarding wizard can produce.
function* profiles() {
  for (const gender of ["female", "male"])
    for (const level of LEVELS)
      for (const equipment of EQUIPMENT)
        for (const style of STYLES)
          for (const days of [2, 3, 4, 5, 6])
            for (const spec of ["off", "lower", "upper"])
              for (const goal of ["hypertrophy", "strength"])
                yield { gender, level, equipment, style, days, spec, goal };
}

test("every profile builds a complete program from known exercises", () => {
  let count = 0;
  for (const profile of profiles()) {
    const program = programFor(profile);
    assert.deepEqual(Object.keys(program), dayKeys(profile));
    for (const day of Object.values(program)) {
      assert.ok(day.exercises.length > 0, JSON.stringify(profile));
      for (const exercise of day.exercises) {
        assert.ok(LIB[exercise.key], `unknown exercise ${exercise.key}`);
        assert.ok(exercise.sets > 0 && exercise.repMin <= exercise.repMax);
      }
    }
    count++;
  }
  assert.ok(count > 1000);
});

test("day count follows the chosen number of days, within 2 to 6", () => {
  assert.deepEqual(dayKeys({ days: 4 }), ["A", "B", "C", "D"]);
  assert.equal(dayKeys({ days: 1 }).length, 2);
  assert.equal(dayKeys({ days: 9 }).length, 6);
  assert.equal(dayKeys(null).length, 3);
});

test("custom swaps, removals and extras are applied to the right day", () => {
  const profile = { gender: "female", style: "full", days: 3 };
  const base = programFor(profile);
  const [first, second] = base.A.exercises;
  const swap = Object.keys(LIB).find((key) => !base.A.exercises.some((e) => e.key === key));

  const custom = { [overrideKey(profile, "A", 0)]: swap };
  const edited = programFor(profile, custom, { B: [swap] }, { A: [second.key] });

  assert.equal(edited.A.exercises[0].key, swap);
  assert.notEqual(edited.A.exercises[0].key, first.key);
  assert.ok(!edited.A.exercises.some((e) => e.key === second.key));
  assert.equal(edited.B.exercises.at(-1).key, swap);
  assert.deepEqual(edited.C, base.C);
});
