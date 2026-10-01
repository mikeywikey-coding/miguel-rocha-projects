import tuning from "./game-tuning.json" with { type: "json" };
import linkedAttributes from "./linked-attributes.json" with { type: "json" };

export const attributeIds = tuning.ids;
export const legalBodies = tuning.legalBodies;
export const rulesProvenance = tuning.provenance;
export const dependencyRulesProvenance = linkedAttributes.provenance;
const recoveredLinks = linkedAttributes.links;
export const rulesLimitations = [
  "Overall is reproduced from the captured tuning snapshot and can change if the live game tuning changes.",
];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const integer = (n, fallback) =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
export function normalizeBody(body = {}) {
  const position =
    legalBodies.find((row) => row.position === body.position) ??
    legalBodies.find((row) => row.position === "SF");
  const height = clamp(
    integer(body.height, position.default_height_inches),
    ...position.height_inches,
  );
  const row = position.bodies.find((item) => item.height_inches === height);
  return {
    position: position.position,
    height,
    weight: clamp(integer(body.weight, row.default_weight_lb), ...row.weight_lb),
    wingspan: clamp(integer(body.wingspan, row.default_wingspan_inches), ...row.wingspan_inches),
  };
}
export function getBodyLimits(body) {
  const normalized = normalizeBody(body),
    position = legalBodies.find((row) => row.position === normalized.position);
  const row = position.bodies.find((item) => item.height_inches === normalized.height);
  return { height: position.height_inches, weight: row.weight_lb, wingspan: row.wingspan_inches };
}
function multiplier(rows, value, id) {
  if (!rows?.length) return null;
  const upper = rows.find((row) => row.value >= value) ?? rows.at(-1);
  const lower = rows.findLast((row) => row.value <= value) ?? rows[0];
  const a = lower.multipliers[id],
    b = upper.multipliers[id];
  if (a == null || b == null) return null;
  return lower.value === upper.value
    ? a
    : a + ((b - a) * (value - lower.value)) / (upper.value - lower.value);
}
export function getCaps(body) {
  const { height, weight, wingspan } = normalizeBody(body);
  return Object.fromEntries(
    attributeIds.map((id) => {
      const h = tuning.height[height]?.[id],
        w = multiplier(tuning.weight[height], weight, id),
        s = multiplier(tuning.wingspan[height], wingspan, id);
      return [
        id,
        h == null || w == null || s == null ? null : clamp(Math.round(25 + 74 * h * w * s), 25, 99),
      ];
    }),
  );
}
const rulesCache = new Map();
export function getRules(height) {
  if (!Number.isInteger(height) || !recoveredLinks[height])
    throw new RangeError("Unsupported builder height");
  if (!rulesCache.has(height))
    rulesCache.set(
      height,
      recoveredLinks[height]
        .map(([source, target, maxDelta]) => ({
          id: `${height}:${source}:${target}`,
          source,
          target,
          steps: Array.from({ length: Math.max(0, 74 - maxDelta) }, (_, i) => [
            26 + maxDelta + i,
            26 + i,
          ]),
        }))
        .map((rule) => ({
          ...rule,
          source: attributeIds[rule.source],
          target: attributeIds[rule.target],
        })),
    );
  return rulesCache.get(height);
}
export function getOverall(ratings, height) {
  // Double-precision evaluation agrees with all captured mixed/uniform float
  // values to 1e-4. It does not promise bit-identical float32 intermediates or
  // tie-breaking archetypes for mathematically uniform vectors.
  const weights = tuning.weights[height],
    endpoints = tuning.lerp[height];
  if (!weights || !endpoints) throw new RangeError("Unsupported builder height");
  for (const id of attributeIds)
    if (!Number.isInteger(ratings[id]) || ratings[id] < 25 || ratings[id] > 99)
      throw new RangeError(`Invalid rating: ${id}`);
  let uncapped = -Infinity,
    playerType = 0,
    best = -Infinity,
    bestPlayerType = 0;
  for (const [type, archetype] of Object.entries(weights)) {
    let numerator = 0,
      denominator = 0;
    for (const id of attributeIds) {
      const weighted = (archetype[id] ?? 0) * (tuning.scales[id]?.[ratings[id]] ?? 1);
      numerator += weighted * ratings[id];
      denominator += weighted;
    }
    const raw = numerator / denominator;
    const [[inMin, inMax], [outMin, outMax]] = endpoints;
    const value = outMin + ((raw - inMin) / (inMax - inMin)) * (outMax - outMin);
    if (value > uncapped) {
      uncapped = value;
      playerType = +type;
    }
    const capped = clamp(value, 25, 99);
    if (capped > best) {
      best = capped;
      bestPlayerType = +type;
    }
  }
  const detailed = clamp(uncapped, 25, 98.99999237060547);
  // The native detailed routine truncates below 99. Builder completion is a
  // separate availability decision (whether any legal rating can still rise).
  const allMaximum = attributeIds.every((id) => ratings[id] === 99);
  return {
    uncapped,
    detailed,
    best,
    overall: allMaximum ? 99 : Math.floor(detailed + 1e-6),
    playerType,
    bestPlayerType,
  };
}
