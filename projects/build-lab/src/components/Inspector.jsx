import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { byId, descriptions, formatHeight, groups } from "../data";
import { BadgeDetail } from "./BadgeDetail";
import { CategoryIcon } from "./CategoryIcon";
import { UnlocksPanel } from "./UnlocksPanel";

const TABS = [
  ["unlocks", "Unlocks"],
  ["overview", "Overview"],
  ["changes", "Changes"],
];

/** The right-hand panel: unlock catalogs, a build overview and the change list. */
export function Inspector({
  tab,
  onTab,
  build,
  caps,
  overall,
  spent,
  changes,
  compare,
  onShowComparison,
  unlocks,
  setUnlocks,
  badge,
  onSelectBadge,
  onSelectAttribute,
}) {
  return (
    <aside className="inspector" aria-label="Build inspector">
      <div className="inspector-tabs" role="tablist" aria-label="Inspector">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => onTab(id)}
          >
            {label}
            {id === "changes" && changes.length > 0 && <span>{changes.length}</span>}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <OverviewPanel
          build={build}
          caps={caps}
          overall={overall}
          spent={spent}
          onSelectAttribute={onSelectAttribute}
        />
      ) : tab === "changes" ? (
        <div className="inspector-content">
          {compare ? (
            <ChangeList changes={changes} />
          ) : (
            <div className="empty-state compact">
              <ArrowRight size={34} />
              <h3>Comparison is off</h3>
              <p>Turn on Compare to saved build to see every difference.</p>
              <button className="primary" onClick={onShowComparison}>
                Show comparison
              </button>
            </div>
          )}
          <BadgeDetail
            item={badge}
            ratings={build.ratings}
            body={build.body}
            onSelect={onSelectBadge}
          />
        </div>
      ) : (
        <UnlocksPanel
          build={build}
          caps={caps}
          unlocks={unlocks}
          setUnlocks={setUnlocks}
          badge={badge}
          onSelectBadge={onSelectBadge}
        />
      )}
    </aside>
  );
}

function OverviewPanel({ build, caps, overall, spent, onSelectAttribute }) {
  return (
    <div className="inspector-content overview-content">
      <div className="overview-summary">
        <div className="overview-stat">
          <strong>{overall.overBudget ? "OVER" : overall.overall}</strong>
          <span>Overall</span>
        </div>
        <div className="overview-stat">
          <strong>{spent}</strong>
          <span>Cap breakers</span>
        </div>
        <div className="overview-stat">
          <strong>{overall.available.length}</strong>
          <span>Can grow</span>
        </div>
      </div>
      <div className="overview-body">
        <span>{build.body.position}</span>
        <span>{formatHeight(build.body.height)}</span>
        <span>{build.body.weight} lbs</span>
        <span>{formatHeight(build.body.wingspan)} wingspan</span>
      </div>
      <div className="overview-columns-label">
        <span>Attribute</span>
        <span>Now</span>
        <span>Ceiling</span>
        <span>CB</span>
      </div>
      <div className="overview-groups">
        {groups.map((group) => (
          <section className="overview-group" key={group.id}>
            <h3>
              <CategoryIcon groupId={group.id} />
              {group.name}
            </h3>
            {group.attributes.map(([id]) => {
              const value = build.ratings[id];
              const cap = caps[id] ?? 25;
              const locked = !!build.locks?.[id];
              const limited =
                !overall.available.includes(id) && (value >= cap || overall.overall >= 98);
              return (
                <button
                  type="button"
                  className={`overview-row ${locked ? "locked" : ""} ${limited ? "budget-limited" : ""}`}
                  key={id}
                  onClick={() => onSelectAttribute(id)}
                >
                  <span>{byId[id].name}</span>
                  <strong className="current">{value}</strong>
                  <span className="ceiling">/{cap}</span>
                  <span className="overview-gain">
                    {build.breakers[id] ? `+${build.breakers[id]}` : "-"}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function ChangeList({ changes }) {
  const tone = (change) => (change.delta < 0 ? "negative" : "positive");
  return (
    <>
      <p className="comparison-label">
        Compared with saved build{" "}
        <span>
          · {changes.length} {changes.length === 1 ? "change" : "changes"}
        </span>
      </p>
      {changes.length ? (
        <div className="change-list">
          {changes.map((change) => (
            <div className="change-row" key={change.id}>
              <div>
                <strong>{change.name}</strong>
                <span className="old-value">{change.before}</span>
                <ArrowRight size={17} />
                <span className={tone(change)}>{change.after}</span>
                <span className={`change-delta ${tone(change)}`}>
                  {typeof change.delta === "number"
                    ? `${change.delta > 0 ? "+" : ""}${change.delta}`
                    : ""}
                </span>
              </div>
              {descriptions[change.id] && <p>{descriptions[change.id]}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <CheckCircle size={34} />
          <h3>All caught up</h3>
          <p>Adjust an attribute to see how your build changes.</p>
        </div>
      )}
    </>
  );
}
