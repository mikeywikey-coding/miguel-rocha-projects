import { useState } from "react";
import { LockKey, CheckCircle } from "@phosphor-icons/react";
import { groups, byId, badges, eligible, formatHeight } from "../data";
import { buildCaps } from "../engine/buildModel";
import { normalizeBody, getBodyLimits } from "../engine/gameRules";
import { BadgeIcon } from "./BadgeIcon";
import { CategoryIcon } from "./CategoryIcon";

const colors = {
  fin: "#238bd6",
  sht: "#50d12c",
  plm: "#ec831b",
  def: "#e53838",
  reb: "#9954d2",
  phy: "#c5a13a",
};
const tierClass = (tier) => tier.toLowerCase().replaceAll(" ", "-");

export function BodyPlanner({ build, onApply, onCancel }) {
  const [body, setBody] = useState({ ...build.body });
  const [view, setView] = useState("badges");
  const [selected, setSelected] = useState(badges[0].badgeId);
  const limits = getBodyLimits(body),
    caps = buildCaps(body),
    originalCaps = buildCaps(build.body);
  const lower = Object.fromEntries(Object.entries(caps).map(([id, n]) => [id, n ?? 25]));
  const upper = Object.fromEntries(Object.entries(caps).map(([id, n]) => [id, n ?? 99]));
  const items = [...new Set(badges.map((b) => b.badgeId))].map((id) => {
    const tiers = badges.filter((b) => b.badgeId === id);
    const reachable = tiers.filter((b) => eligible(b, lower, body)).at(-1);
    const possible = tiers.filter((b) => eligible(b, upper, body)).at(-1);
    return {
      badge: reachable || tiers[0],
      tiers,
      status: possible?.id !== reachable?.id ? "unknown" : reachable ? "available" : "locked",
    };
  });
  const detail = items.find((x) => x.badge.badgeId === selected) || items[0];

  function change(key, value) {
    setBody((old) => normalizeBody({ ...old, [key]: value }));
  }
  function control(key, label, format = (n) => n) {
    const [min, max] = limits[key];
    return (
      <label className="body-plan-field">
        {label}
        <select
          aria-label={`Preview ${label.toLowerCase()}`}
          value={body[key]}
          onChange={(e) => change(key, Number(e.target.value))}
        >
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
            <option key={n} value={n}>
              {format(n)}
            </option>
          ))}
        </select>
        <input
          type="range"
          aria-label={`Preview ${label.toLowerCase()} slider`}
          min={min}
          max={max}
          value={body[key]}
          onChange={(e) => change(key, Number(e.target.value))}
        />
      </label>
    );
  }

  const badgeGroups = groups.map((group) => (
    <section key={group.id} style={{ "--category-color": colors[group.id] }}>
      <h4>
        <CategoryIcon groupId={group.id} />
        {group.name}
      </h4>
      <div className="body-badge-grid">
        {items
          .filter((item) => item.badge.group === group.id)
          .sort((a, b) => a.badge.name.localeCompare(b.badge.name, "en"))
          .map((item) => (
            <button
              key={item.badge.badgeId}
              className={`body-badge-tile ${tierClass(item.badge.tier)} ${item.status} ${selected === item.badge.badgeId ? "chosen" : ""}`}
              aria-label={`${item.badge.name}: ${item.status === "available" ? item.badge.tier + " potential" : item.status === "locked" ? "locked by body" : "unverified potential"}`}
              aria-pressed={selected === item.badge.badgeId}
              onClick={() => setSelected(item.badge.badgeId)}
            >
              <span className="body-badge-symbol">
                <BadgeIcon badgeId={item.badge.badgeId} tier={item.badge.tier} />
                {item.status === "locked" && (
                  <LockKey className="body-badge-lock" size={15} weight="fill" />
                )}
                {item.status === "available" && (
                  <b>{item.badge.costs?.[body.height - 69] ?? "?"}</b>
                )}
              </span>
              <strong>{item.badge.name}</strong>
              <small>
                {item.status === "available"
                  ? item.badge.tier === "Hall Of Fame"
                    ? "HOF"
                    : item.badge.tier
                  : item.status === "locked"
                    ? "Locked"
                    : "Unverified"}
              </small>
            </button>
          ))}
      </div>
    </section>
  ));

  const detailTiers = detail.tiers.map((tier) => (
    <section key={tier.id} className={eligible(tier, lower, body) ? "reachable" : "unreachable"}>
      <strong>
        {eligible(tier, lower, body)
          ? "Available"
          : eligible(tier, upper, body)
            ? "Unverified"
            : "Locked"}{" "}
        · {tier.tier}
      </strong>
      <span>
        {tier.requirements.map(([id, n], i) => (
          <span key={id}>
            {i > 0
              ? tier.requirements[i - 1][2] === "OR" ||
                (!tier.requirements.some((requirement) => requirement[2]) && tier.mode === "any")
                ? " or "
                : " + "
              : ""}
            {byId[id].name} {n} <small>(cap {caps[id] ?? "?"})</small>
          </span>
        ))}
      </span>
      {tier.height && (
        <small>
          Height {formatHeight(tier.height[0])}–{formatHeight(tier.height[1])}
        </small>
      )}
      <small>{tier.costs?.[body.height - 69] ?? "?"} tokens</small>
    </section>
  ));

  const badgeView = (
    <>
      <div className="body-plan-legend">
        <span>
          <CheckCircle size={15} /> Available
        </span>
        <span>
          <LockKey size={15} /> Locked by body
        </span>
        <span>Bronze / Silver / Gold / HOF</span>
        <span>Number = tier token cost</span>
      </div>
      <div className="body-badge-groups">{badgeGroups}</div>
      <div className="body-badge-detail">
        <h4>{detail.badge.name}</h4>
        <p>
          {detail.status === "locked"
            ? "This body cannot meet the listed requirements."
            : detail.status === "unknown"
              ? "A missing attribute cap prevents confirming the highest tier."
              : "Reachable tiers for the selected body:"}
        </p>
        <div>{detailTiers}</div>
      </div>
    </>
  );
  const capView = (
    <div className="body-cap-groups">
      {groups.map((group) => (
        <section key={group.id} style={{ "--category-color": colors[group.id] }}>
          <h4>
            <CategoryIcon groupId={group.id} />
            {group.name}
          </h4>
          {group.attributes.map(([id]) => (
            <div className="body-cap-row" key={id}>
              <span>{byId[id].name}</span>
              <strong
                className={
                  caps[id] === null
                    ? ""
                    : caps[id] > originalCaps[id]
                      ? "positive"
                      : caps[id] < originalCaps[id]
                        ? "negative"
                        : ""
                }
              >
                {caps[id] ?? "Unverified"}
              </strong>
            </div>
          ))}
        </section>
      ))}
    </div>
  );

  return (
    <div className="body-planner">
      <aside className="body-plan-controls">
        <span className="eyebrow">CUSTOM BUILD</span>
        <h3>Find your fit</h3>
        <label className="body-plan-field">
          Position
          <select
            aria-label="Preview position"
            value={body.position}
            onChange={(e) => change("position", e.target.value)}
          >
            {[
              ["PG", "Point Guard"],
              ["SG", "Shooting Guard"],
              ["SF", "Small Forward"],
              ["PF", "Power Forward"],
              ["C", "Center"],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {control("height", "Height", formatHeight)}
        {control("weight", "Weight", (n) => `${n} lbs`)}
        {control("wingspan", "Wingspan", formatHeight)}
        <p>Explore freely. Apply when you are ready to update your build.</p>
        <button className="primary" onClick={() => onApply(body)}>
          Apply body
        </button>
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </aside>
      <section className="body-plan-results">
        <div className="body-plan-tabs" role="tablist" aria-label="Body potential">
          {[
            ["attributes", "Attributes"],
            ["badges", "Badges"],
          ].map(([id, label]) => (
            <button role="tab" key={id} aria-selected={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>
        <h3>Max {view === "badges" ? "badge" : "attribute"} potential</h3>
        <p className="body-plan-intro">
          {view === "badges"
            ? "Highest reachable tiers for this body. Your final ratings and overall budget determine which badges you actually unlock."
            : "These are the individual attribute ceilings for this body, not a spread you can necessarily afford together."}
        </p>
        {view === "badges" ? badgeView : capView}
        <p className="body-plan-footnote">
          Uses the captured Aug 22 rules and saved-page reference caps. HOF is the highest standard
          tier shown; Legend requires Synergy in game.
        </p>
      </section>
    </div>
  );
}
