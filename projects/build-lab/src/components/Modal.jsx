import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

/** A native <dialog> opened as a modal. Escape and backdrop clicks call onClose. */
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

/** A two-button confirmation dialog. */
export function ConfirmModal({
  title,
  children,
  cancelLabel = "Cancel",
  confirmLabel,
  confirmClass = "primary",
  onConfirm,
  onClose,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{children}</p>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose}>
          {cancelLabel}
        </button>
        <button className={confirmClass} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
