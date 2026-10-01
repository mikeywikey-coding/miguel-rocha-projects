import { test } from "node:test";
import assert from "node:assert/strict";
import { badges, animations, takeovers, eligible } from "../src/data.js";
import * as catalog from "../src/catalogs/index.js";
const { badgeEconomy, nextBadge, nextToken, requirementStatus, tokenContribution } = catalog;

const ratings = Object.fromEntries(
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
);
test("badge availability distinguishes an unearned tier from body limits", () => {
  assert.equal(typeof catalog.badgeAvailability, "function");
  const tier = {
    requirements: [
      ["dunk", 73],
      ["vertical", 65],
    ],
    height: [69, 87],
    mode: "all",
  };
  const caps = { ...ratings, dunk: 90, vertical: 80 };
  assert.equal(catalog.badgeAvailability(tier, ratings, { height: 81 }, caps), "locked");
  assert.equal(
    catalog.badgeAvailability(tier, { ...ratings, dunk: 73, vertical: 65 }, { height: 81 }, caps),
    "met",
  );
  assert.equal(
    catalog.badgeAvailability(tier, ratings, { height: 81 }, { ...caps, vertical: 64 }),
    "ineligible",
  );
  assert.equal(catalog.badgeAvailability(tier, ratings, { height: 88 }, caps), "ineligible");
  assert.equal(
    catalog.badgeAvailability(tier, ratings, { height: 81 }, { ...caps, vertical: null }),
    "unknown",
  );
  const alternative = {
    requirements: [
      ["mid", 80],
      ["three", 80],
    ],
    height: [69, 87],
    mode: "any",
  };
  assert.equal(
    catalog.badgeAvailability(
      alternative,
      ratings,
      { height: 81 },
      { ...caps, mid: 70, three: 85 },
    ),
    "locked",
  );
  assert.equal(
    catalog.badgeAvailability(
      alternative,
      ratings,
      { height: 81 },
      { ...caps, mid: 70, three: 75 },
    ),
    "ineligible",
  );
});
test("catalog includes all 53 badges and four creation tiers", () => {
  assert.equal(new Set(badges.map((b) => b.name)).size, 53);
  assert.equal(badges.length, 212);
});
test("unknown animation size and seasonal availability never appear confirmed", () => {
  const animation = { requirements: [["mid", 85]], mode: "all", size: "BIGS_ONLY" };
  assert.equal(requirementStatus(animation, { ...ratings, mid: 90 }, { height: 81 }), "unknown");
  assert.equal(requirementStatus(animation, { ...ratings, mid: 80 }, { height: 81 }), "locked");
  assert.equal(
    requirementStatus({ ...animation, height: [82, 88] }, { ...ratings, mid: 90 }, { height: 81 }),
    "locked",
  );
  assert.equal(
    requirementStatus({ ...animation, height: [82, 88] }, { ...ratings, mid: 90 }, { height: 82 }),
    "met",
  );
  assert.equal(
    requirementStatus(
      { ...animation, height: [82, 88], season: [3, 3] },
      { ...ratings, mid: 90 },
      { height: 82 },
    ),
    "unknown",
  );
});
test("conflicting source height and size restrictions remain unverified", () => {
  const entry = animations.find((a) => a.name === "Big Man Baseline Reverses Off One");
  assert.equal(
    requirementStatus(entry, Object.fromEntries(Object.keys(ratings).map((id) => [id, 99])), {
      height: 69,
    }),
    "unknown",
  );
});
test("badge eligibility includes height and complete attribute predicates", () => {
  const rise = badges.find((b) => b.name === "Rise Up" && b.tier === "Bronze");
  assert.equal(eligible(rise, { ...ratings, standing: 60, vertical: 55 }, { height: 76 }), false);
  assert.equal(eligible(rise, { ...ratings, standing: 60, vertical: 55 }, { height: 77 }), true);
  assert.equal(eligible(rise, { ...ratings, standing: 60, vertical: 54 }, { height: 77 }), false);
});
test("all animation entries and all public takeovers are available", () => {
  assert.equal(animations.length, 2914);
  assert.equal(takeovers.length, 24);
  const calibrated = takeovers.find((t) => t.name === "Calibrated");
  assert.equal(eligible(calibrated, { ...ratings, mid: 85 }, { height: 81 }), true);
  const muscle = takeovers.find((t) => t.name === "Muscle");
  assert.equal(
    eligible(muscle, { ...ratings, oreb: 80, dreb: 80, strength: 79 }, { height: 81 }),
    false,
  );
});
test("next badge suggestions skip tiers already met through an alternative attribute", () => {
  const current = { ...ratings, mid: 87, three: 78 };
  const next = nextBadge("three", current, { height: 81 });
  assert.equal(eligible(next.item, current, { height: 81 }), false);
});
test("badge tokens use the exact position and height table", () => {
  assert.deepEqual(
    tokenContribution("close", 99, { position: "PG", height: 79 }),
    [6, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(
    tokenContribution("close", 99, { position: "SF", height: 79 }),
    [5, 0, 0, 0, 0, 0],
  );
});
test("badge economy reproduces the shared SF build token and slot totals", () => {
  const buildRatings = {
    close: 80,
    layup: 89,
    dunk: 90,
    standing: 94,
    post: 76,
    mid: 62,
    three: 72,
    free: 69,
    pass: 70,
    handle: 53,
    swb: 45,
    interior: 83,
    perimeter: 85,
    steal: 77,
    block: 88,
    oreb: 65,
    dreb: 75,
    speed: 75,
    agility: 83,
    strength: 71,
    vertical: 73,
  };
  const economy = badgeEconomy(buildRatings, {
    position: "SF",
    height: 81,
    weight: 185,
    wingspan: 84,
  });
  assert.deepEqual(economy.tokens, [16, 6, 3, 14, 6, 7]);
  assert.deepEqual(economy.slots, [6, 2, 2, 5, 2, 3]);
  assert.equal(economy.totalSlots, 20);
});
test("next token ladder uses the current body position", () => {
  assert.deepEqual(nextToken("three", 72, { position: "SF", height: 81 }), {
    rating: 76,
    gains: [0, 1, 0, 0, 0, 0],
  });
});
test("next badge suggestions return every unlock at the nearest rating", () => {
  assert.equal(typeof catalog.nextBadges, "function");
  const next = catalog.nextBadges(
    "three",
    { ...ratings, three: 59 },
    { position: "SF", height: 76 },
  );
  assert.equal(next.rating, 60);
  assert.deepEqual(
    next.items.map((item) => item.name),
    ["Mini Marksman", "Set And Fire"],
  );
});
