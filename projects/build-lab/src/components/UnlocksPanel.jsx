import { useMemo } from "react";
import { Basketball, CheckCircle, Info, LockKey, MagnifyingGlass } from "@phosphor-icons/react";
import { animations, badges, byId, eligible, groups, takeovers } from "../data";
import { badgeAvailability, badgeSummary, requirementStatus } from "../catalogs";
import { BadgeDetail } from "./BadgeDetail";
import { BadgeIcon } from "./BadgeIcon";
import { CategoryIcon } from "./CategoryIcon";

export const PAGE_SIZE = 60;

const takeoverGroups = {
  Finishing: "fin",
  Shooting: "sht",
  Playmaking: "plm",
  Defense: "def",
  Rebounding: "reb",
};
const sizeLabels = {
  SMALLS_ONLY: "Small builds",
  BIGS_ONLY: "Big builds",
  BIGS_AND_SWINGS: "Bigs and wings",
  ANY: "All builds",
};
const groupOrder = (item) => groups.findIndex((g) => g.id === item.group);
const byGroupThenName = (a, b) =>
  groupOrder(a) - groupOrder(b) || a.name.localeCompare(b.name, "en");
const itemCategory = (item) => item.group || item.category || item.tier;

function TakeoverIcon({ tier }) {
  const groupId = takeoverGroups[tier];
  return groupId ? (
    <CategoryIcon groupId={groupId} className="takeover-icon" />
  ) : (
    <Basketball className="takeover-icon" size={28} weight="fill" aria-label="All disciplines" />
  );
}

function requirementText(item) {
  return item.requirements?.length
    ? item.requirements
        .map(([id, value]) => `${value} ${byId[id]?.name || id}`)
        .join(item.mode === "any" ? " or " : " + ")
    : "No rating requirement";
}

function AnimationCard({ item, build, onSelect }) {
  const status = requirementStatus(item, build.ratings, build.body);
  const state = status === "met" ? "unlocked" : status === "locked" ? "unavailable" : "unverified";
  return (
    <button className={`animation-card animation-${state}`} onClick={() => onSelect(item)}>
      <span className="animation-card-head">
        <strong>{item.name}</strong>
        <em>{item.tier}</em>
      </span>
      <span className="animation-requirement">Requires {requirementText(item)}</span>
      <span className="animation-meta">
        {sizeLabels[item.size] || item.size || "Any size"}
        {item.season ? " · Seasonal" : ""}
      </span>
      <span className="animation-status">
        {{ unlocked: "Unlocked", unavailable: "Unavailable", unverified: "Check in game" }[state]}
      </span>
    </button>
  );
}

/**
 * Badge, animation and takeover catalogs with search and filters. When an
 * attribute is selected, badges that use it are pinned to the top.
 *
 * `unlocks` is { type, query, filter, category, attribute, limit }.
 */
export function UnlocksPanel({ build, caps, unlocks, setUnlocks, badge, onSelectBadge }) {
  const { type, query, filter, category, attribute, limit } = unlocks;

  const items = useMemo(() => {
    if (type === "animations") return animations;
    if (type === "takeovers") return takeovers;
    const summary = badgeSummary(build.ratings, build.body);
    if (!attribute) return summary.sort(byGroupThenName);
    // Also list badges whose current tier does not use the attribute but another tier does.
    const related = [
      ...new Map(
        badges
          .filter((item) => item.requirements.some(([id]) => id === attribute))
          .map((item) => [item.badgeId, item]),
      ).values(),
    ];
    const included = new Set(summary.map((item) => item.badgeId));
    return [...summary, ...related.filter((item) => !included.has(item.badgeId))].sort(
      byGroupThenName,
    );
  }, [type, attribute, build.ratings, build.body]);

  const isRelated = (item) =>
    type === "badges" &&
    !!attribute &&
    badges.some(
      (b) => b.badgeId === item.badgeId && b.requirements.some(([id]) => id === attribute),
    );
  const statusOf = (item) => requirementStatus(item, build.ratings, build.body);

  const visible = items.filter(
    (item) =>
      `${item.name} ${item.tier} ${item.category || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "all" || itemCategory(item) === category || isRelated(item)) &&
      (filter === "all" || statusOf(item) === filter),
  );
  if (type === "badges" && attribute)
    visible.sort((a, b) => {
      const related = Number(isRelated(b)) - Number(isRelated(a));
      if (related) return related;
      if (isRelated(a)) {
        const unmet = Number(statusOf(a) !== "met") - Number(statusOf(b) !== "met");
        if (unmet) return unmet;
      }
      return a.name.localeCompare(b.name, "en");
    });

  const showAttributeDetail = type === "badges" && attribute && category === byId[attribute].group;
  const detail = (
    <BadgeDetail item={badge} ratings={build.ratings} body={build.body} onSelect={onSelectBadge} />
  );

  return (
    <div className="inspector-content">
      <div className="badge-cost-heading">
        <span className="badge-cost-kicker">BADGE COST</span>
        <span className="badge-cost-context">Select an attribute to inspect related unlocks</span>
      </div>
      <div className="subtabs" aria-label="Unlock type">
        {["badges", "animations", "takeovers"].map((t) => (
          <button
            key={t}
            className={type === t ? "active" : ""}
            onClick={() => setUnlocks({ type: t, query: "", category: "all", limit: PAGE_SIZE })}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="unlock-search">
        <MagnifyingGlass size={17} />
        <input
          aria-label="Search unlocks"
          placeholder="Find an unlock…"
          value={query}
          onChange={(e) => setUnlocks({ query: e.target.value, limit: PAGE_SIZE })}
        />
        <select
          aria-label="Unlock status"
          value={filter}
          onChange={(e) => setUnlocks({ filter: e.target.value, limit: PAGE_SIZE })}
        >
          <option value="all">All</option>
          <option value="met">Met</option>
          <option value="locked">Not met</option>
          <option value="unknown">Check in game</option>
        </select>
      </div>
      <select
        className="category-filter"
        aria-label="Unlock category"
        value={category}
        onChange={(e) =>
          setUnlocks({ category: e.target.value, attribute: null, limit: PAGE_SIZE })
        }
      >
        <option value="all">All categories</option>
        {[...new Set(items.map(itemCategory))].map((g) => (
          <option key={g} value={g}>
            {groups.find((x) => x.id === g)?.name || g}
          </option>
        ))}
      </select>

      {showAttributeDetail && detail}
      <div className={`unlock-list ${type === "animations" ? "animation-catalog" : ""}`}>
        {type === "animations"
          ? visible
              .slice(0, limit)
              .map((item) => (
                <AnimationCard key={item.id} item={item} build={build} onSelect={onSelectBadge} />
              ))
          : visible.slice(0, limit).map((item) => {
              const status = statusOf(item);
              const unavailable = type === "badges" && status === "locked";
              const bodyLimited =
                unavailable &&
                badgeAvailability(item, build.ratings, build.body, caps) === "ineligible";
              const related = isRelated(item);
              return (
                <button
                  key={item.id}
                  className={`unlock-row ${badge.id === item.id ? "chosen" : ""} ${related ? "attribute-related" : ""} ${unavailable ? "badge-unavailable" : ""}`}
                  data-related={related ? "true" : undefined}
                  data-eligible={unavailable ? "false" : "true"}
                  data-body-eligible={bodyLimited ? "false" : "true"}
                  onClick={() => onSelectBadge(item)}
                >
                  {type === "takeovers" ? (
                    <TakeoverIcon tier={item.tier} />
                  ) : (
                    <BadgeIcon badgeId={item.badgeId} tier={item.tier} />
                  )}
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.tier}
                      {related && (
                        <em className="related-badge-label">Uses {byId[attribute].name}</em>
                      )}
                      {item.season ? " · Seasonal" : ""}
                      {bodyLimited && <em className="unlock-availability">Not eligible</em>}
                    </small>
                  </span>
                  {status === "unknown" ? (
                    <Info
                      className="muted"
                      size={20}
                      aria-label="Check size or availability in game"
                    />
                  ) : eligible(item, build.ratings, build.body) ? (
                    <CheckCircle className="positive" size={20} />
                  ) : (
                    <LockKey className="muted" size={18} />
                  )}
                </button>
              );
            })}
        {!visible.length && <p className="empty-state">No matching unlocks.</p>}
        {visible.length > limit && (
          <button
            className="secondary show-more"
            onClick={() => setUnlocks({ limit: limit + PAGE_SIZE })}
          >
            Show more ({visible.length - limit} remaining)
          </button>
        )}
      </div>
      {type !== "animations" && !showAttributeDetail && detail}
    </div>
  );
}
