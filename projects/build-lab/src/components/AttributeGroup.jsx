import {
  ArrowCounterClockwise,
  Broom,
  LockKey,
  LockKeyOpen,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import { byId } from "../data";
import { nextBadges, nextToken } from "../catalogs";
import { capDisplayValue, capProjection } from "../engine/capProjections";
import { CategoryIcon } from "./CategoryIcon";
import { NumberField } from "./NumberField";

/**
 * One attribute category (e.g. Finishing) in the editor.
 *
 * `actions` holds the editor's callbacks: showAttributeBadges, focusAttribute,
 * setLocks, setRating, minimizeRating, setBreakers, breakerLimit and selectBadge.
 */
export function AttributeGroup({
  group,
  build,
  comparison,
  caps,
  overall,
  editorMode,
  selected,
  compare,
  actions,
}) {
  const groupLocked = group.attributes.every(([id]) => build.locks?.[id]);
  const toggleGroupLock = () => {
    const locks = { ...build.locks };
    for (const [id] of group.attributes) {
      if (groupLocked) delete locks[id];
      else locks[id] = true;
    }
    actions.setLocks(locks);
  };
  return (
    <section className="attribute-group" data-category={group.id} aria-label={group.name}>
      <h2>
        <CategoryIcon groupId={group.id} />
        {group.name}
        <button
          type="button"
          className="category-lock"
          aria-label={`${groupLocked ? "Unlock" : "Lock"} ${group.name} category`}
          aria-pressed={groupLocked}
          title={`${groupLocked ? "Unlock" : "Lock"} all ${group.name} attributes`}
          onClick={toggleGroupLock}
        >
          {groupLocked ? <LockKey size={14} weight="fill" /> : <LockKeyOpen size={14} />}
        </button>
      </h2>
      {group.attributes.map(([id]) => (
        <AttributeRow
          key={id}
          id={id}
          build={build}
          comparison={comparison}
          caps={caps}
          overall={overall}
          editorMode={editorMode}
          selected={selected === id}
          compare={compare}
          actions={actions}
        />
      ))}
    </section>
  );
}

function AttributeRow({
  id,
  build,
  comparison,
  caps,
  overall,
  editorMode,
  selected,
  compare,
  actions,
}) {
  const attribute = byId[id];
  const value = build.ratings[id];
  const cap = caps[id] ?? 25;
  const locked = !!build.locks?.[id];
  const delta = value - comparison.ratings[id];
  const target = nextBadges(id, build.ratings, build.body);
  const token = nextToken(id, value, build.body);
  const budgetBlocked = !overall.available.includes(id) && (value >= cap || overall.overall >= 98);
  const breakers = build.breakers[id] || 0;
  const breakerLimit = actions.breakerLimit(id);
  const { gains, confidence } = capProjection(build, id);
  const estimated = confidence === "fallback";
  const selectedGain = gains.slice(0, breakers).reduce((sum, n) => sum + n, 0);

  const rowClass = [
    "attribute-row",
    selected && "selected",
    locked && "attribute-locked",
    budgetBlocked && "attribute-budget-blocked",
    overall.overall === 99 && "attribute-overall-complete",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rowClass}
      onClick={(e) => {
        if (!e.target.closest(".attribute-name,.attribute-lock,.attribute-hint,.bar-cap-steps"))
          actions.showAttributeBadges(id);
      }}
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) actions.focusAttribute(id);
      }}
    >
      <div className="attribute-main">
        <div className="attribute-label">
          {editorMode !== "caps" && (
            <button
              type="button"
              className="attribute-lock"
              aria-label={`${locked ? "Unlock" : "Lock"} ${attribute.name}`}
              aria-pressed={locked}
              title={locked ? "Unlock rating" : "Lock rating"}
              onClick={() => {
                const locks = { ...build.locks };
                if (locked) delete locks[id];
                else locks[id] = true;
                actions.setLocks(locks);
              }}
            >
              {locked ? <LockKey size={16} weight="fill" /> : <LockKeyOpen size={16} />}
            </button>
          )}
          <button className="attribute-name" onClick={() => actions.showAttributeBadges(id)}>
            {attribute.name}
          </button>
        </div>
        <span className={`delta ${delta > 0 ? "positive" : "negative"}`}>
          {compare && delta !== 0 ? `${delta > 0 ? "+" : ""}${delta}` : ""}
        </span>
        <NumberField
          disabled={editorMode === "caps" || locked}
          label={`${attribute.name} rating`}
          value={value}
          min={25}
          max={cap}
          onCommit={(v) => actions.setRating(id, v)}
          className="rating"
        />
        <div className="slider-wrap">
          <div className="slider-track">
            <span style={{ width: `${cap === 25 ? 0 : ((value - 25) / (cap - 25)) * 100}%` }} />
          </div>
          <input
            type="range"
            aria-label={`${attribute.name} slider`}
            min="25"
            max={cap}
            disabled={cap === 25 || locked}
            value={value}
            onPointerDown={() => actions.showAttributeBadges(id)}
            onChange={(e) => actions.setRating(id, Number(e.target.value))}
          />
        </div>
        <span
          className={`cap ${cap > attribute.cap ? "cap-up" : cap < attribute.cap ? "cap-down" : ""}`}
          title={
            caps[id] === null
              ? "No sourced cap for Standing Dunk below 6′1″"
              : "Body attribute ceiling"
          }
        >
          {caps[id] ?? "?"}
        </span>
        {editorMode !== "attributes" && (
          <div className="bar-cap-steps" aria-label={`${attribute.name} cap breakers`}>
            {Array.from({ length: 5 }, (_, i) => gains[i]).map((gain, i) => (
              <button
                key={i}
                className={estimated ? "estimated-cap-step" : ""}
                aria-label={`${attribute.name} cap allocation ${i + 1}`}
                aria-pressed={breakers > i}
                title={`${estimated ? "Estimated c" : "C"}ap breaker ${i + 1}: +${gain}`}
                disabled={i >= breakerLimit}
                onClick={() => {
                  actions.showAttributeBadges(id);
                  actions.setBreakers(id, breakers === i + 1 ? 0 : i + 1);
                }}
              >
                <span className="cap-step-value">
                  {gain > 0 ? `+${gain}` : <LockKey size={10} />}
                </span>
              </button>
            ))}
            <span
              className={`bar-cap-total ${estimated ? "estimated-cap-value" : ""}`}
              title={`${estimated ? "Estimated n" : "N"}ew cap after selected breakers`}
            >
              <span className="cap-step-value">{capDisplayValue(build, id)}</span>
            </span>
            {editorMode === "caps" && (
              <span
                className={`bar-cap-gain ${estimated ? "estimated-cap-value" : ""}`}
                title={`${estimated ? "Estimated s" : "S"}elected cap gain`}
              >
                +{selectedGain}
              </span>
            )}
            <span className="reset-breakers-slot">
              {breakers > 0 && (
                <button
                  className="reset-attribute-breakers"
                  aria-label={`Reset all ${attribute.name} cap breakers`}
                  title={`Reset all ${attribute.name} cap breakers`}
                  onClick={() => actions.setBreakers(id, 0)}
                >
                  <ArrowCounterClockwise size={14} />
                </button>
              )}
            </span>
          </div>
        )}
        <div className="row-stepper">
          <button
            aria-label={`Decrease ${attribute.name}`}
            disabled={value === 25 || locked}
            onClick={() => actions.setRating(id, value - 1)}
          >
            <Minus size={12} />
          </button>
          <button
            className="minimize-attribute"
            aria-label={`Minimize ${attribute.name}`}
            title={`Minimize ${attribute.name}`}
            disabled={value === 25 || locked}
            onClick={() => actions.minimizeRating(id)}
          >
            <Broom size={12} />
          </button>
          <button
            aria-label={`Increase ${attribute.name}`}
            title={budgetBlocked ? "No overall room for another point" : undefined}
            disabled={value === cap || locked || budgetBlocked}
            onClick={() => actions.setRating(id, value + 1)}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
      <div className="attribute-hint">
        <button onClick={() => target && actions.selectBadge(target.items[0])}>
          {target ? (
            <>
              Next unlock: {target.rating}{" "}
              {target.items.map((item) => `${item.name} · ${item.tier}`).join(", ")}
            </>
          ) : (
            "No next badge threshold"
          )}
        </button>
        {token && (
          <span className="next-token">
            +{token.gains.reduce((n, v) => n + v, 0)} token at {token.rating}
          </span>
        )}
      </div>
    </div>
  );
}
