import {
  getRules,
  getCaps,
  getOverall,
  normalizeBody,
  attributeIds,
} from "./gameRules.js";
import {
  applyAttributeChange,
  reconcileAttributes,
  satisfyMinimums,
} from "./dependencies.js";
import { exactBodyCaps } from "./capBreakerEngine.js";
export function buildCaps(body) {
  return exactBodyCaps(body) ?? getCaps(body);
}
export const usableCaps = (body) =>
  Object.fromEntries(
    Object.entries(buildCaps(body)).map(([id, cap]) => [id, cap ?? 25]),
  );
const allocations = (breakers, ratings, caps) =>
  Object.fromEntries(
    attributeIds.map((id) => [
      id,
      Math.min(breakers[id] || 0, 5, Math.max(0, caps[id] - ratings[id])),
    ]),
  );
export function editRating(
  build,
  id,
  value,
  rules = getRules(build.body.height),
) {
  if (build.locks?.[id])
    return {
      build,
      adjustments: [],
      constrained: true,
      lockLimited: true,
      blockedBy: [id],
    };
  const caps = usableCaps(build.body),
    before = build.ratings;
  const requested = Math.max(25, Math.min(caps[id], Math.round(value)));
  let result = applyAttributeChange({
    ratings: before,
    caps,
    rules,
    attribute: id,
    value: requested,
  });
  let budgetLimited = false;
  if (requested > before[id]) {
    for (
      let candidate = requested;
      getOverall(result.ratings, build.body.height).uncapped > 99 + 1e-6 &&
      candidate >= before[id];
      candidate--
    ) {
      budgetLimited = true;
      result =
        candidate === before[id]
          ? { ratings: before, adjustments: [], constrained: true }
          : applyAttributeChange({
              ratings: before,
              caps,
              rules,
              attribute: id,
              value: candidate - 1,
            });
    }
  }
  const blockedBy = attributeIds.filter(
    (key) => build.locks?.[key] && result.ratings[key] !== before[key],
  );
  if (blockedBy.length)
    return {
      build,
      adjustments: [],
      constrained: true,
      lockLimited: true,
      blockedBy,
    };
  return {
    build: {
      ...build,
      ratings: result.ratings,
      breakers: allocations(build.breakers, result.ratings, caps),
    },
    adjustments: result.adjustments,
    constrained: result.constrained || budgetLimited,
    budgetLimited,
  };
}
export function minimizeAttribute(
  build,
  id,
  rules = getRules(build.body.height),
) {
  if (build.locks?.[id])
    return {
      build,
      adjustments: [],
      changed: false,
      lockLimited: true,
      blockedBy: [id],
    };
  for (let candidate = 25; candidate < build.ratings[id]; candidate++) {
    const result = editRating(build, id, candidate, rules);
    if (!result.lockLimited && result.build.ratings[id] < build.ratings[id])
      return { ...result, changed: true };
  }
  return { build, adjustments: [], changed: false };
}
export function changeBody(build, key, value) {
  const body = normalizeBody(
      typeof key === "object" ? key : { ...build.body, [key]: value },
    ),
    caps = usableCaps(body);
  const clamped = Object.fromEntries(
    attributeIds.map((id) => [id, Math.min(build.ratings[id], caps[id])]),
  );
  const ratings = reconcileAttributes({
    ratings: clamped,
    caps,
    rules: getRules(body.height),
  });
  const releasedLocks = attributeIds.filter(
    (id) => build.locks?.[id] && ratings[id] !== build.ratings[id],
  );
  const locks = Object.fromEntries(
    Object.entries(build.locks || {}).filter(
      ([id]) => !releasedLocks.includes(id),
    ),
  );
  const adjustments = attributeIds
    .filter((id) => ratings[id] !== build.ratings[id])
    .map((id) => ({
      id,
      before: build.ratings[id],
      after: ratings[id],
      reason: clamped[id] !== build.ratings[id] ? "body cap" : "linked minimum",
    }));
  const nextBuild = {
    ...build,
    body,
    ratings,
    breakers: allocations(build.breakers, ratings, caps),
  };
  if (Object.keys(locks).length) nextBuild.locks = locks;
  else delete nextBuild.locks;
  return { build: nextBuild, adjustments, releasedLocks };
}
export function minimizeUnlocked(build, rules = getRules(build.body.height)) {
  const caps = usableCaps(build.body);
  const floor = Object.fromEntries(
    attributeIds.map((id) => [id, build.locks?.[id] ? build.ratings[id] : 25]),
  );
  const ratings = satisfyMinimums({ ratings: floor, caps, rules });
  if (
    attributeIds.some(
      (id) => build.locks?.[id] && ratings[id] !== build.ratings[id],
    )
  )
    return { build, changed: false, lockLimited: true };
  if (attributeIds.every((id) => ratings[id] === build.ratings[id]))
    return { build, changed: false };
  return {
    build: {
      ...build,
      ratings,
      breakers: allocations(build.breakers, ratings, caps),
    },
    changed: true,
  };
}
export function attributeIncreaseCosts(
  build,
  rules = getRules(build.body.height),
) {
  const caps = usableCaps(build.body),
    before = build.ratings;
  const beforeOverall = getOverall(before, build.body.height).uncapped;
  const invalid = rules.some((rule) =>
    rule.steps.some(
      ([rating, minimum]) =>
        before[rule.source] >= rating && before[rule.target] < minimum,
    ),
  );
  return Object.fromEntries(
    attributeIds.map((id) => {
      const base = {
        from: before[id],
        to: before[id],
        overallDelta: null,
        adjustments: [],
        lockedAttributes: [],
      };
      if (before[id] >= caps[id]) return [id, { ...base, status: "body" }];
      if (invalid) return [id, { ...base, status: "invalid" }];
      const result = applyAttributeChange({
        ratings: before,
        caps,
        rules,
        attribute: id,
        value: before[id] + 1,
      });
      if (result.ratings[id] !== before[id] + 1)
        return [id, { ...base, status: "linked-cap" }];
      const changed = attributeIds.filter(
        (key) => result.ratings[key] !== before[key],
      );
      const lockedAttributes = changed.filter((key) => build.locks?.[key]);
      const afterOverall = getOverall(
        result.ratings,
        build.body.height,
      ).uncapped;
      return [
        id,
        {
          ...base,
          to: result.ratings[id],
          afterOverall,
          overallDelta: afterOverall - beforeOverall,
          adjustments: changed
            .filter((key) => key !== id)
            .map((key) => ({
              id: key,
              before: before[key],
              after: result.ratings[key],
            })),
          lockedAttributes,
          status: lockedAttributes.length
            ? "locked"
            : afterOverall > 99 + 1e-6
              ? "budget"
              : "available",
        },
      ];
    }),
  );
}
export function overallStatus(build, rules = getRules(build.body.height)) {
  const price = getOverall(build.ratings, build.body.height),
    caps = usableCaps(build.body);
  const violations = rules.flatMap((rule) => {
    let minimum = 25;
    for (const [n, v] of rule.steps)
      if (build.ratings[rule.source] >= n) minimum = v;
      else break;
    return build.ratings[rule.target] < minimum
      ? [{ source: rule.source, target: rule.target, minimum }]
      : [];
  });
  const overBudget = price.uncapped > 99 + 1e-6;
  const available = overBudget
    ? []
    : attributeIds.filter((id) => {
        if (build.locks?.[id] || build.ratings[id] >= caps[id]) return false;
        const result = applyAttributeChange({
          ratings: build.ratings,
          caps,
          rules,
          attribute: id,
          value: build.ratings[id] + 1,
        });
        return (
          result.ratings[id] > build.ratings[id] &&
          getOverall(result.ratings, build.body.height).uncapped <= 99 + 1e-6
        );
      });
  const complete =
    !overBudget &&
    !available.length &&
    !violations.length &&
    !Object.values(buildCaps(build.body)).includes(null);
  return {
    ...price,
    overBudget,
    available,
    violations,
    complete,
    overall: complete ? 99 : price.overall,
  };
}
