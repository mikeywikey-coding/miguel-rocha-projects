import html from "../catalogs/html-reference.json" with { type: "json" };
import { buildCaps } from "./buildModel.js";
import { exactCapBreakerLadders } from "./capBreakerEngine.js";

const ids = html.attributes.map((attribute) => attribute.id);
const verifiedBuilds = [
  {
    body: { height: 81, weight: 185, wingspan: 85 },
    ratings: [86, 67, 87, 47, 45, 83, 77, 60, 55, 80, 60, 63, 91, 87, 78, 75, 82, 88, 88, 56, 67],
    gains: [
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
    ],
  },
];

function ratingVector(build) {
  return ids.map((id) => build.ratings[id]);
}

// The ladders for all 21 attributes come from one calculation, and the editor asks
// for them attribute by attribute several times per render, so keep the last result.
let cachedKey = null;
let cachedLadders = null;
function laddersFor(build, vector) {
  const { height, weight, wingspan } = build.body;
  const key = `${height}/${weight}/${wingspan}:${vector.join(",")}`;
  if (key !== cachedKey) {
    try {
      cachedLadders = exactCapBreakerLadders(vector, build.body);
    } catch {
      cachedLadders = null;
    }
    cachedKey = key;
  }
  return cachedLadders;
}

export function capProjection(build, id) {
  const index = ids.indexOf(id);
  if (index < 0) return { gains: Array(5).fill(0), confidence: "exact" };
  const vector = ratingVector(build);
  const verified = verifiedBuilds.find(
    (candidate) =>
      candidate.body.height === build.body.height &&
      candidate.body.weight === build.body.weight &&
      candidate.body.wingspan === build.body.wingspan &&
      candidate.ratings.every((rating, ratingIndex) => vector[ratingIndex] === rating),
  );
  if (verified) return { gains: verified.gains[index], confidence: "verified" };
  const result = laddersFor(build, vector);
  if (result)
    return {
      gains: result.ladders[index],
      confidence: "exact",
      archetype: result.archetype,
      tuningVersion: result.tuningVersion,
    };
  // No ceiling table for this body: assume +1 per breaker up to the body cap.
  const cap = buildCaps(build.body)[id] ?? build.ratings[id];
  const room = Math.max(0, cap - build.ratings[id]);
  return {
    gains: Array.from({ length: 5 }, (_, i) => (i < room ? 1 : 0)),
    confidence: "fallback",
  };
}

export function capSequence(build, id) {
  return capProjection(build, id).gains;
}

export function capDisplayValue(build, id) {
  const gains = capSequence(build, id);
  const selected = build.breakers[id] || 0;
  const appliedGains = selected > 0 ? gains.slice(0, selected) : gains;
  return build.ratings[id] + appliedGains.reduce((sum, gain) => sum + gain, 0);
}

export function projectedRatings(build) {
  let estimated = false;
  const ratings = { ...build.ratings };
  const caps = buildCaps(build.body);
  for (const [id, count] of Object.entries(build.breakers)) {
    if (!count) continue;
    const projection = capProjection(build, id);
    ratings[id] = Math.min(
      caps[id] ?? ratings[id],
      ratings[id] + projection.gains.slice(0, count).reduce((sum, value) => sum + value, 0),
    );
    if (projection.confidence === "fallback") estimated = true;
  }
  return { ratings, estimated };
}
