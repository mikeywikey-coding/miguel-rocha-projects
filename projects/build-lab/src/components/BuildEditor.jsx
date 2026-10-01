import { Broom, Info, PencilSimple, PersonSimpleRun } from "@phosphor-icons/react";
import { formatHeight, groups } from "../data";
import { AttributeCost } from "./AttributeCost";
import { AttributeGroup } from "./AttributeGroup";
import { CategoryIcon } from "./CategoryIcon";

const EDITOR_MODES = [
  ["combined", "Combined"],
  ["caps", "Cap breakers"],
];

// In-game three-lane grouping: Finishing/Rebounding, Shooting/Defense, Playmaking/Physicals.
const LANES = [
  ["fin", "reb"],
  ["sht", "def"],
  ["plm", "phy"],
].map((ids) => ids.map((id) => groups.find((group) => group.id === id)));

function BodySummary({ body, onOpen }) {
  return (
    <div
      className="body-controls"
      role="button"
      tabIndex={0}
      aria-label="Open body and badge potential"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <label>
        Position<span className="body-summary-value">{body.position}</span>
      </label>
      <label>
        Height<span className="body-summary-value">{formatHeight(body.height)}</span>
      </label>
      <label>
        Weight
        <span className="body-summary-value">
          {body.weight} <small>lbs</small>
        </span>
      </label>
      <label>
        Wingspan
        <span className="body-summary-value">{formatHeight(body.wingspan)}</span>
      </label>
    </div>
  );
}

function TokenStrip({ economy, onCategory }) {
  return (
    <div className="token-strip" aria-label="Badge tokens and slots">
      {groups.map((g, i) => (
        <button
          key={g.id}
          data-category={g.id}
          onClick={() => onCategory(g.id)}
          title={`${g.name}: ${economy.tokens[i]} tokens, ${economy.slots[i]} slots`}
        >
          <CategoryIcon groupId={g.id} />
          <strong>
            {economy.tokens[i]}
            <small> / {economy.slots[i]}</small>
          </strong>
        </button>
      ))}
      <span className="token-legend">
        TOKENS / SLOTS
        <strong className="slot-total">{economy.totalSlots} total slots</strong>
      </span>
    </div>
  );
}

/** The main editing surface: toolbar, body summary, badge economy and attribute lanes. */
export function BuildEditor({
  build,
  comparison,
  caps,
  overall,
  economy,
  projection,
  increaseCosts,
  spent,
  selected,
  compare,
  editorMode,
  onEditorMode,
  hoverSteppers,
  onHoverSteppers,
  actions,
  onMinimizeBuild,
  onResetLocks,
  onOpenModal,
  onRename,
  onCategory,
}) {
  const laneProps = { build, comparison, caps, overall, editorMode, selected, compare, actions };
  return (
    <section className="editor" aria-label="Build editor">
      <div className="editor-toolbar">
        <div role="group" aria-label="Editor view">
          {EDITOR_MODES.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={editorMode === id}
              className={editorMode === id ? "active" : ""}
              onClick={() => onEditorMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {editorMode === "caps" && (
          <div className="cap-usage">
            TOTAL CAP BREAKERS USED: <strong>{spent}</strong>
          </div>
        )}
        <label className="hover-toggle">
          <input
            type="checkbox"
            checked={hoverSteppers}
            onChange={(e) => onHoverSteppers(e.target.checked)}
          />
          +/- on hover
        </label>
        <button
          className="toolbar-minimize"
          aria-label="Minimize unlocked attributes"
          title="Lower unlocked attributes as far as the linked rules allow"
          onClick={onMinimizeBuild}
        >
          <Broom size={14} />
          Minimize unlocked
        </button>
        <button
          className="toolbar-reset-locks"
          disabled={!Object.keys(build.locks || {}).length}
          onClick={onResetLocks}
        >
          Reset locks
        </button>
        <button className="toolbar-reset" onClick={() => onOpenModal("reset")}>
          Reset build
        </button>
      </div>
      <div className="build-title">
        <button onClick={onRename}>
          <h1>{build.name}</h1>
          <PencilSimple size={17} />
        </button>
        <span className="preview-tag">PREVIEW</span>
      </div>
      <button className="body-planner-launch secondary" onClick={() => onOpenModal("body")}>
        <PersonSimpleRun size={18} />
        Body &amp; badge potential
      </button>
      <BodySummary body={build.body} onOpen={() => onOpenModal("body")} />
      {projection.estimated && (
        <p className="body-notice">
          Cap-breaker data is unavailable for this body, so a safe fallback is shown.
        </p>
      )}
      <button className="dependency-status" onClick={() => onOpenModal("rules")}>
        <Info size={14} />
        Linked rules active · Aug 22 snapshot · source differences
      </button>
      <TokenStrip economy={economy} onCategory={onCategory} />
      {editorMode === "combined" && <AttributeCost id={selected} costs={increaseCosts} />}
      <div className="attribute-columns">
        {LANES.map((lane, index) => (
          <div key={index}>
            {lane.map((group) => (
              <AttributeGroup key={group.id} group={group} {...laneProps} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
