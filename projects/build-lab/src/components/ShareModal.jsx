import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { Modal } from "./Modal";

export function ShareModal({
  shareUrl,
  exportFormat,
  onExportFormat,
  exportBusy,
  onExport,
  onImport,
  onCopyFailed,
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const isLocalPreview = ["localhost", "127.0.0.1"].includes(location.hostname);
  return (
    <Modal title="Share your build" onClose={onClose}>
      <p className="muted">
        This link includes your body settings, attributes, and planned cap breakers. Open it to load
        a copy.
      </p>
      {isLocalPreview && (
        <p className="form-help">
          Local preview: this link works on this device while the app is running. Sharing with other
          people requires hosting.
        </p>
      )}
      <label className="form-label">
        Build link
        <textarea
          readOnly
          aria-label="Build link"
          value={shareUrl}
          onFocus={(e) => e.target.select()}
        />
      </label>
      <div className="modal-actions">
        <button className="secondary" onClick={onImport}>
          Import a build
        </button>
        <button
          className="primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
            } catch {
              onCopyFailed();
            }
          }}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="image-export">
        <h3>Download a build image</h3>
        <label>
          Image format
          <select
            aria-label="Image format"
            value={exportFormat}
            onChange={(e) => onExportFormat(e.target.value)}
          >
            <option value="landscape">X · 1200 × 675</option>
            <option value="portrait">Instagram · 1080 × 1350</option>
          </select>
        </label>
        <button className="secondary" disabled={exportBusy} onClick={onExport}>
          {exportBusy ? "Creating image…" : "Download PNG"}
        </button>
      </div>
    </Modal>
  );
}

/** Accepts a Build Lab link, raw build JSON, or an original Locker Codes builder link. */
export function ImportModal({ onImport, onClose }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal title="Import a build" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onImport(text);
          } catch (importError) {
            setError(importError.message);
          }
        }}
      >
        <p className="muted">
          Paste a Build Lab link or an original Locker Codes builder link. Values outside the legal
          body ranges and body caps will be limited.
        </p>
        <label className="form-label">
          Build link
          <textarea autoFocus required value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {error && (
          <p className="negative" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="primary">Import build</button>
        </div>
      </form>
    </Modal>
  );
}
