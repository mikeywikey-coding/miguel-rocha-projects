import { ArrowCounterClockwise, ArrowUUpLeft, Info } from "@phosphor-icons/react";

function overallSummary(overall) {
  if (overall.overBudget) return "Lower ratings to fit";
  if (overall.violations.length) return "Linked adjustment needed";
  if (overall.complete) return "Build complete";
  return `${overall.available.length} attributes can grow`;
}

/** Unsaved-change count, the overall meter, undo, revert and the comparison switch. */
export function BottomBar({
  overall,
  changeCount,
  canUndo,
  onUndo,
  onRevert,
  onRules,
  compare,
  onCompare,
}) {
  const meter = overall.complete ? 100 : (overall.detailed / 99) * 100;
  return (
    <footer className={`bottom-bar ${overall.overall === 99 ? "overall-99" : ""}`}>
      <div className="save-status">
        <span className={changeCount ? "status-dot pending" : "status-dot"} />
        <span>
          <b>{changeCount}</b> unsaved {changeCount === 1 ? "change" : "changes"}
        </span>
      </div>
      <button
        className={`rules-status overall-status ${overall.overBudget ? "negative" : ""}`}
        onClick={onRules}
      >
        <span className="overall-meter" aria-hidden="true">
          <i style={{ width: `clamp(0px, ${meter}%, 100%)` }} />
        </span>
        <strong className="overall-value">
          {overall.overBudget ? "OVER BUDGET" : `${overall.overall} OVR`}
        </strong>
        <span>·</span>
        {overallSummary(overall)}
        <Info size={16} />
      </button>
      <div className="footer-actions">
        <button
          className="icon-button"
          aria-label="Undo last change"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <ArrowUUpLeft size={21} />
        </button>
        <button className="secondary revert-button" disabled={!changeCount} onClick={onRevert}>
          <ArrowCounterClockwise size={20} />
          Revert changes
        </button>
        <button
          className="compare-toggle"
          role="switch"
          aria-checked={compare}
          onClick={() => onCompare(!compare)}
          title={compare ? "Hide saved-build comparison" : "Show saved-build comparison"}
        >
          Compare to saved build
          <span className={`switch ${compare ? "on" : ""}`}>
            <span />
          </span>
        </button>
      </div>
    </footer>
  );
}
