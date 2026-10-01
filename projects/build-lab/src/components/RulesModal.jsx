import { byId } from "../data";
import { Modal } from "./Modal";

/** Explains where the rules come from and offers to reconcile a spread that breaks them. */
export function RulesModal({ violations, onApplyRules, onClose }) {
  return (
    <Modal title="Rules and sources" onClose={onClose}>
      <div className="rules-copy">
        {violations.length > 0 && (
          <div className="rules-adjustment">
            <p>
              Your reference spread differs from this rules snapshot:{" "}
              {violations
                .map((v) => `${byId[v.source].name} requires ${v.minimum} ${byId[v.target].name}`)
                .join("; ")}
              . Apply the captured rules to lower dependent ratings into a consistent spread.
            </p>
            <button className="secondary" onClick={onApplyRules}>
              Apply captured rules
            </button>
          </div>
        )}
        <p>
          <strong>
            Linked attributes, body caps, overall pricing, badge tokens and badge slots are active.
          </strong>{" "}
          Calculations use the captured NBA 2K27 rules and the current Locker Codes builder engine.
        </p>
        <p>
          Body caps now use the complete table for every supported height, weight and wingspan.
          Edits show every linked adjustment.
        </p>
        <p>
          The catalog contains all 53 badges and four creation tiers, 2,914 animation entries, and
          24 public takeovers. Animation size ranges are checked where verified; other size and
          seasonal conditions are shown for confirmation in game.
        </p>
        <p>
          <strong>Cap breakers:</strong> each build is assigned one of 15 player profiles from all
          21 ratings. The selected profile, current rating and body ceiling determine every
          cap-breaker step. The supplied in-game builds and shared reference build are covered by
          regression checks.
        </p>
        <p>
          <strong>Badge economy:</strong> token totals use the exact position, height, attribute and
          rating table. All six slot categories use the recovered 20-slot allocation formula.
        </p>
        <p>
          The zero-delta Speed With Ball link remains unresolved. Overall is reproduced from the
          captured tuning and may change after a live-game update.
        </p>
      </div>
      <div className="modal-actions">
        <button className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
