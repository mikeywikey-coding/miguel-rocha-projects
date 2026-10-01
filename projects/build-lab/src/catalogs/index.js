import data from "./compiled.json" with { type: "json" };
import { allocateBadgeSlots, tokenBudget } from "./badgeEconomy.js";

export { nextToken, tokenContribution } from "./badgeEconomy.js";
export const badges = data.badges;
export const animations = data.animations;
export function requirementStatus(item, ratings, body) {
  if (!eligible(item, ratings, body)) return "locked";
  if ((item.size && item.size !== "ANY" && !item.height) || item.season || item.prized)
    return "unknown";
  return "met";
}
export function badgeAvailability(item, ratings, body, caps) {
  if (eligible(item, ratings, body)) return "met";
  const lower = Object.fromEntries(Object.entries(caps).map(([id, n]) => [id, n ?? 25]));
  const upper = Object.fromEntries(Object.entries(caps).map(([id, n]) => [id, n ?? 99]));
  if (!eligible(item, upper, body)) return "ineligible";
  return eligible(item, lower, body) ? "locked" : "unknown";
}
export function eligible(item, ratings, body) {
  if (!item) return false;
  if (item.height && (!body || body.height < item.height[0] || body.height > item.height[1]))
    return false;
  const checks = item.requirements.map(([id, n]) => ratings[id] >= n);
  if (!checks.length) return true;
  if (item.requirements.some((r) => r[2])) {
    let value = checks[0];
    for (let i = 1; i < checks.length; i++)
      value = item.requirements[i - 1][2] === "OR" ? value || checks[i] : value && checks[i];
    return value;
  }
  return item.mode === "any" ? checks.some(Boolean) : checks.every(Boolean);
}
export function badgeSummary(ratings, body) {
  const names = [...new Set(badges.map((b) => b.name))];
  return names.map((name) => {
    const tiers = badges.filter((b) => b.name === name);
    return tiers.filter((b) => eligible(b, ratings, body)).at(-1) || tiers[0];
  });
}
export function badgeEconomy(ratings, body) {
  const tokens = tokenBudget(ratings, body);
  const counts = ["fin", "sht", "plm", "def", "reb", "phy"].map(
    (g) =>
      badges.filter((b) => b.group === g && b.tier === "Bronze" && eligible(b, ratings, body))
        .length,
  );
  const slots = allocateBadgeSlots(tokens, counts);
  return { tokens, slots, totalSlots: slots.reduce((sum, value) => sum + value, 0), counts };
}
export function nextBadges(id, ratings, body) {
  const candidates = badges
    .flatMap((item) =>
      !eligible(item, ratings, body) &&
      item.height[0] <= body.height &&
      body.height <= item.height[1]
        ? item.requirements
            .filter(
              (requirement) =>
                requirement[0] === id && requirement[1] > ratings[id] && requirement[1] <= 99,
            )
            .map((requirement) => ({ item, rating: requirement[1] }))
        : [],
    )
    .sort((a, b) => a.rating - b.rating || a.item.name.localeCompare(b.item.name, "en"));
  if (!candidates.length) return null;
  const rating = candidates[0].rating;
  return {
    rating,
    items: candidates
      .filter((candidate) => candidate.rating === rating)
      .map((candidate) => candidate.item),
  };
}
export function nextBadge(id, ratings, body) {
  const next = nextBadges(id, ratings, body);
  return next ? { rating: next.rating, item: next.items[0] } : null;
}
