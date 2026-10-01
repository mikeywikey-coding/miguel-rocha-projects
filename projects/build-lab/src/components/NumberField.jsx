import { useState } from "react";
import { clamp } from "../data";

/**
 * A numeric input that edits a local draft and commits on blur or Enter.
 * `onCommit` may return the value it actually accepted (e.g. after linked
 * limits), which is then shown instead of the typed value.
 */
export function NumberField({
  value,
  min,
  max,
  onCommit,
  label,
  className = "",
  disabled = false,
}) {
  const [draft, setDraft] = useState(String(value));
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setDraft(String(value));
  }

  function commit() {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n)) {
      const next = clamp(n, min, max);
      const accepted = onCommit(next);
      setDraft(String(typeof accepted === "number" ? accepted : next));
    } else setDraft(String(value));
  }

  return (
    <input
      disabled={disabled}
      className={className}
      type="number"
      aria-label={label}
      min={min}
      max={max}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(String(value));
      }}
    />
  );
}
