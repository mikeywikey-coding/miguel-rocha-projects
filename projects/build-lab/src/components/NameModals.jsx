import { useState } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import { Modal } from "./Modal";

const MAX_NAME_LENGTH = 60;

function NameInput({ value, onChange }) {
  return (
    <label className="form-label">
      Build name
      <input
        autoFocus
        required
        maxLength={MAX_NAME_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Names the current build and saves it to the browser library. */
export function SaveModal({ initialName, onSave, onClose }) {
  const [name, setName] = useState(initialName);
  return (
    <Modal title="Save your build" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name.trim() || "Untitled build");
        }}
      >
        <p className="muted">Create a snapshot you can return to and compare against.</p>
        <NameInput value={name} onChange={setName} />
        <p className="form-help">Stored in this browser. Use Share to keep a portable copy.</p>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save build <FloppyDisk size={18} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Renames either the current draft or a saved build. */
export function RenameModal({ title, initialName, onRename, onClose, cancellable = false }) {
  const [name, setName] = useState(initialName);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRename(name.trim() || "Untitled build");
        }}
      >
        <NameInput value={name} onChange={setName} />
        <div className="modal-actions">
          {cancellable && (
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
          )}
          <button className="primary">Update name</button>
        </div>
      </form>
    </Modal>
  );
}
