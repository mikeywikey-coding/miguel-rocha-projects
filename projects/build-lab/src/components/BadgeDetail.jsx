import { CheckSquare, XSquare } from "@phosphor-icons/react";
import { groups, byId, badges, formatHeight, eligible } from "../data";
import { buildCaps } from "../engine/buildModel";
import { badgeAvailability } from "../catalogs";
import { badgeDescriptions } from "../catalogs/badgeDescriptions";
import { BadgeIcon } from "./BadgeIcon";

/** Every creation tier of one badge, with live requirement status and cumulative token cost. */
export function BadgeDetail({ item, ratings, body, onSelect }) {
  const tiers = badges.filter((b) => b.badgeId === item.badgeId);
  const caps = buildCaps(body);
  const bodyLimited =
    tiers.length > 0 && badgeAvailability(tiers[0], ratings, body, caps) === "ineligible";
  return (
    <section
      className={`badge-detail ${bodyLimited ? "body-ineligible" : ""}`}
      aria-label={`${item.name} badge details`}
    >
      <header className="badge-detail-heading">
        <h3>{item.name}</h3>
        <span>{groups.find((g) => g.id === item.group)?.name}</span>
      </header>
      <p className="badge-description">
        {badgeDescriptions[item.name] ||
          `See how ${item.name} changes across all four creation tiers.`}
      </p>
      {bodyLimited && (
        <p className="bronze-unavailable-note">
          <XSquare size={15} weight="fill" /> Not eligible — this body cannot reach Bronze.
        </p>
      )}
      <div className="badge-tier-grid">
        {tiers.map((tier, tierIndex) => {
          const cumulativeCost = tiers
            .slice(0, tierIndex + 1)
            .reduce((sum, current) => sum + (current.costs?.[body.height - 69] ?? 0), 0);
          const met = eligible(tier, ratings, body),
            heightMet =
              !tier.height || (body.height >= tier.height[0] && body.height <= tier.height[1]);
          const availability = badgeAvailability(tier, ratings, body, caps);
          return (
            <button
              key={tier.id}
              type="button"
              className={`badge-tier-card ${met ? "met" : "locked"}`}
              data-availability={availability}
              aria-pressed={item.id === tier.id}
              onClick={() => onSelect(tier)}
            >
              <span className="badge-tier-art">
                <BadgeIcon badgeId={tier.badgeId} tier={tier.tier} />
                <b className="badge-tier-cost" aria-label={`${cumulativeCost} cumulative tokens`}>
                  {cumulativeCost}
                </b>
              </span>
              <span className={`badge-tier-status ${met ? "met" : "locked"}`}>
                {met ? (
                  <CheckSquare size={18} weight="fill" />
                ) : (
                  <XSquare size={18} weight="fill" />
                )}
                <strong>{tier.tier === "Hall Of Fame" ? "HOF" : tier.tier}</strong>
              </span>
              <span className="badge-tier-requirements">
                {tier.requirements.map(([id, value], index) => {
                  const requirementMet = ratings[id] >= value;
                  const join =
                    index === 0
                      ? ""
                      : tier.requirements[index - 1]?.[2] === "OR" || tier.mode === "any"
                        ? "OR"
                        : "AND";
                  return (
                    <span className="badge-tier-requirement" key={id}>
                      {join && <small>{join}</small>}
                      <span>
                        {value} {byId[id].name}{" "}
                        <em className={requirementMet ? "met" : "locked"}>({ratings[id]})</em>
                      </span>
                    </span>
                  );
                })}
                {!heightMet && (
                  <span className="badge-tier-size">
                    Height {formatHeight(tier.height[0])}–{formatHeight(tier.height[1])}
                  </span>
                )}
                {availability === "ineligible" && (
                  <span className="unlock-availability">Not eligible</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <footer className="badge-detail-legend">
        <span>
          <CheckSquare weight="fill" /> Met
        </span>
        <span>
          <XSquare weight="fill" /> Locked
        </span>
        <span>Circle = cumulative tokens</span>
      </footer>
    </section>
  );
}
