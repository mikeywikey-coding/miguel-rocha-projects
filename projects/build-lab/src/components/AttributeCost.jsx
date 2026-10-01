import { byId } from "../data";

export function AttributeCost({ id, costs }) {
  const cost = costs[id];
  if (!cost) return null;
  const maximum = Math.max(0, ...Object.values(costs).map((c) => c.overallDelta ?? 0));
  const width = maximum > 0 ? (Math.max(0, cost.overallDelta ?? 0) / maximum) * 100 : 0;
  const amount = cost.overallDelta;
  const impact =
    amount === null
      ? null
      : Math.abs(amount) < 0.005
        ? amount < 0
          ? "−<0.01"
          : "+<0.01"
        : `${amount < 0 ? "−" : "+"}${Math.abs(amount).toFixed(2)}`;
  const reason = {
    body: "At body maximum",
    "linked-cap": "Linked attribute at maximum",
    invalid: "Linked adjustment needed",
    budget: "Doesn’t fit the remaining budget",
    locked: `Unlock ${cost.lockedAttributes.map((key) => byId[key].name).join(", ")} to add this point`,
  }[cost.status];
  return (
    <section className={`attribute-cost cost-${cost.status}`} aria-label="Attribute increase cost">
      <div className="attribute-cost-heading">
        <strong>{byId[id].name}</strong>
        <span>{amount === null ? "Next +1" : `${cost.from} → ${cost.to}`}</span>
        {impact && <b>{impact} OVR</b>}
      </div>
      {impact && (
        <div
          className="attribute-cost-meter"
          role="meter"
          aria-label="Next point cost compared with the most expensive attribute"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(width)}
        >
          <i style={{ width: `${width}%` }} />
        </div>
      )}
      {reason && <p className="attribute-cost-reason">{reason}</p>}
      {amount !== null && (
        <p>
          {cost.adjustments.length
            ? `Includes ${cost.adjustments.map((a) => `${byId[a.id].name} ${a.before} → ${a.after}`).join(" · ")}`
            : "No linked increases"}
          <span>
            Bar compares the next +1 across this build. OVR impact uses the current rules.
          </span>
        </p>
      )}
    </section>
  );
}
