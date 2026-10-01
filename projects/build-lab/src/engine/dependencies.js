// A deterministic dependency solver. Actual game relationships must be supplied
// by a sourced ruleset; badge eligibility is NOT an attribute dependency.
const bounded = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));

function validate(ratings, caps, rules) {
  for (const [id, rating] of Object.entries(ratings)) {
    if (
      !Number.isInteger(rating) ||
      rating < 25 ||
      !Number.isInteger(caps[id]) ||
      caps[id] < 25 ||
      caps[id] > 99 ||
      rating > caps[id]
    )
      throw new Error(`Invalid starting rating or cap: ${id}`);
  }
  for (const rule of rules) {
    if (!(rule.source in ratings) || !(rule.target in ratings) || !Array.isArray(rule.steps))
      throw new Error("Invalid dependency");
    let lastThreshold = 24,
      lastMinimum = 24;
    for (const [threshold, minimum] of rule.steps) {
      if (
        !Number.isInteger(threshold) ||
        !Number.isInteger(minimum) ||
        threshold <= lastThreshold ||
        minimum < lastMinimum ||
        threshold < 25 ||
        threshold > 99 ||
        minimum < 25 ||
        minimum > 99
      )
        throw new Error("Dependency steps must be monotonic integer ratings");
      lastThreshold = threshold;
      lastMinimum = minimum;
    }
  }
}
function required(rule, value) {
  let floor = 25;
  for (const [threshold, minimum] of rule.steps)
    if (value >= threshold) floor = minimum;
    else break;
  return floor;
}
function close(ratings, caps, rules, direction) {
  const next = { ...ratings },
    reasons = {};
  // Monotonic: each update strictly raises or lowers one of at most 21 ratings.
  const maxPasses = Object.keys(next).length * 75 + 1;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const rule of rules) {
      const floor = required(rule, next[rule.source]);
      if (next[rule.target] >= floor) continue;
      if (direction === "up") {
        if (floor > caps[rule.target]) return null;
        next[rule.target] = floor;
        reasons[rule.target] = {
          linkedTo: rule.source,
          rule: rule.id || `${rule.source}:${rule.target}`,
        };
      } else {
        let permitted = 25;
        for (let value = 25; value <= next[rule.source]; value++)
          if (required(rule, value) <= next[rule.target]) permitted = value;
        if (required(rule, permitted) > next[rule.target]) return null;
        next[rule.source] = permitted;
        reasons[rule.source] = {
          linkedTo: rule.target,
          rule: rule.id || `${rule.source}:${rule.target}`,
        };
      }
      changed = true;
    }
    if (!changed) return { ratings: next, reasons };
  }
  throw new Error("Dependency propagation did not converge");
}
export function applyAttributeChange({ ratings, caps, rules, attribute, value }) {
  validate(ratings, caps, rules);
  if (!(attribute in ratings) || !Number.isFinite(value))
    throw new Error("Invalid attribute change");
  const requested = bounded(value, 25, caps[attribute]);
  const direction = requested >= ratings[attribute] ? "up" : "down";
  let result;
  if (direction === "up") {
    // If a linked cap prevents the requested rating, stop at the highest legal
    // requested rating. Never silently exceed another attribute's body cap.
    for (let candidate = requested; candidate >= ratings[attribute]; candidate--) {
      result = close({ ...ratings, [attribute]: candidate }, caps, rules, direction);
      if (result) break;
    }
  } else result = close({ ...ratings, [attribute]: requested }, caps, rules, direction);
  if (!result) return { ratings: { ...ratings }, adjustments: [], constrained: true };
  const adjustments = Object.keys(ratings)
    .filter((id) => id !== attribute && result.ratings[id] !== ratings[id])
    .map((id) => ({ id, before: ratings[id], after: result.ratings[id], ...result.reasons[id] }));
  return {
    ratings: result.ratings,
    adjustments,
    constrained: result.ratings[attribute] !== requested,
  };
}

export function reconcileAttributes({ ratings, caps, rules }) {
  validate(ratings, caps, rules);
  const result = close(ratings, caps, rules, "down");
  if (!result) throw new Error("Cannot reconcile linked attributes");
  return result.ratings;
}

export function satisfyMinimums({ ratings, caps, rules }) {
  validate(ratings, caps, rules);
  const result = close(ratings, caps, rules, "up");
  if (!result) throw new Error("Cannot satisfy linked attribute minimums within the body caps");
  return result.ratings;
}
