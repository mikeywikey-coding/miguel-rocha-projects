import { ArrowRight, Minus, Plus } from "@phosphor-icons/react";
import { attributes } from "../data";
import { capProjection } from "../engine/capProjections";
import { Modal } from "./Modal";

/** Plans cap breakers for every attribute at once. */
export function CapsModal({
  build,
  caps,
  projection,
  spent,
  breakerLimit,
  onChange,
  onSelectAttribute,
  onClose,
}) {
  return (
    <Modal title="Cap breakers" wide onClose={onClose}>
      <p className="muted">
        Plan up to five applications per attribute within its exact body ceiling.
      </p>
      <div className="caps-total">
        {spent} planned{" "}
        <span>{projection.estimated ? "Fallback data in use" : "Exact projection"}</span>
      </div>
      <div className="caps-list">
        {attributes.map((a) => {
          const result = capProjection(build, a.id);
          const estimated = result.confidence === "fallback";
          const count = build.breakers[a.id] || 0;
          return (
            <div key={a.id} onClick={() => onSelectAttribute(a.id)}>
              <span>
                {a.name}
                <small className={estimated ? "estimated-cap-value" : ""}>
                  Base {build.ratings[a.id]} <ArrowRight size={12} /> {projection.ratings[a.id]} ·
                  body cap {caps[a.id] ?? "?"}
                  <br />
                  {result.gains.map((n) => (n > 0 ? `+${n}` : "—")).join(" / ")}{" "}
                  {estimated ? "· fallback" : ""}
                </small>
              </span>
              <button
                className="icon-button"
                aria-label={`Remove ${a.name} cap breaker`}
                disabled={!count}
                onClick={() => onChange(a.id, count - 1)}
              >
                <Minus size={17} />
              </button>
              <b>{count}</b>
              <button
                className="icon-button"
                aria-label={`Add ${a.name} cap breaker`}
                disabled={count >= breakerLimit(a.id)}
                onClick={() => onChange(a.id, count + 1)}
              >
                <Plus size={17} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <button className="primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
